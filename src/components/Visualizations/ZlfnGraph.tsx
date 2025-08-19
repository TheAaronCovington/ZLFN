import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useResizeObserver } from '../../hooks/useResizeObserver'
import { Button, Stack, IconButton, TextField, Chip, Menu, MenuItem, Divider } from '@mui/material'
import { useLogicShared } from '../../context/LogicSharedContext'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { evaluateInference, evaluateStates } from '../../services/inference'
import { parseVennRule, computeShading } from '../../services/venn'

export type ZlfnNode = {
	id: string
	name?: string
	symbol?: string
	translation?: string
	type?: 'premise' | 'conclusion' | 'term' | 'fallacy' | 'core' | 'informal' | 'temporal'
	zone?: string
	zoneId?: string
	argumentId?: string
	facets?: { vennRelevant?: boolean; truthTableRelevant?: boolean; timelineRelevant?: boolean; counterRelevant?: boolean }
	color?: string
	size?: { width: number; height: number } | { radius: number }
	label?: string
}

export type ZlfnEdge = {
	id?: string
	from?: string
	to?: string
	source?: string
	target?: string
	type?: 'implication' | 'counterexample' | 'bidirectional' | 'semantic'
	weight?: number
	rule?: string
	style?: 'solid' | 'dashed' | 'dotted'
	priority?: number
	label?: string
	color?: string
	clusterKey?: string
}

export type ZlfnZone = {
	id: string
	name: string
	color: string
	xRange: [number, number]
	yRange: [number, number]
}

export interface ZlfnGraphProps {
	nodes: ZlfnNode[]
	edges: ZlfnEdge[]
	zones?: ZlfnZone[]
	storageKey?: string
	onInfo?: (message: string) => void
	centerOnSelectionTrigger?: number
	centerOnNodeId?: string
    centerOnNodeTrigger?: number
	onEdgeSelect?: (edge: ZlfnEdge | null) => void
	onOpenTruthTable?: (expr: string) => void
}

export const ZlfnGraph: React.FC<ZlfnGraphProps> = ({ nodes, edges, zones, storageKey, onInfo, centerOnSelectionTrigger, centerOnNodeId, centerOnNodeTrigger, onEdgeSelect, onOpenTruthTable }) => {
	const { elementRef, size } = useResizeObserver<HTMLDivElement>()
	const svgRef = useRef<SVGSVGElement | null>(null)
	const gRef = useRef<SVGGElement | null>(null)
	const miniMapRef = useRef<SVGSVGElement | null>(null)
	const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
	const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)
	// keep baseline Y for Terms so toggles don't yank them vertically
	const termsBaselineYRef = useRef<Record<string, number>>({})
	// prevent re-loading saved layout on every rebuild for same storageKey
	const layoutLoadedRef = useRef<string | null>(null)
	const { simulationMode, setSimulationMode, nodeIdToActive, setNodeIdToActive, resetStates, selectedNodeId, setSelectedNodeId, modes } = useLogicShared()
	const [tooltip, setTooltip] = useState<{ x: number; y: number; html: string } | null>(null)
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null)
	const pathCentroidRef = useRef<{ x: number; y: number } | null>(null)
  const mmBoundsRef = useRef<{ minX: number; minY: number; sx: number; sy: number } | null>(null)
	const [frozen, setFrozen] = useState(false)
	const [pathHighlight, setPathHighlight] = useState(false)
	const [showEdgeLabels] = useState(true)
	const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
		if (!storageKey) return new Set()
		try { const raw = localStorage.getItem(`xv_pins_layout_${storageKey}`); return new Set<string>(raw ? JSON.parse(raw) : []) } catch { return new Set() }
	})
	const [ruleFilter, setRuleFilter] = useState('')
	const [hideNonPath, setHideNonPath] = useState(false)
	const ruleFilterRef = useRef<HTMLInputElement | null>(null)
	const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number | null>(null)
	const [hierarchyMode, setHierarchyMode] = useState<boolean>(() => localStorage.getItem('xv_hierarchy') === '1')
	const [showClusters, setShowClusters] = useState<boolean>(() => localStorage.getItem('xv_clusters') !== '0')
	const [showRivers, setShowRivers] = useState<boolean>(() => localStorage.getItem('xv_rivers') !== '0')
	const showRiversRef = useRef<boolean>(showRivers)
	useEffect(() => { showRiversRef.current = showRivers }, [showRivers])
	const [statusText, setStatusText] = useState<string>('')
	const [showLegend, setShowLegend] = useState<boolean>(() => localStorage.getItem('xv_legend') === '1')

	// copy selected node details to clipboard
	const copySelectedDetails = async () => {
		try {
			if (!selectedNodeId) { onInfo?.('No node selected'); return }
			const node = (nodes as any[]).find(n => n.id === selectedNodeId)
			const relEdges = (edges as any[]).filter(e => (e.from ?? e.source) === selectedNodeId || (e.to ?? e.target) === selectedNodeId)
			const payload = {
				selectedNodeId,
				node,
				edges: relEdges,
				modes,
				argument: selectedArgumentId,
				zones: { informal: showInformalZone, temporal: showTemporalZone }
			}
			await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
			onInfo?.('Copied selected node details')
		} catch (err) {
			onInfo?.('Copy failed')
		}
	}
	// overflow menu for secondary controls
	const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
	const menuOpen = Boolean(menuAnchorEl)
	const openMenu = (e: React.MouseEvent<HTMLElement>) => setMenuAnchorEl(e.currentTarget)
	const closeMenu = () => setMenuAnchorEl(null)
	// debug helpers
	const debug = true
	const tickRef = useRef<number>(0)
	// zone visibility
	const [showInformalZone, setShowInformalZone] = useState<boolean>(() => localStorage.getItem('xv_zone_informal') !== '0')
	const [showTemporalZone, setShowTemporalZone] = useState<boolean>(() => localStorage.getItem('xv_zone_temporal') !== '0')
	// multi-argument selection
	const [selectedArgumentId, setSelectedArgumentId] = useState<string | null>(() => {
		if (!storageKey) return null
		try { return localStorage.getItem(`xv_argument_${storageKey}`) || null } catch { return null }
	})
	const argumentIds = useMemo<string[]>(() => {
		try {
			const set = new Set<string>()
			for (const n of (nodes as any[])) { if (n && typeof n.argumentId === 'string') set.add(n.argumentId) }
			const arr = Array.from(set)
			return arr.length ? arr : ['Demo']
		} catch { return ['Demo'] }
	}, [nodes])

	// default zones
	const defaultZones: ZlfnZone[] = useMemo(
		() => [
			{ id: 'arguments', name: 'Arguments', color: '#9e9e9e', xRange: [40, 160], yRange: [110, 220] },
			{ id: 'premises', name: 'Premises', color: '#20B2AA', xRange: [180, 460], yRange: [110, 530] },
			{ id: 'terms', name: 'Terms', color: '#4169E1', xRange: [500, 820], yRange: [110, 530] },
			{ id: 'conclusions', name: 'Conclusions', color: '#9370DB', xRange: [860, 1180], yRange: [110, 530] },
			{ id: 'fallacies', name: 'Fallacies', color: '#DC143C', xRange: [1220, 1380], yRange: [110, 360] },
			{ id: 'informal', name: 'Informal', color: '#ffb74d', xRange: [180, 460], yRange: [540, 620] },
			{ id: 'temporal', name: 'Temporal', color: '#64b5f6', xRange: [500, 820], yRange: [540, 620] },
		],
		[]
	)

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return
			if (e.key.toLowerCase() === 'f') { e.preventDefault(); fitToContents() }
			if (e.key.toLowerCase() === 'c') { e.preventDefault(); centerOnSelection() }
			if (e.key.toLowerCase() === 'p') { e.preventDefault(); centerOnPath() }
			if (e.key.toLowerCase() === 's') { e.preventDefault(); saveLayout(); onInfo?.('Layout saved') }
			if (e.key.toLowerCase() === 'm') { e.preventDefault(); const next = !simulationMode; setSimulationMode(next); if (!next) resetStates(); onInfo?.(next ? 'Simulation enabled' : 'Simulation disabled') }
			if (e.key.toLowerCase() === 'r') { e.preventDefault(); resetStates(); onInfo?.('States reset') }
			if (e.key.toLowerCase() === 'x') { e.preventDefault(); toggleFreeze() }
			if (e.key.toLowerCase() === 'h') { e.preventDefault(); setPathHighlight(s=>!s) }
			if (e.key === '/') { e.preventDefault(); ruleFilterRef.current?.focus() }
			if (e.key.toLowerCase() === 'e') { setSelectedEdgeIndex(null); onInfo?.('Cleared edge selection'); onEdgeSelect?.(null) }
			// cycle arguments with [ and ]
			if (e.key === '[' || e.key === ']') {
				e.preventDefault()
				if (!argumentIds.length) return
				const idx = selectedArgumentId ? Math.max(0, argumentIds.indexOf(selectedArgumentId)) : -1
				const nextIdx = e.key === ']' ? (idx + 1) % (argumentIds.length + 1) : (idx - 1 + (argumentIds.length + 1)) % (argumentIds.length + 1)
				const nextArg = nextIdx === argumentIds.length ? null : argumentIds[nextIdx]
				setSelectedArgumentId(nextArg)
				if (storageKey) { try { if (nextArg) localStorage.setItem(`xv_argument_${storageKey}`, nextArg); else localStorage.removeItem(`xv_argument_${storageKey}`) } catch {} }
				onInfo?.(nextArg ? `Focused ${nextArg}` : 'Overview')
			}
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [simulationMode, setSimulationMode, resetStates, onInfo, frozen, showEdgeLabels, onEdgeSelect, selectedArgumentId, argumentIds, storageKey])

	// init persisted filter/toggles per expression
	useEffect(() => {
		if (!storageKey) return
		try {
			const rf = localStorage.getItem(`xv_ruleFilter_${storageKey}`)
			if (rf !== null) setRuleFilter(rf)
			const hn = localStorage.getItem(`xv_hideNonPath_${storageKey}`)
			if (hn === '1') setHideNonPath(true)
		} catch {}
	}, [storageKey])

	useEffect(() => {
		if (!storageKey) return
		try { localStorage.setItem(`xv_ruleFilter_${storageKey}`, ruleFilter) } catch {}
	}, [ruleFilter, storageKey])

	useEffect(() => {
		if (!storageKey) return
		try { localStorage.setItem(`xv_hideNonPath_${storageKey}`, hideNonPath ? '1' : '0') } catch {}
	}, [hideNonPath, storageKey])

	useEffect(() => {
		if (centerOnSelectionTrigger && selectedNodeId) {
			centerOnSelection()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [centerOnSelectionTrigger])

	useEffect(() => {
		if (centerOnNodeId) centerOnNode(centerOnNodeId)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [centerOnNodeId])

	useEffect(() => {
		if (typeof centerOnNodeTrigger === 'number' && centerOnNodeId) {
			centerOnNode(centerOnNodeId)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [centerOnNodeTrigger])

	useEffect(() => {
		// Create SVG root and <g> container once
		if (!elementRef.current || svgRef.current) return
		const svg = d3
			.select(elementRef.current)
			.append('svg')
			.attr('class', 'd3-container')
			.attr('width', size.width || 800)
			.attr('height', size.height || 500)
		svgRef.current = svg.node() as SVGSVGElement

		const g = svg.append('g')
		gRef.current = g.node() as SVGGElement

		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.1, 2])
			.on('zoom', ({ transform }) => {
				transformRef.current = transform
				g.attr('transform', transform.toString())
				// zoom-aware font scaling for labels
				g.selectAll('text').each(function () {
					const base = Number((this as SVGTextElement).getAttribute('data-base-size') || '10')
					d3.select(this).attr('font-size', Math.max(8, base / transform.k))
				})
				// zoom-aware link thickness
				g.selectAll<any, any>('g.links line').attr('stroke-width', (d: any) => {
					const base = Math.sqrt(((d?.weight ?? 20) / 10))
					return Math.max(0.75, base / transform.k)
				})
				// hide short labels when zoomed out or too short
				g.selectAll<any, any>('g.link-label').attr('opacity', (d: any) => {
					const sx = (d.source as any)?.x ?? 0, sy = (d.source as any)?.y ?? 0
					const tx = (d.target as any)?.x ?? 0, ty = (d.target as any)?.y ?? 0
					const len = Math.hypot(tx - sx, ty - sy)
					const k = transform.k || 1
					return len * k < 80 ? 0 : 1
				})
				// at extreme zoom-out, do not render labels at all for performance/clarity
				const show = transform.k >= 0.4
				g.selectAll<any, any>('g.link-label').attr('display', show ? null : 'none')
				g.selectAll<any, any>('g.link-paths text.curved-label').attr('display', show ? null : 'none')
				// soften badge stroke when zoomed out
				g.selectAll<any, any>('g.link-label rect.link-badge').attr('stroke-opacity', Math.min(0.9, Math.max(0.3, 1 / (transform.k + 0.2))))
			})
		zoomRef.current = zoom
		svg.call(zoom as any)
		svg.on('dblclick', (event: any) => { event.preventDefault(); fitToContents() })

		return () => {
			d3.select(svgRef.current).remove()
			svgRef.current = null
			gRef.current = null
			zoomRef.current = null
		}
	}, [elementRef])

	// minimap click-to-center
	useEffect(() => {
		if (!miniMapRef.current || !svgRef.current || !zoomRef.current) return
		const el = miniMapRef.current
		const onClick = (e: MouseEvent) => {
			if (!mmBoundsRef.current) return
			const rect = el.getBoundingClientRect()
			const mx = e.clientX - rect.left
			const my = e.clientY - rect.top
			const { minX, minY, sx, sy } = mmBoundsRef.current
			const worldX = minX + mx / sx
			const worldY = minY + my / sy
			const width = size.width || 800
			const height = (size.height || 560) - 56
			const k = transformRef.current.k || 1
			const transform = d3.zoomIdentity.translate(width / 2, height / 2).scale(k).translate(-worldX, -worldY)
			if (zoomRef.current) {
				d3.select(svgRef.current).transition().duration(200).call(zoomRef.current.transform as any, transform)
			}
			onInfo?.('Centered via minimap')
		}
		el.addEventListener('click', onClick)
		return () => el.removeEventListener('click', onClick)
	}, [miniMapRef, mmBoundsRef, size, onInfo])

	useEffect(() => {
		if (!svgRef.current || !gRef.current) return
		const svg = d3.select(svgRef.current)
		const g = d3.select(gRef.current)

		const width = size.width || 800
		const height = (size.height || 560) - 56 // reserve space for controls if any
		svg.attr('width', width).attr('height', height + 56)

		// clear content
		g.selectAll('*').remove()

		// defs for arrowheads (typed in a way TS is happy with)
		const defsSel = svg.select('defs')
		const defs = defsSel.empty() ? svg.append('defs') : defsSel
		let marker = defs.select<SVGMarkerElement>('marker#arrow')
		if (marker.empty()) {
			marker = defs.append('marker').attr('id', 'arrow')
		}
		marker
			.attr('viewBox', '0 -5 10 10')
			.attr('refX', 16)
			.attr('refY', 0)
			.attr('markerWidth', 6)
			.attr('markerHeight', 6)
			.attr('orient', 'auto')
		const arrowPath = marker.select('path')
		if (arrowPath.empty()) {
			marker.append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#66c')
		} else {
			arrowPath.attr('d', 'M0,-5L10,0L0,5').attr('fill', '#66c')
		}

		// zones
		const zonesToUseRaw = zones && zones.length ? zones : defaultZones
		const zonesToUse = (zonesToUseRaw as any[]).filter(z => (z.id !== 'informal' || showInformalZone) && (z.id !== 'temporal' || showTemporalZone))
		if (debug) console.log('[ZLFN] zonesToUse', zonesToUse.map((z:any)=>z.id))
		if (debug) {
			const t = (nodes as any[]).filter(n => (n.zoneId || n.zone) === 'terms')
			const ys = t.map(n => n.y).filter((v:any)=> typeof v === 'number') as number[]
			if (ys.length) {
				const minY = Math.min(...ys), maxY = Math.max(...ys)
				console.log('[ZLFN] Terms pre-sim Y-range:', minY.toFixed(1), '→', maxY.toFixed(1), 'n=', ys.length)
			}
		}
		const zoneGroup = g.append('g').attr('class', 'zones')
		zoneGroup
			.selectAll('.zone')
			.data(zonesToUse)
			.join('rect')
			.attr('class', 'zone')
			.attr('x', (d: any) => d.xRange[0])
			.attr('y', (d: any) => d.yRange[0])
			.attr('width', (d: any) => d.xRange[1] - d.xRange[0])
			.attr('height', (d: any) => d.yRange[1] - d.yRange[0])
			.attr('fill', (d: any) => d.color)
			.attr('fill-opacity', 0.08)
			.attr('stroke', (d: any) => d.color)
			.attr('stroke-opacity', 0.25)
			.attr('stroke-width', 2)
			.attr('rx', 8)

		zoneGroup
			.selectAll('.zone-label')
			.data(zonesToUse)
			.join('text')
			.attr('class', 'zone-label')
			.attr('x', (d: any) => (d.xRange[0] + d.xRange[1]) / 2)
			.attr('y', (d: any) => d.yRange[0] - 10)
			.attr('text-anchor', 'middle')
			.attr('fill', (d: any) => d.color)
			.attr('data-base-size', 12)
			.attr('font-weight', 'bold')
			.text((d: any) => d.name)

		// map for zone lookup and default assignment for nodes without zone
		const zoneById = new Map<string, ZlfnZone>((zonesToUse as any[]).map((z: any) => [z.id, z]))
		for (const n of nodes as any[]) {
			if (!n.zone && !n.zoneId && n.type) {
				if (n.type === 'premise') n.zone = 'premises'
				else if (n.type === 'term') n.zone = 'terms'
				else if (n.type === 'conclusion') n.zone = 'conclusions'
				else if (n.type === 'fallacy') n.zone = 'fallacies'
				else if (n.type === 'informal') n.zone = 'informal'
				else if (n.type === 'temporal') n.zone = 'temporal'
			}
		}

		// argument selector badges in Arguments zone
		const argBadges = (argumentIds || []).map((aid: string) => ({
			id: `__arg_${aid}`,
			label: aid,
			zone: 'arguments',
			type: 'core' as const,
			size: { width: 84, height: 22 },
			color: aid === selectedArgumentId ? '#ffd740' : '#9e9e9e'
		}))
		const zoneAllowed = new Set(zonesToUse.map((z:any)=>z.id))
		const filteredNodes = (nodes as any[]).filter(n => (!n.zone && !n.zoneId) ? true : zoneAllowed.has((n.zoneId || n.zone) as any))
		const nodesWithArgs: any[] = [...filteredNodes, ...argBadges]

		// seed or repair Terms positions if they are coincident (stacking) or uninitialized
		;(function seedOrRepairTerms() {
			const termsZone = zoneById.get('terms')
			if (!termsZone) return
			const left = termsZone.xRange[0] + 30
			const right = termsZone.xRange[1] - 30
			const midY = (termsZone.yRange[0] + termsZone.yRange[1]) / 2
			const terms = (nodesWithArgs as any[]).filter(n => (n.zoneId || n.zone) === 'terms')
			if (!terms.length) return
			const keyOf = (n: any) => `${Math.round((n.x ?? -9999)*10)},${Math.round((n.y ?? -9999)*10)}`
			const counts = new Map<string, number>()
			let uninit = 0
			for (const n of terms) { if (typeof n.x !== 'number' || typeof n.y !== 'number') uninit++; const k = keyOf(n); counts.set(k, (counts.get(k)||0)+1) }
			const hasStacking = Array.from(counts.values()).some(v => v > 1)
			if (uninit || hasStacking) {
				const step = (right - left) / (terms.length + 1)
				terms.forEach((n, i) => {
					n.x = left + step * (i + 1)
					n.y = midY + ((i % 2 === 0) ? -6 : 6)
				})
				if (debug) console.log('[ZLFN] Seeded Terms positions', { count: terms.length, uninit, hasStacking })
			}
		})()

		// derive edges for d3 (source/target)
		const nodeIdSet = new Set((nodesWithArgs as any[]).map(n => n.id))
		const linkData = edges
			.filter(e => nodeIdSet.has((e.from ?? e.source) as any) && nodeIdSet.has((e.to ?? e.target) as any))
			.map(e => ({
				source: (e.from ?? e.source) as string,
				target: (e.to ?? e.target) as string,
				...e
			})) as Array<{ source: string; target: string } & ZlfnEdge>

		// build clusters (simple: group by rule+type priority=1 first)
		const clusters = d3.groups(linkData, (d: any) => `${(d.rule || d.label || 'edge')}-${d.type || 'semantic'}`)

		const linkColor = (d: ZlfnEdge) => d.color || (d.type === 'counterexample' ? '#ff6b6b' : d.type === 'bidirectional' ? '#b388ff' : d.type === 'implication' ? '#66c' : '#7aa')
		const nodeColor = (d: ZlfnNode) => d.color || '#5ad'
		const ruleColor = (rule?: string) => {
			if (!rule) return '#40c4ff'
			if (rule.includes('Modus Ponens')) return '#00e676'
			if (rule.includes('Modus Tollens')) return '#ff9800'
			if (rule.includes('De Morgan')) return '#ff4081'
			if (rule.includes('Contraposition')) return '#b388ff'
			if (rule.includes('Double Negation')) return '#80cbc4'
			if (rule.includes('Distributivity')) return '#ffd54f'
			return '#40c4ff'
		}

		// load layout once per storageKey to avoid overwriting positions on every toggle
		const layoutKey = storageKey ? `xv_layout_${storageKey}` : null
		let saved: Record<string, { x: number; y: number }> | null = null
		if (layoutKey && layoutLoadedRef.current !== layoutKey) {
			try { saved = JSON.parse(localStorage.getItem(layoutKey) || 'null') } catch { saved = null }
			if (saved) {
				let applied = 0
				for (const n of nodes as any[]) {
					const pos = saved[n.id]
					if (pos) { n.x = pos.x; n.y = pos.y; applied++ }
				}
				if (debug) console.log('[ZLFN] Loaded saved layout positions:', applied)
			}
			layoutLoadedRef.current = layoutKey
		}

		// helper: radius for collision based on node size
		const radiusFor = (nd: any) => {
			if (nd.size && 'radius' in nd.size) return (nd.size.radius as number)
			const w = (nd.size?.width ?? 100) / 2
			const h = (nd.size?.height ?? 30) / 2
			return Math.hypot(w, h)
		}

		// custom boundary repel force
		function boundaryRepel(threshold = 20, strength = 0.2) {
			let arr: any[] = []
			function force() {
				for (const d of arr) {
					const zid = (d.zoneId || d.zone) as string | undefined
					const z = zid ? zoneById.get(zid) : undefined
					if (!z) continue
					const left = z.xRange[0], right = z.xRange[1], top = z.yRange[0], bottom = z.yRange[1]
					if (d.x != null && d.y != null) {
						const dl = (d.x - left)
						const dr = (right - d.x)
						const dt = (d.y - top)
						const db = (bottom - d.y)
						if (dl < threshold) d.vx += (strength * (threshold - dl)) / threshold
						if (dr < threshold) d.vx -= (strength * (threshold - dr)) / threshold
						if (dt < threshold) d.vy += (strength * (threshold - dt)) / threshold
						if (db < threshold) d.vy -= (strength * (threshold - db)) / threshold
					}
				}
			}
			force.initialize = (nodesIn: any[]) => { arr = nodesIn }
			return force as d3.Force<any, any>
		}

		// rectangle-aware collision force
		function boxCollide(padding = 6, strength = 0.7) {
			let arr: any[] = []
			const halfW = (nd: any) => (nd.size && 'radius' in nd.size) ? (nd.size.radius as number) : ((nd.size?.width ?? 100) / 2)
			const halfH = (nd: any) => (nd.size && 'radius' in nd.size) ? (nd.size.radius as number) : ((nd.size?.height ?? 30) / 2)
			function force() {
				const qt = d3.quadtree(arr, (d: any) => d.x, (d: any) => d.y)
				for (const d of arr) {
					const w1 = halfW(d) + padding, h1 = halfH(d) + padding
					qt.visit((quad: any, x1: number, y1: number, x2: number, y2: number) => {
						const qd = quad.data
						if (qd && qd !== d) {
							const w2 = halfW(qd) + padding, h2 = halfH(qd) + padding
							const dx = (qd.x as number) - (d.x as number)
							const dy = (qd.y as number) - (d.y as number)
							if (Math.abs(dx) < w1 + w2 && Math.abs(dy) < h1 + h2) {
								const ox = (w1 + w2) - Math.abs(dx)
								const oy = (h1 + h2) - Math.abs(dy)
								if (ox < oy) {
									const sx = Math.sign(dx) || 1
									const m = (ox / 2) * strength * 0.01
									qd.vx += sx * m; d.vx -= sx * m
								} else {
									const sy = Math.sign(dy) || 1
									const m = (oy / 2) * strength * 0.01
									qd.vy += sy * m; d.vy -= sy * m
								}
							}
						}
						return x1 > (d.x as number) + w1 + padding || x2 < (d.x as number) - w1 - padding || y1 > (d.y as number) + h1 + padding || y2 < (d.y as number) - h1 - padding
					})
				}
			}
			force.initialize = (nodesIn: any[]) => { arr = nodesIn }
			return force as d3.Force<any, any>
		}

		// extra repulsion inside the Terms zone to avoid stacking when other zones are shown
		function termsRepel(strength = 0.6) {
			let arr: any[] = []
			function force() {
				for (let i = 0; i < arr.length; i++) {
					const a = arr[i]
					const za = (a.zoneId || a.zone) as string | undefined
					if (za !== 'terms') continue
					for (let j = i + 1; j < arr.length; j++) {
						const b = arr[j]
						const zb = (b.zoneId || b.zone) as string | undefined
						if (zb !== 'terms') continue
						const dx = (b.x as number) - (a.x as number)
						const dy = (b.y as number) - (a.y as number)
						const dist2 = dx * dx + dy * dy || 1
						const min = (Math.max(20, ((a.size?.height ?? 30) + (b.size?.height ?? 30)) / 2))
						if (dist2 < min * min) {
							const inv = (min / Math.sqrt(dist2)) * (strength * 0.03)
							a.vx -= dx * inv; a.vy -= dy * inv
							b.vx += dx * inv; b.vy += dy * inv
						}
					}
				}
			}
			force.initialize = (nodesIn: any[]) => { arr = nodesIn }
			return force as d3.Force<any, any>
		}

		// spread Terms horizontally within its zone to avoid vertical stacking
		function termsSpreadForce(active: boolean, baseStrength = 0.10) {
			let arr: any[] = []
			function force(alpha: number) {
				if (!active) return
				const z = zoneById.get('terms')
				if (!z) return
				const left = z.xRange[0] + 30
				const right = z.xRange[1] - 30
				const midY = (z.yRange[0] + z.yRange[1]) / 2
				const terms = arr.filter(n => (n.zoneId || n.zone) === 'terms')
				const step = terms.length ? (right - left) / (terms.length + 1) : 0
				terms.forEach((n, i) => {
					const targetX = left + step * (i + 1)
					const k = baseStrength * alpha
					n.vx += (targetX - (n.x as number)) * k
					n.vy += (midY - (n.y as number)) * (k * 0.8)
				})
			}
			force.initialize = (nodesIn: any[]) => { arr = nodesIn }
			return force as d3.Force<any, any>
		}

		// custom force: hold Terms near their baseline Y captured on toggle
		function termsHoldYForce(active: boolean, baseStrength = 0.2) {
			let arr: any[] = []
			function force(alpha: number) {
				if (!active) return
				const k = baseStrength * alpha
				const baseline = termsBaselineYRef.current
				for (const n of arr) {
					const zid = (n.zoneId || n.zone) as string | undefined
					if (zid !== 'terms') continue
					const by = baseline[n.id]
					if (typeof by === 'number' && typeof n.y === 'number') {
						n.vy += (by - n.y) * k
					}
				}
			}
			force.initialize = (nodesIn: any[]) => { arr = nodesIn }
			return force as d3.Force<any, any>
		}

		const simulation = d3.forceSimulation(nodesWithArgs as any)
			.velocityDecay(0.25)
			.force('link', d3.forceLink(linkData as any).id((d: any) => d.id).distance(100))
			.force('charge', d3.forceManyBody().strength(-360).distanceMin(10).distanceMax(200))
			.force('center', d3.forceCenter(width / 2, height / 2))
			.force('collision', d3.forceCollide().radius((d: any) => radiusFor(d) + 20).strength(1.0).iterations(6))
			.force('boxCollide', boxCollide(8, 1.15))
			.force('termsRepel', termsRepel( showInformalZone && showTemporalZone ? 1.3 : 0.7 ))
			.force('termsSpread', termsSpreadForce(showInformalZone && showTemporalZone, 0.16))
			// hold Terms vertically when either toggle is on to prevent upward drift
			.force('termsHoldY', termsHoldYForce((showInformalZone || showTemporalZone), 0.25))
			.force('zoneX', d3.forceX().x((d: any) => {
				const zid = (d.zoneId || d.zone) as string | undefined
				const z = zid ? zoneById.get(zid) : undefined
				if (z) { return (z.xRange[0] + z.xRange[1]) / 2 }
				return (width / 2)
			}).strength(0.14))
			// slightly reduce vertical pull to zone centers to minimize "rising" on toggle
			.force('zoneY', d3.forceY().y((d: any) => {
				const zid = (d.zoneId || d.zone) as string | undefined
				const z = zid ? zoneById.get(zid) : undefined
				if (z) { return (z.yRange[0] + z.yRange[1]) / 2 }
				return (height / 2)
			}).strength(0.08))
			.force('boundary', boundaryRepel(28, 0.28))
		if (debug) console.log('[ZLFN] simulation init with nodes=', (nodesWithArgs as any[]).length)
		simulationRef.current = simulation

		// links
		const linksGroup = g.append('g').attr('class', 'links')
		const link = linksGroup
			.selectAll('line')
			.data(linkData)
			.join('line')
			.attr('stroke', linkColor)
			.attr('stroke-opacity', 0.6)
			.attr('stroke-width', d => Math.sqrt((d.weight ?? 20) / 10))
			.attr('stroke-dasharray', d => (d.style === 'dashed' ? '5,5' : d.style === 'dotted' ? '2,2' : null))
			.attr('marker-end', (d: any) => (d.type === 'counterexample' ? null : 'url(#arrow)'))
			.attr('marker-start', (d: any) => (d.type === 'bidirectional' ? 'url(#arrow)' : null))
			.on('mouseover', (event, d) => {
				if (!d.rule && !d.weight && !d.type) return
				setTooltip({
					x: event.pageX + 10,
					y: event.pageY - 10,
					html: `<strong>${d.rule ?? 'Edge'}</strong><br/>${d.type ?? ''} ${d.weight ? `(${d.weight}%)` : ''}`
				})
			})
			.on('mouseout', () => setTooltip(null))
			.on('click', function (this: any) {
				const parent = this && this.parentNode as SVGGElement | null
				if (!parent) return
				const nodes = parent.querySelectorAll('line')
				const idx = Array.prototype.indexOf.call(nodes, this)
				setSelectedEdgeIndex(idx)
				onInfo?.('Edge selected')
				const edge = linkData[idx]
				if (edge) onEdgeSelect?.(edge)
			})

		// flow rivers (clustered dependencies) behind links
		const riversGroup = g.append('g').attr('class', 'flow-rivers').attr('pointer-events','none').attr('display', showRivers ? null : 'none')
		// keep rivers behind links
		riversGroup.lower()

		// curved edge labels removed (redundant with badge labels)

		// edge labels with background
		const linkLabelG = linksGroup
			.selectAll('g.link-label')
			.data(linkData)
			.join(enter => {
				const g = enter.append('g').attr('class', 'link-label')
				g.append('rect')
					.attr('class', 'link-badge')
					.attr('rx', 3)
					.attr('ry', 3)
					.attr('fill', 'url(#badgeGrad)')
					.attr('stroke', (d: any) => ruleColor(d.rule || d.label))
					.attr('stroke-opacity', 0.8)
				g.append('text')
					.attr('fill', '#e0e6ff')
					.attr('data-base-size', 10)
					.attr('text-anchor', 'middle')
					.text(d => {
						const t = d.rule || d.label || ''
						return t.length > 24 ? (t.slice(0, 21) + '…') : t
					})
				g.append('title').text(d => d.rule || d.label || '')
				// status dot (left side)
				g.append('circle')
					.attr('class', 'status-dot')
					.attr('r', 3)
					.attr('cx', -10)
					.attr('cy', -2)
					.attr('fill', (d:any) => {
						if (d.type === 'counterexample') return '#ff5252'
						const w = d.weight ?? 0
						return w >= 70 ? '#00e676' : w <= 30 ? '#ff8a80' : '#ffd740'
					})
				return g
			})
		linkLabelG.attr('display', showEdgeLabels ? null : 'none')
		linkLabelG
			.on('mouseover', (event: any, d: any) => {
				const rule = d.rule || d.label || 'Edge'
				const type = d.type ? `Type: ${d.type}` : ''
				const w = d.weight != null ? `Weight: ${d.weight}%` : ''
				setTooltip({ x: event.pageX + 10, y: event.pageY - 10, html: `<strong>${rule}</strong>${type || w ? '<br/>' : ''}${[type, w].filter(Boolean).join(' • ')}` })
				d3.select(event.currentTarget).select('rect.link-badge').attr('stroke-opacity', 1).attr('stroke-width', 2)
			})
			.on('mouseout', (event: any) => { setTooltip(null); d3.select(event.currentTarget).select('rect.link-badge').attr('stroke-opacity', 0.8).attr('stroke-width', 1) })
			.on('click', function (this: any) {
				const parent = this && this.parentNode as SVGGElement | null
				if (!parent) return
				const nodes = parent.querySelectorAll('g.link-label')
				const idx = Array.prototype.indexOf.call(nodes, this)
				setSelectedEdgeIndex(idx)
				onInfo?.('Edge selected')
				const edge = linkData[idx]
				if (edge) onEdgeSelect?.(edge)
			})

		// gradient for badge background
		let badgeGrad = defs.select<SVGLinearGradientElement>('linearGradient#badgeGrad')
		if (badgeGrad.empty()) {
			badgeGrad = defs.append('linearGradient').attr('id', 'badgeGrad')
			badgeGrad.attr('x1', '0%').attr('x2', '100%')
			badgeGrad.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(30,30,47,0.95)')
			badgeGrad.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(30,30,47,0.75)')
		}

		// nodes (group per node to allow shapes + labels)
		const nodesGroup = g.append('g').attr('class', 'nodes')
		const nodeEnter = nodesGroup
			.selectAll('g.node')
			.data(nodesWithArgs)
			.join('g')
			.attr('class', 'node')
			.style('cursor', 'pointer')
			.call(
				d3
					.drag<any, ZlfnNode>()
					.on('start', (event, d) => {
						if (((d as any).id && String((d as any).id).startsWith('__arg_')) || (d as any).zone === 'arguments') return
						if (!event.active) simulation.alphaTarget(0.3).restart()
						;(d as any).fx = (d as any).x
						;(d as any).fy = (d as any).y
					})
					.on('drag', (event, d) => {
						if (((d as any).id && String((d as any).id).startsWith('__arg_')) || (d as any).zone === 'arguments') return
						;(d as any).fx = event.x
						;(d as any).fy = event.y
					})
					.on('end', (event, d) => {
						if (((d as any).id && String((d as any).id).startsWith('__arg_')) || (d as any).zone === 'arguments') return
						if (!event.active) simulation.alphaTarget(0)
						if (!frozen) { (d as any).fx = null; (d as any).fy = null }
						// snap-to-grid (10px)
						if (typeof (d as any).x === 'number' && typeof (d as any).y === 'number') {
							(d as any).x = Math.round((d as any).x / 10) * 10;
							(d as any).y = Math.round((d as any).y / 10) * 10;
						}
					})
				)

		// shape
		nodeEnter.each(function (d) {
			const sel = d3.select(this)
			const active = simulationMode && nodeIdToActive[d.id]
			const isSelected = selectedNodeId === d.id
			const baseFill = nodeColor(d)
			const fill = active ? d3.color(baseFill)?.brighter(0.5)?.toString() || baseFill : baseFill
			if (d.size && 'radius' in d.size) {
				sel
					.append('circle')
					.attr('r', d.size.radius)
					.attr('fill', fill)
					.attr('stroke', isSelected ? '#ff4081' : '#fff')
					.attr('stroke-width', isSelected ? 3 : 2)
			} else {
				const w = (d.size as any)?.width ?? 100
				const h = (d.size as any)?.height ?? 30
				sel
					.append('rect')
					.attr('width', w)
					.attr('height', h)
					.attr('x', -w / 2)
					.attr('y', -h / 2)
					.attr('rx', 5)
					.attr('fill', fill)
					.attr('stroke', isSelected ? '#ff4081' : '#fff')
					.attr('stroke-width', isSelected ? 3 : 2)
			}
		})

		// label
		nodeEnter
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('dy', '0.35em')
			.attr('fill', '#fff')
			.attr('data-base-size', 10)
			.attr('font-weight', 'bold')
			.text(d => d.symbol || d.label || d.id)
		nodeEnter.append('text')
			.attr('class', 'pin-marker')
			.attr('y', -14)
			.attr('x', 12)
			.attr('text-anchor', 'middle')
			.attr('font-size', 10)
			.attr('fill', '#ffd54f')
			.text(d => pinnedIds.has(d.id) ? '📌' : '')
			.append('title').text('Toggle pin')

		// facet icons (venn, truth, timeline) with placeholder overlay
		const iconGroup = nodeEnter.append('g').attr('class', 'facet-icons').attr('transform', 'translate(-20,-18)')
		// venn icon
		iconGroup.append('circle').attr('r', 4).attr('cx', 0).attr('cy', 0).attr('fill', '#7ac7ff').attr('stroke', '#2aa4f4').style('cursor', 'pointer')
			.append('title').text('Open Venn facet')
		// truth table icon
		iconGroup.append('rect').attr('x', 8).attr('y', -4).attr('width', 8).attr('height', 8).attr('fill', '#c0c0c0').attr('stroke', '#888').style('cursor', 'pointer')
			.append('title').text('Open Truth Table facet')
		// timeline icon
		iconGroup.append('line').attr('x1', 18).attr('y1', 0).attr('x2', 26).attr('y2', 0).attr('stroke', '#aaa').attr('stroke-width', 2).style('cursor', 'pointer')
			.append('title').text('Open Timeline facet')
		// counter facet icon (small red triangle)
		iconGroup.append('path').attr('d', 'M 32,-5 L 38,5 L 26,5 Z').attr('fill', '#ff8a80').attr('stroke', '#ff5252').style('cursor', 'pointer')
			.append('title').text('Open Counter facet')

		function toggleFacetOverlay(this: any, type: 'venn'|'truth'|'timeline'|'counter') {
			const nodeGroup = (this as Element).closest('g.node') as SVGGElement | null
			const host = nodeGroup ? d3.select(nodeGroup) : d3.select(this.parentNode?.parentNode as SVGGElement)
			const existing = host.select('g.facet-overlay')
			if (!existing.empty()) { existing.remove(); return }
			const overlay = host.append('g').attr('class', 'facet-overlay').attr('aria-label', `${type} overlay`).attr('role', 'dialog')
			overlay.append('rect').attr('x', -90).attr('y', -70).attr('width', 180).attr('height', 120).attr('rx', 8).attr('fill', 'rgba(20,20,30,0.92)').attr('stroke', '#40c4ff')
			// overlay legend/help
			overlay.append('text').attr('x', -84).attr('y', -54).attr('fill', '#9fb8ff').attr('font-size', 10).text('Esc to close • Drag nodes normally')
			const onEsc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { overlay.remove(); window.removeEventListener('keydown', onEsc) } }
			window.addEventListener('keydown', onEsc)
			if (type === 'venn') {
				// derive simple 2-term relation from node datum
				const datum: any = (host.datum && host.datum()) || {}
				const label: string = (datum.symbol || datum.label || datum.id || '').toString()
				const op = /∧|\^|\band\b|&/.test(label) ? 'and' : (/∨|\bor\b|\|/.test(label) ? 'or' : (/→|->/.test(label) ? 'imp' : 'unknown'))
				const terms = (label.match(/[A-Za-z]+/g) || ['A','B']).slice(0,2)
				const A = terms[0] || 'A', B = terms[1] || 'B'
				// optional: parse a simple natural language rule from the node name/translation
				const parsed = parseVennRule((datum.name || datum.translation || '') as string)
				const shade = computeShading(parsed.kind)
				const gx = overlay.append('g').attr('transform', 'translate(-20,-20)')
				// base circles
				gx.append('circle').attr('cx', -20).attr('cy', 20).attr('r', 28).attr('fill', 'rgba(64,196,255,0.15)').attr('stroke', '#40c4ff')
				gx.append('circle').attr('cx', 20).attr('cy', 20).attr('r', 28).attr('fill', 'rgba(0,230,118,0.15)').attr('stroke', '#00e676')
				// labels
				gx.append('text').attr('x', -40).attr('y', 10).attr('fill', '#8ad7ff').attr('font-size', 11).text(A)
				gx.append('text').attr('x', 34).attr('y', 10).attr('fill', '#8ad7ff').attr('font-size', 11).text(B)
				// shading cue
				if (op === 'and') {
					gx.append('ellipse').attr('cx', 0).attr('cy', 20).attr('rx', 18).attr('ry', 12).attr('fill', 'rgba(0,230,118,0.35)')
					overlay.append('text').attr('x', -80).attr('y', 36).attr('fill', '#a0ffcf').attr('font-size', 11).text('Highlight: A ∩ B')
				} else if (op === 'or') {
					// union cue: subtle stroke emphasis around both
					gx.append('circle').attr('cx', -20).attr('cy', 20).attr('r', 28).attr('fill', 'none').attr('stroke', '#40c4ff').attr('stroke-width', 2.5).attr('stroke-opacity', 0.6)
					gx.append('circle').attr('cx', 20).attr('cy', 20).attr('r', 28).attr('fill', 'none').attr('stroke', '#00e676').attr('stroke-width', 2.5).attr('stroke-opacity', 0.6)
					overlay.append('text').attr('x', -80).attr('y', 36).attr('fill', '#cfe9ff').attr('font-size', 11).text('Highlight: A ∪ B')
				} else if (op === 'imp') {
					// implication cue: A subset of B
					gx.append('path').attr('d', 'M -32,8 L -6,8').attr('stroke', '#8ad7ff').attr('stroke-width', 2).attr('marker-end', 'url(#arrow)')
					overlay.append('text').attr('x', -80).attr('y', 36).attr('fill', '#ffd54f').attr('font-size', 11).text(`${A} ⊆ ${B} (cue)`)
				} else {
					overlay.append('text').attr('x', -80).attr('y', 36).attr('fill', '#e0e6ff').attr('font-size', 11).text('Venn preview')
				}
				// apply parsed shading hints
				if (shade.intersection) gx.append('ellipse').attr('cx', 0).attr('cy', 20).attr('rx', 14).attr('ry', 9).attr('fill', 'rgba(255,255,255,0.15)')
				if (shade.disjoint) gx.append('line').attr('x1', -40).attr('y1', 20).attr('x2', 40).attr('y2', 20).attr('stroke', '#ff8080').attr('stroke-dasharray', '4,3')
				// pass/fail badge
				if (parsed.kind) {
					const ok = parsed.kind !== 'no' // placeholder acceptance rule
					overlay.append('rect').attr('x', 54).attr('y', -68).attr('rx', 4).attr('width', 32).attr('height', 16).attr('fill', ok ? 'rgba(0,230,118,0.25)' : 'rgba(255,82,82,0.25)').attr('stroke', ok ? '#00e676' : '#ff5252')
					overlay.append('text').attr('x', 70).attr('y', -56).attr('fill', ok ? '#a0ffcf' : '#ffb3b3').attr('font-size', 10).text(ok ? 'Pass' : 'Fail')
				}
			} else if (type === 'timeline') {
				// simple timeline preview: axis with ticks and a highlighted interval
				const gtl = overlay.append('g').attr('transform', 'translate(-70, -10)')
				// axis
				gtl.append('line').attr('x1', 0).attr('y1', 40).attr('x2', 140).attr('y2', 40).attr('stroke', '#90caf9').attr('stroke-width', 1.5)
				// ticks
				const ticks = d3.range(0, 6).map(i => ({ x: i * 28, label: `t${i}` }))
				gtl.selectAll('line.tick')
					.data(ticks)
					.join('line')
					.attr('class', 'tick')
					.attr('x1', d => d.x)
					.attr('x2', d => d.x)
					.attr('y1', 34)
					.attr('y2', 46)
					.attr('stroke', '#90caf9')
					.attr('stroke-width', 1)
				gtl.selectAll('text.tlabel')
					.data(ticks)
					.join('text')
					.attr('class', 'tlabel')
					.attr('x', d => d.x)
					.attr('y', 56)
					.attr('fill', '#cfe9ff')
					.attr('font-size', 10)
					.attr('text-anchor', 'middle')
					.text(d => d.label)
				// highlighted interval
				gtl.append('rect')
					.attr('x', 28)
					.attr('y', 36)
					.attr('width', 56)
					.attr('height', 8)
					.attr('fill', 'rgba(255,215,64,0.35)')
					.attr('stroke', '#ffd740')
				overlay.append('text').attr('x', -80).attr('y', -50).attr('fill', '#e0e6ff').attr('font-size', 12).text('Timeline')
			} else if (type === 'counter') {
				// simple counter mini-graph: three small nodes with dashed red edges, pulsing
				const gc = overlay.append('g').attr('transform', 'translate(-40,-20)')
				const nodes = [
					{ x: 0, y: 40 }, { x: 50, y: 20 }, { x: 90, y: 44 }
				]
				gc.selectAll('circle.counter')
					.data(nodes)
					.join('circle')
					.attr('class', 'counter')
					.attr('r', 4)
					.attr('cx', d => d.x)
					.attr('cy', d => d.y)
					.attr('fill', '#ff8a80')
					.attr('stroke', '#ff5252')
				gc.selectAll('line.counter')
					.data([[0,1],[1,2]])
					.join('line')
					.attr('class', 'counter')
					.attr('x1', d => nodes[d[0]].x)
					.attr('y1', d => nodes[d[0]].y)
					.attr('x2', d => nodes[d[1]].x)
					.attr('y2', d => nodes[d[1]].y)
					.attr('stroke', '#ff5252')
					.attr('stroke-dasharray', '4,3')
					.attr('stroke-width', 1.5)
					.attr('opacity', 0.9)
					.transition()
					.duration(800)
					.ease(d3.easeSinInOut)
					.attr('opacity', 0.4)
					.on('end', function repeat() { d3.select(this).transition().duration(800).ease(d3.easeSinInOut).attr('opacity', 0.9).on('end', repeat) })
				overlay.append('text').attr('x', -80).attr('y', -50).attr('fill', '#ffb3b3').attr('font-size', 12).text('Counterarguments')
			} else {
				overlay.append('text').attr('x', -80).attr('y', -50).attr('fill', '#e0e6ff').attr('font-size', 12).text(type === 'truth' ? 'Truth table placeholder' : 'Timeline placeholder')
			}
			overlay.append('text').attr('x', 72).attr('y', -56).attr('fill', '#ff8080').attr('font-size', 12).style('cursor','pointer').text('×').on('click', () => overlay.remove())
			overlay.raise()
		}
		iconGroup.select('circle').on('click', function(event: any){ event.stopPropagation(); toggleFacetOverlay.call(this, 'venn') })
		iconGroup.select('rect').on('click', function(this: any, event: any, d: any){
			event.stopPropagation()
			// open page-level truth table for this node if symbol/label present
			const expr = (d && (d.symbol || d.label)) as string | undefined
			if (expr && onOpenTruthTable) { onOpenTruthTable(expr) }
			else { toggleFacetOverlay.call(this, 'truth') }
		})
		iconGroup.select('line').on('click', function(event: any){ event.stopPropagation(); toggleFacetOverlay.call(this, 'timeline') })
		iconGroup.select('path').on('click', function(event: any){ event.stopPropagation(); toggleFacetOverlay.call(this, 'counter') })

		nodeEnter
			.on('mouseover', (event, d) => {
				if (!d.name && !d.translation && !d.type) {
					setTooltip({ x: event.pageX + 10, y: event.pageY - 10, html: `<strong>${d.label ?? d.id}</strong>` })
					return
				}
				const type = d.type ? `<div>Type: ${d.type}</div>` : ''
				const name = d.name ? `<div>Name: ${d.name}</div>` : ''
				const symbol = d.symbol ? `<div>Symbol: ${d.symbol}</div>` : ''
				const html = `<strong>${d.name ?? d.id}</strong>${symbol}${name}${type}`
				setTooltip({
					x: event.pageX + 10,
					y: event.pageY - 10,
					html
				})
			})
			.on('mouseout', () => setTooltip(null))
			.on('click', (event, d) => {
				// handle argument selection from badges or argument-zone nodes
				if (((d as any).id && String((d as any).id).startsWith('__arg_')) || (d as any).zone === 'arguments') {
					const aid = ((d as any).argumentId as string | undefined) || (String((d as any).label || '').trim() || null)
					setSelectedArgumentId(prev => {
						const next = prev === aid ? null : aid
						if (storageKey) {
							try { if (next) localStorage.setItem(`xv_argument_${storageKey}`, next); else localStorage.removeItem(`xv_argument_${storageKey}`) } catch {}
						}
						return next
					})
					return
				}
				if (event && (event as any).ctrlKey) {
					// toggle pin on ctrl-click
					setPinnedIds(prev => {
						const next = new Set(prev)
						if (next.has(d.id)) { next.delete(d.id); (d as any).fx = null; (d as any).fy = null; onInfo?.('Unpinned') }
						else { next.add(d.id); (d as any).fx = (d as any).x; (d as any).fy = (d as any).y; onInfo?.('Pinned') }
						return next
					})
					return
				}
				setSelectedNodeId(selectedNodeId === d.id ? null : d.id)
				if (!simulationMode || d.type === 'core') return
				setNodeIdToActive(prev => {
					const toggled = { ...prev, [d.id]: !prev[d.id] }
					const next = evaluateInference(toggled, edges, modes)
					return next
				})
			})

		// click on pin marker toggles pin
		nodeEnter.selectAll('text.pin-marker').on('click', function(event: any, d: any){
			event.stopPropagation()
			setPinnedIds(prev => {
				const next = new Set(prev)
				if (next.has(d.id)) { next.delete(d.id); (d as any).fx = null; (d as any).fy = null; onInfo?.('Unpinned') }
				else { next.add(d.id); (d as any).fx = (d as any).x; (d as any).fy = (d as any).y; onInfo?.('Pinned') }
				return next
			})
		})

		// selection ring overlay
		const selectionRing = g.append('circle')
			.attr('class', 'selection-ring')
			.attr('fill', 'none')
			.attr('stroke', '#ff4081')
			.attr('stroke-width', 2)
			.attr('opacity', selectedNodeId ? 0.9 : 0)

		simulation.on('tick', () => {
			// early clamp Y within zone to avoid vertical drift before render
			d3.select(gRef.current)
				.selectAll<any, any>('g.nodes g.node')
				.each(function (nd: any) {
					const zid = (nd.zoneId || nd.zone) as string | undefined
					const z = zid ? zoneById.get(zid) : undefined
					if (!z) return
					const r = radiusFor(nd) + 6
					const top = z.yRange[0] + r
					const bottom = z.yRange[1] - r
					if (typeof nd.y === 'number') nd.y = Math.max(top, Math.min(bottom, nd.y))
				})
			// diagnostics for Terms stacking when both toggles are on
			if (debug) {
				tickRef.current += 1
				if (showInformalZone && showTemporalZone && (tickRef.current % 15 === 0)) {
					const terms = (nodesWithArgs as any[]).filter(n => (n.zoneId || n.zone) === 'terms')
					if (terms.length) {
						const ys = terms.map(n => Number(n.y || 0))
						const minY = Math.min(...ys), maxY = Math.max(...ys)
						const span = maxY - minY
						const nearPairs = terms.reduce((acc, a, i) => acc + terms.slice(i+1).filter(b => Math.abs((a.y||0)-(b.y||0)) < 4).length, 0)
						console.log('[ZLFN][diag] terms spanY=', span.toFixed(1), 'nearPairs<4px=', nearPairs, 'count=', terms.length)
					}
				}
			}
			// slight jitter to break symmetry
			nodesWithArgs.forEach((n: any, i: number) => { if (i % 7 === 0) { n.x += (Math.random()-0.5)*0.8; n.y += (Math.random()-0.5)*0.8 } })
			// actively resolve node-on-node overlaps (rectangle-aware)
			const nodesArr: any[] = nodesWithArgs as any
			const hW = (nd: any) => (nd.size && 'radius' in nd.size) ? (nd.size.radius as number) : ((nd.size?.width ?? 100) / 2)
			const hH = (nd: any) => (nd.size && 'radius' in nd.size) ? (nd.size.radius as number) : ((nd.size?.height ?? 30) / 2)
			const qt = d3.quadtree(nodesArr, (d: any) => d.x, (d: any) => d.y)
			nodesArr.forEach((a: any) => {
				const aw = hW(a) + 4, ah = hH(a) + 4
				qt.visit((quad: any, x1: number, y1: number, x2: number, y2: number) => {
					const b = quad.data
					if (b && b !== a) {
						const bw = hW(b) + 4, bh = hH(b) + 4
						let dx = (b.x as number) - (a.x as number)
						let dy = (b.y as number) - (a.y as number)
						if (Math.abs(dx) < aw + bw && Math.abs(dy) < ah + bh) {
							// minimal axis separation
							const ox = (aw + bw) - Math.abs(dx)
							const oy = (ah + bh) - Math.abs(dy)
							if (ox < oy) {
								const sx = Math.sign(dx) || (Math.random() < 0.5 ? -1 : 1)
								a.x -= (sx * ox) / 2
								b.x += (sx * ox) / 2
							} else {
								const sy = Math.sign(dy) || (Math.random() < 0.5 ? -1 : 1)
								// bias Terms separation slightly stronger vertically
								const aInTerms = ((a.zoneId || a.zone) === 'terms')
								const bInTerms = ((b.zoneId || b.zone) === 'terms')
								const factor = (aInTerms && bInTerms) ? 0.65 : 0.5
								a.y -= (sy * oy) * factor
								b.y += (sy * oy) * factor
							}
						}
					}
					return x1 > (a.x as number) + aw + 10 || x2 < (a.x as number) - aw - 10 || y1 > (a.y as number) + ah + 10 || y2 < (a.y as number) - ah - 10
				})
			})
			// clamp positions to zone boxes to strictly enforce boundaries (size-aware)
			const pad = 6
			d3.select(gRef.current)
				.selectAll<any, any>('g.nodes g.node')
				.each(function (nd: any) {
					const zid = (nd.zoneId || nd.zone) as string | undefined
					const z = zid ? zoneById.get(zid) : undefined
					if (!z) return
					const r = radiusFor(nd) + pad
					const left = z.xRange[0] + r
					const right = z.xRange[1] - r
					const top = z.yRange[0] + r
					const bottom = z.yRange[1] - r
					if (typeof nd.x === 'number') nd.x = Math.max(left, Math.min(right, nd.x))
					if (typeof nd.y === 'number') nd.y = Math.max(top, Math.min(bottom, nd.y))
				})
			link
				.attr('x1', (d: any) => (d.source as any).x)
				.attr('y1', (d: any) => (d.source as any).y)
				.attr('x2', (d: any) => (d.target as any).x)
				.attr('y2', (d: any) => (d.target as any).y)

			// update curved paths and decide label mode
			linkLabelG.attr('display', showEdgeLabels ? null : 'none')

			// collision-aware placement for short labels
			const placedCenters: Array<{ x: number; y: number }> = []
			linkLabelG
				.attr('transform', (d: any) => {
					const s = d.source as any, t = d.target as any
					const sx = s.x, sy = s.y, tx = t.x, ty = t.y
					const cx0 = (sx + tx) / 2
					const cy0 = (sy + ty) / 2 - 4
					let angle = (Math.atan2(ty - sy, tx - sx) * 180) / Math.PI
					if (angle > 90) angle -= 180
					if (angle < -90) angle += 180
					// normal
					const dx = tx - sx, dy = ty - sy
					const len = Math.hypot(dx, dy) || 1
					const nx = -dy / len, ny = dx / len
					const distTo = (px: number, py: number, qx: number, qy: number) => Math.hypot(px - qx, py - qy)
					const radFor = (nd: any) => {
						if (nd.size && 'radius' in nd.size) return nd.size.radius
						const w = (nd.size?.width ?? 100) / 2
						const h = (nd.size?.height ?? 30) / 2
						return Math.hypot(w, h)
					}
					const nearS = distTo(cx0, cy0, sx, sy) < radFor(s) + 12
					const nearT = distTo(cx0, cy0, tx, ty) < radFor(t) + 12
					let off = (nearS || nearT) ? 12 : 6
					// iterative nudge to avoid other labels and nodes
					const k = transformRef.current.k || 1
					const labelLen = ((d.rule || d.label || '').toString().length || 6) * (6 / k)
					const labelRadius = Math.max(10 / k, Math.min(80, labelLen / 2))
					let tries = 0
					let bestX = cx0 + nx * off
					let bestY = cy0 + ny * off
					while (tries < 5) {
						// avoid nodes
						const tooNearNode = (distTo(bestX, bestY, sx, sy) < radFor(s) + labelRadius) || (distTo(bestX, bestY, tx, ty) < radFor(t) + labelRadius)
						// avoid prior labels
						const tooNearLabel = placedCenters.some(c => distTo(bestX, bestY, c.x, c.y) < (labelRadius + 14 / k))
						if (!tooNearNode && !tooNearLabel) break
						off += 8
						// alternate side a bit for variety
						const side = (tries % 2 === 0) ? 1 : -1
						bestX = cx0 + nx * off * side
						bestY = cy0 + ny * off * side
						tries++
					}
					placedCenters.push({ x: bestX, y: bestY })
					return `translate(${bestX},${bestY}) rotate(${angle})`
				})

			linkLabelG.select('text').each(function () {
				const textEl = this as unknown as SVGTextElement
				const bbox = textEl.getBBox()
				const parent = textEl.parentNode as SVGGElement | null
				if (!parent) return
				d3.select(parent)
					.select('rect')
					.attr('x', -bbox.width / 2 - 8)
					.attr('y', -bbox.height + 2)
					.attr('width', bbox.width + 16)
					.attr('height', bbox.height + 4)
			})

			nodeEnter.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
			// update pin markers
			nodeEnter.selectAll('text.pin-marker').text((d: any) => pinnedIds.has(d.id) ? '📌' : '')

			// update minimap
			if (miniMapRef.current) {
				const mm = d3.select(miniMapRef.current)
				const mmW = 160, mmH = 110
				const positions: Array<{ x: number; y: number }> = []
				d3.select(gRef.current)
					.selectAll<any, any>('g.nodes g.node')
					.each(function (nd: any) { positions.push({ x: nd.x || 0, y: nd.y || 0 }) })
				if (positions.length) {
					const xs = positions.map(p => p.x)
					const ys = positions.map(p => p.y)
					const minX = Math.min(...xs), maxX = Math.max(...xs)
					const minY = Math.min(...ys), maxY = Math.max(...ys)
					const dx = maxX - minX || 1, dy = maxY - minY || 1
					const sx = mmW / dx, sy = mmH / dy
					mmBoundsRef.current = { minX, minY, sx, sy }
					mm.selectAll('*').remove()
					const gmm = mm.append('g')
					gmm.selectAll('circle')
						.data(positions)
						.join('circle')
						.attr('cx', p => ((p.x - minX) * sx))
						.attr('cy', p => ((p.y - minY) * sy))
						.attr('r', 2)
						.attr('fill', '#8ad7ff')
					// viewport rectangle
					const width = size.width || 800
					const height = (size.height || 560) - 56
					const inv = transformRef.current.invertX(0)
					const invY = transformRef.current.invertY(0)
					const invW = transformRef.current.invertX(width) - inv
					const invH = transformRef.current.invertY(height) - invY
					const rectX = ((inv - minX) * sx)
					const rectY = ((invY - minY) * sy)
					const rectW = Math.max(6, invW * sx)
					const rectH = Math.max(6, invH * sy)
					gmm.append('rect')
						.attr('x', rectX)
						.attr('y', rectY)
						.attr('width', rectW)
						.attr('height', rectH)
						.attr('fill', 'none')
						.attr('stroke', '#40c4ff')
						.attr('stroke-width', 1)
				}
			}

			// rule filter dimming
			const matches = (d: any) => {
				if (!ruleFilter.trim()) return true
				const t = (d.rule || d.label || '').toString().toLowerCase()
				return t.includes(ruleFilter.trim().toLowerCase())
			}
			linksGroup.selectAll<any, any>('line').attr('opacity', (d: any, i: number) => {
				const base = (matches(d) ? 1 : 0.15) * (pathHighlight ? 0.8 : 1)
				return selectedEdgeIndex === null ? base : (i === selectedEdgeIndex ? 1 : 0.1)
			}).attr('stroke-width', (d: any, i: number) => {
				const base = Math.sqrt((d.weight ?? 20) / 10)
				return i === selectedEdgeIndex ? base + 1.5 : base
			})
			linksGroup.selectAll<any, any>('g.link-label').attr('opacity', (d: any, i: number) => {
				const base = (matches(d) ? 1 : 0.15) * (pathHighlight ? 0.8 : 1)
				return selectedEdgeIndex === null ? base : (i === selectedEdgeIndex ? 1 : 0.1)
			})

			linkLabelG
				.attr('transform', (d: any) => {
					const s = d.source as any, t = d.target as any
					const sx = s.x, sy = s.y, tx = t.x, ty = t.y
					const cx = (sx + tx) / 2
					const cy = (sy + ty) / 2 - 4
					let angle = (Math.atan2(ty - sy, tx - sx) * 180) / Math.PI
					if (angle > 90) angle -= 180
					if (angle < -90) angle += 180
					// simple collision-aware offset: if label midpoint is near either node, nudge perpendicular
					const dx = tx - sx, dy = ty - sy
					const len = Math.hypot(dx, dy) || 1
					const nx = -dy / len, ny = dx / len
					const distTo = (px: number, py: number, qx: number, qy: number) => Math.hypot(px - qx, py - qy)
					const radFor = (nd: any) => {
						if (nd.size && 'radius' in nd.size) return nd.size.radius
						const w = (nd.size?.width ?? 100) / 2
						const h = (nd.size?.height ?? 30) / 2
						return Math.hypot(w, h)
					}
					const nearS = distTo(cx, cy, sx, sy) < radFor(s) + 12
					const nearT = distTo(cx, cy, tx, ty) < radFor(t) + 12
					const off = (nearS || nearT) ? 12 : 0
					const ox = cx + nx * off
					const oy = cy + ny * off
					return `translate(${ox},${oy}) rotate(${angle})`
				})
			linkLabelG.select('text').each(function () {
				const textEl = this as unknown as SVGTextElement
				const bbox = textEl.getBBox()
				const parent = textEl.parentNode as SVGGElement | null
				if (!parent) return
				d3.select(parent)
					.select('rect')
					.attr('x', -bbox.width / 2 - 8)
					.attr('y', -bbox.height + 2)
					.attr('width', bbox.width + 16)
					.attr('height', bbox.height + 4)
			})

			nodeEnter.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
			// update pin markers
			nodeEnter.selectAll('text.pin-marker').text((d: any) => pinnedIds.has(d.id) ? '📌' : '')

			// update minimap
			if (miniMapRef.current) {
				const mm = d3.select(miniMapRef.current)
				const mmW = 160, mmH = 110
				const positions: Array<{ x: number; y: number }> = []
				d3.select(gRef.current)
					.selectAll<any, any>('g.nodes g.node')
					.each(function (nd: any) { positions.push({ x: nd.x || 0, y: nd.y || 0 }) })
				if (positions.length) {
					const xs = positions.map(p => p.x)
					const ys = positions.map(p => p.y)
					const minX = Math.min(...xs), maxX = Math.max(...xs)
					const minY = Math.min(...ys), maxY = Math.max(...ys)
					const dx = maxX - minX || 1, dy = maxY - minY || 1
					const sx = mmW / dx, sy = mmH / dy
					mmBoundsRef.current = { minX, minY, sx, sy }
					mm.selectAll('*').remove()
					const gmm = mm.append('g')
					gmm.selectAll('circle')
						.data(positions)
						.join('circle')
						.attr('cx', p => ((p.x - minX) * sx))
						.attr('cy', p => ((p.y - minY) * sy))
						.attr('r', 2)
						.attr('fill', '#8ad7ff')
					// viewport rectangle
					const width = size.width || 800
					const height = (size.height || 560) - 56
					const inv = transformRef.current.invertX(0)
					const invY = transformRef.current.invertY(0)
					const invW = transformRef.current.invertX(width) - inv
					const invH = transformRef.current.invertY(height) - invY
					const rectX = ((inv - minX) * sx)
					const rectY = ((invY - minY) * sy)
					const rectW = Math.max(6, invW * sx)
					const rectH = Math.max(6, invH * sy)
					gmm.append('rect')
						.attr('x', rectX)
						.attr('y', rectY)
						.attr('width', rectW)
						.attr('height', rectH)
						.attr('fill', 'none')
						.attr('stroke', '#40c4ff')
						.attr('stroke-width', 1)
				}
			}

			// update selection ring position
			if (selectedNodeId) {
				let found: any = null
				d3.select(gRef.current).selectAll<any, any>('g.nodes g.node').each(function (nd: any) { if (nd.id === selectedNodeId) found = nd })
				if (found) {
					const x = found.x || 0, y = found.y || 0
					let radius = 26
					if (found.size && 'radius' in found.size) radius = (found.size.radius as number) + 8
					else {
						const w = (found.size?.width ?? 100) / 2
						const h = (found.size?.height ?? 30) / 2
						radius = Math.hypot(w, h) + 8
					}
					selectionRing.attr('cx', x).attr('cy', y).attr('r', radius).attr('opacity', 0.9)
				} else {
					selectionRing.attr('opacity', 0)
				}
			} else {
				selectionRing.attr('opacity', 0)
			}

			// update flow rivers per cluster
			const lineGen = d3
				.line<{ x: number; y: number }>()
				.x((d: any) => d.x)
				.y((d: any) => d.y)
				.curve(d3.curveCatmullRom.alpha(0.5))
			const rivers = riversGroup
				.selectAll<SVGPathElement, any>('path.river')
				.data(clusters)
				.join(
					enter => enter.append('path').attr('class', 'river').attr('fill', 'none').attr('stroke-opacity', 0.45).attr('stroke-linecap','round').attr('stroke-linejoin','round'),
					update => update,
					exit => exit.remove()
				)
			// update gradients and paths
			rivers.attr('display', showRiversRef.current ? null : 'none')
			  .each(function (entry: any, i: number) {
				const edgesIn = entry[1] as any[]
				if (!edgesIn.length) return
				// build representative path for cluster
				let pts = edgesIn.map(e => ({ x: (((e.source as any).x) + ((e.target as any).x)) / 2, y: (((e.source as any).y) + ((e.target as any).y)) / 2 }))
				// sort by x then y for a simple coherent path
				pts.sort((a: any, b: any) => (a.x - b.x) || (a.y - b.y))
				if (pts.length < 2) {
					const e0 = edgesIn[0]
					const sx = (e0.source as any).x || 0, sy = (e0.source as any).y || 0
					const tx = (e0.target as any).x || 0, ty = (e0.target as any).y || 0
					const mx = (sx + tx) / 2, my = (sy + ty) / 2
					pts = [{ x: sx, y: sy }, { x: mx, y: my }, { x: tx, y: ty }]
				}
				const pathD = lineGen(pts as any) || ''
				const color = ruleColor(edgesIn[0]?.rule || edgesIn[0]?.label)
				// gradient per river
				let grad = defs.select<SVGLinearGradientElement>(`linearGradient#riverGrad-${i}`)
				if (grad.empty()) {
					grad = defs.append('linearGradient').attr('id', `riverGrad-${i}`)
					grad.attr('x1', '0%').attr('x2', '100%')
					grad.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 0.25)
					grad.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0.5)
				}
				d3.select(this)
					.attr('d', pathD)
					.attr('stroke', `url(#riverGrad-${i})`)
					.attr('stroke-width', Math.max(8, Math.min(26, Math.sqrt(pts.length) * 6)))
			  })
		})

		// clusters (labels only, optional)
		const clustersGroup = g.append('g').attr('class', 'clusters')
		const clusterLabels = clustersGroup.selectAll('g.cluster-label').data(clusters)
			.join(enter => {
				const gl = enter.append('g').attr('class', 'cluster-label')
				gl.append('rect').attr('rx', 4).attr('ry', 4).attr('fill', 'rgba(20,30,50,0.8)').attr('stroke', '#66a6ff').attr('stroke-opacity', 0.6)
				gl.append('text').attr('fill', '#cfe9ff').attr('data-base-size', 10).attr('font-size', 10)
				return gl
			})
		function updateClusterLabels() {
			clusterLabels.attr('display', showClusters ? null : 'none')
			clusterLabels.each(function (entry: any) {
				const edgesIn = entry[1] as any[]
				if (!edgesIn.length) return
				let sumX = 0, sumY = 0, n = 0
				edgesIn.forEach(e => {
					const sx = (e.source as any).x || 0, sy = (e.source as any).y || 0
					const tx = (e.target as any).x || 0, ty = (e.target as any).y || 0
					sumX += (sx + tx) / 2
					sumY += (sy + ty) / 2
					n++
				})
				const cx = n ? sumX / n : 0, cy = n ? sumY / n : 0
				const rules = Array.from(new Set(edgesIn.map(e => e.rule || e.label).filter(Boolean)))
				const label = rules.length ? rules.join(', ') : 'Cluster'
				const gSel = d3.select(this as SVGGElement)
				gSel.attr('transform', `translate(${cx},${cy})`)
				const textSel = gSel.select('text').text(label)
				const bbox = (textSel.node() as SVGTextElement).getBBox()
				gSel.select('rect').attr('x', -bbox.width/2 - 6).attr('y', -bbox.height - 4).attr('width', bbox.width + 12).attr('height', bbox.height + 8)
				gSel.attr('role','group').attr('aria-label', `Cluster: ${label}`)
				// detailed tooltip with rule counts
				const counts = new Map<string, number>()
				for (const e of edgesIn) { const r = (e.rule || e.label || 'edge') as string; counts.set(r, (counts.get(r) || 0) + 1) }
				const lines: string[] = []
				counts.forEach((v, k) => lines.push(`${k}: ${v}`))
				gSel.select('title').remove()
				gSel.append('title').text(lines.join('\n'))
			})
		}
		updateClusterLabels()

		// legend panel (optional)
		if (showLegend) {
			const lg = g.append('g').attr('class', 'legend-panel')
			const panelW = 240, panelH = 128
			lg.attr('transform', `translate(${(width - panelW - 12)},${12})`)
			lg.append('rect').attr('rx', 8).attr('fill', 'rgba(20,30,50,0.92)').attr('stroke', '#66a6ff').attr('width', panelW).attr('height', panelH)
			lg.append('text').attr('x', 10).attr('y', 18).attr('fill', '#cfe9ff').attr('font-size', 12).text('Legend')
			// zones row
			const zr = lg.append('g').attr('transform', 'translate(10,30)')
			const items = [
				{ label: 'Premises', color: '#20B2AA' },
				{ label: 'Terms', color: '#4169E1' },
				{ label: 'Conclusions', color: '#9370DB' },
				{ label: 'Fallacies', color: '#DC143C' }
			]
			items.forEach((it, i) => {
				zr.append('rect').attr('x', i*56).attr('y', 0).attr('width', 10).attr('height', 10).attr('fill', it.color)
				zr.append('text').attr('x', i*56 + 14).attr('y', 9).attr('fill', '#cfe9ff').attr('font-size', 10).text(it.label)
			})
			const er = lg.append('g').attr('transform', 'translate(10,60)')
			er.append('line').attr('x1',0).attr('y1',0).attr('x2',36).attr('y2',0).attr('stroke','#7aa').attr('stroke-width',2)
			er.append('text').attr('x',40).attr('y',4).attr('fill','#cfe9ff').attr('font-size',10).text('semantic')
			er.append('line').attr('x1',100).attr('y1',0).attr('x2',136).attr('y2',0).attr('stroke','#7aa').attr('stroke-width',2).attr('stroke-dasharray','5,5')
			er.append('text').attr('x',140).attr('y',4).attr('fill','#cfe9ff').attr('font-size',10).text('dashed rule')
			const dr = lg.append('g').attr('transform','translate(10,86)')
			dr.append('rect').attr('x',0).attr('y',-9).attr('width',48).attr('height',16).attr('rx',3).attr('fill','rgba(30,30,47,0.9)').attr('stroke','#66a6ff')
			dr.append('circle').attr('cx',-6).attr('cy',-2).attr('r',3).attr('fill','#00e676')
			dr.append('text').attr('x',4).attr('y',2).attr('fill','#e0e6ff').attr('font-size',10).text('rule badge')
		}

		// minimize label overlap by hiding ones whose bbox overlaps another (simple pass)
		setTimeout(() => {
			if (!gRef.current) return
			const labels = d3.select(gRef.current).selectAll<SVGGElement, any>('g.link-label').nodes()
			const bboxes: DOMRect[] = []
			labels.forEach((n, i) => {
				const bb = (n.querySelector('rect') as SVGRectElement | null)?.getBBox()
				bboxes[i] = bb as DOMRect
			})
			labels.forEach((n, i) => {
				const bb = bboxes[i]
				if (!bb) return
				for (let j = 0; j < i; j++) {
					const bb2 = bboxes[j]
					if (!bb2) continue
					const overlap = !(bb.x > bb2.x + bb2.width || bb.x + bb.width < bb2.x || bb.y > bb2.y + bb2.height || bb.y + bb.height < bb2.y)
					if (overlap) {
						d3.select(n).attr('opacity', 0)
						break
					}
				}
			})
		}, 0)

		// glow filters for node states
		const ensureFilter = (id: string) => {
			let f = defs.select<SVGFilterElement>(`filter#${id}`)
			if (f.empty()) {
				f = defs.append('filter').attr('id', id).attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%')
				f.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', 3).attr('result', 'blur')
				f.append('feMerge').html('<feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/>')
			}
			defs.select(`#${id} feGaussianBlur`).attr('stdDeviation', 3)
			defs.select(`#${id} feMerge feMergeNode`).attr('in', 'blur')
			return f
		}
		ensureFilter('glow-true')
		ensureFilter('glow-false')

		// optional: compute status summary here if needed in future
		// (moved to a top-level effect)

		return () => {
			simulation.stop()
			simulationRef.current = null
		}
	}, [nodes, edges, zones, defaultZones, size, simulationMode, nodeIdToActive, selectedNodeId, setSelectedNodeId, storageKey, frozen, showEdgeLabels, pinnedIds, onInfo, ruleFilter, pathHighlight, selectedEdgeIndex, onEdgeSelect, onOpenTruthTable, showRivers, modes, showInformalZone, showTemporalZone, showLegend])

	// status summary (top-level effect)
	useEffect(() => {
		const { nodeStates, conflicts } = evaluateStates(nodeIdToActive, edges as any, modes)
		const activeCount = Object.values(nodeStates).filter(s => s.value === 'T' || (typeof s.value === 'number' && s.value >= 0.5)).length
		const conflictCount = conflicts.length
		setStatusText(`Active: ${activeCount} • Conflicts: ${conflictCount}`)
	}, [nodeIdToActive, edges, modes])

	useEffect(() => {
		if (!storageKey) return
		try { localStorage.setItem(`xv_pins_layout_${storageKey}`, JSON.stringify(Array.from(pinnedIds))) } catch {}
	}, [pinnedIds, storageKey])

	// update selection styling + state/conflict visuals without full redraw
	useEffect(() => {
		if (!gRef.current) return
		const g = d3.select(gRef.current)
		// compute node states/conflicts
		const { nodeStates, conflicts } = evaluateStates(nodeIdToActive, edges as any, modes)
		const conflictSet = new Set(conflicts)
		g.selectAll('.node')
			.selectAll('rect, circle')
			.attr('stroke', (d: any) => {
				if (conflictSet.has(d.id)) return '#ff5252'
				const val = nodeStates[d.id]?.value as any
				if (typeof val === 'number') return (val >= 0.7) ? '#00e676' : (val <= 0.3 ? '#ff5252' : '#fff')
				return (selectedNodeId === d.id ? '#ff4081' : '#fff')
			})
			.attr('stroke-width', (d: any) => conflictSet.has(d.id) ? 3 : (selectedNodeId === d.id ? 3 : 2))
			.attr('filter', (d: any) => (nodeStates[d.id]?.value === 'T') ? 'url(#glow-true)' : (nodeStates[d.id]?.value === 'F') ? 'url(#glow-false)' : null)
	}, [selectedNodeId, modes])

	// highlight paths from selected node and compute centroid
	useEffect(() => {
		if (!gRef.current) return
		const g = d3.select(gRef.current)
		const hasSel = !!selectedNodeId
		if (!hasSel) {
			g.selectAll('g.links line').attr('opacity', pathHighlight ? 0.5 : 1)
			g.selectAll('g.link-label').attr('opacity', pathHighlight ? 0.5 : 1)
			g.selectAll('g.nodes g.node').attr('opacity', pathHighlight ? 0.75 : 1)
			pathCentroidRef.current = null
			return
		}
		const adj = new Map<string, string[]>()
		for (const e of edges) {
			const s = (e.from ?? e.source) as string | undefined
			const t = (e.to ?? e.target) as string | undefined
			if (!s || !t) continue
			if (!adj.has(s)) adj.set(s, [])
			adj.get(s)!.push(t)
		}
		const reachable = new Set<string>()
		const distance = new Map<string, number>()
		const queue: string[] = []
		if (selectedNodeId) { reachable.add(selectedNodeId); distance.set(selectedNodeId, 0); queue.push(selectedNodeId) }
		while (queue.length) {
			const id = queue.shift()!
			for (const nxt of adj.get(id) || []) {
				if (!reachable.has(nxt)) { reachable.add(nxt); distance.set(nxt, (distance.get(id) || 0) + 1); queue.push(nxt) }
			}
		}
		g.selectAll('g.links line')
			.attr('opacity', (d: any) => (reachable.has(d.source) && reachable.has(d.target) ? 1 : 0.2))
			.attr('stroke-width', (d: any) => {
				const dist = Math.min(distance.get(d.source) ?? 0, distance.get(d.target) ?? 0)
				const base = Math.sqrt(((d.weight ?? 20) / 10))
				const width = dist === 0 ? base + 1.5 : dist === 1 ? base + 0.5 : base
				const k = transformRef.current.k || 1
				return Math.max(0.75, width / k)
			})
		g.selectAll('g.link-label').attr('opacity', (d: any) => (reachable.has(d.source) && reachable.has(d.target) ? 1 : 0.15))
		g.selectAll('g.nodes g.node').attr('opacity', (d: any) => (reachable.has(d.id) ? 1 : 0.25))
		// compute centroid of reachable nodes
		let sumX = 0, sumY = 0, count = 0
		d3.select(gRef.current)
			.selectAll<any, any>('g.nodes g.node')
			.each(function (d: any) {
				if (reachable.has(d.id)) { sumX += d.x || 0; sumY += d.y || 0; count++ }
			})
		pathCentroidRef.current = count ? { x: sumX / count, y: sumY / count } : null
	}, [selectedNodeId, edges])

	// isolate path effect
	useEffect(() => {
		if (!gRef.current) return
		const g = d3.select(gRef.current)
		if (!hideNonPath || !selectedNodeId) {
			g.selectAll('g.links line, g.links g.link-label, g.nodes g.node').attr('display', null)
			return
		}
		const reachable = new Set<string>([selectedNodeId])
		let changed = true
		while (changed) {
			changed = false
			for (const e of edges) {
				const src = (e.from ?? e.source) as string | undefined
				const tgt = (e.to ?? e.target) as string | undefined
				if (src && tgt && reachable.has(src) && !reachable.has(tgt)) { reachable.add(tgt); changed = true }
			}
		}
		g.selectAll<any, any>('g.nodes g.node').attr('display', (d: any) => reachable.has(d.id) ? null : 'none')
		g.selectAll<any, any>('g.links line').attr('display', (d: any) => (reachable.has((d.source as any).id) && reachable.has((d.target as any).id)) ? null : 'none')
		g.selectAll<any, any>('g.links g.link-label').attr('display', (d: any) => (reachable.has((d.source as any).id) && reachable.has((d.target as any).id)) ? null : 'none')
		g.selectAll<any, any>('g.link-paths text.curved-label').attr('display', (d: any) => (reachable.has((d.source as any).id) && reachable.has((d.target as any).id)) ? null : 'none')
	}, [hideNonPath, selectedNodeId, edges])

	// persist clusters toggle
	useEffect(() => {
		try { localStorage.setItem('xv_clusters', showClusters ? '1' : '0') } catch {}
	}, [showClusters])

	// persist rivers toggle
	useEffect(() => {
		try { localStorage.setItem('xv_rivers', showRivers ? '1' : '0') } catch {}
	}, [showRivers])

	// reflect rivers toggle without rebuild
	useEffect(() => {
		if (!gRef.current) return
		d3.select(gRef.current).select('g.flow-rivers').attr('display', showRivers ? null : 'none')
	}, [showRivers])

	// argument-based dimming/hiding
	useEffect(() => {
		if (!gRef.current) return
		const g = d3.select(gRef.current)
		if (!selectedArgumentId) {
			g.selectAll('g.nodes g.node').attr('opacity', 1).attr('display', null)
			g.selectAll('g.links line').attr('opacity', 1).attr('display', null)
			g.selectAll('g.link-label').attr('opacity', 1).attr('display', null)
			return
		}
		const idToArg = new Map<string, string | undefined>()
		for (const n of (nodes as any[])) { idToArg.set(n.id, n.argumentId) }
		g.selectAll<any, any>('g.nodes g.node').attr('opacity', (d: any) => {
			if ((d?.id && String(d.id).startsWith('__arg_'))) return 1
			const aid = d?.argumentId as string | undefined
			return (aid === selectedArgumentId) ? 1 : 0.2
		})
		// hide links/labels where either endpoint is filtered out
		g.selectAll<any, any>('g.links line').attr('opacity', (d: any) => {
			const sid = (d.source && (d.source.id || d.source)) as string | undefined
			const tid = (d.target && (d.target.id || d.target)) as string | undefined
			if (!sid || !tid) return 0.2
			const sa = idToArg.get(sid)
			const ta = idToArg.get(tid)
			return (sa === selectedArgumentId) && (ta === selectedArgumentId) ? 1 : 0.1
		})
		g.selectAll<any, any>('g.link-label').attr('opacity', (d: any) => {
			const sid = (d.source && (d.source.id || d.source)) as string | undefined
			const tid = (d.target && (d.target.id || d.target)) as string | undefined
			if (!sid || !tid) return 0.2
			const sa = idToArg.get(sid)
			const ta = idToArg.get(tid)
			return (sa === selectedArgumentId) && (ta === selectedArgumentId) ? 1 : 0.1
		})
	}, [selectedArgumentId, nodes])

	// helpers
	// const resetLayout = () => { simulationRef.current?.alpha(1).restart() }
	const fitToContents = () => {
		if (!svgRef.current || !gRef.current || !zoomRef.current) return
		const width = size.width || 800
		const height = (size.height || 560) - 56
		const nodesSel = d3.select(gRef.current).selectAll<SVGGElement, any>('g.nodes g.node')
		const data = nodesSel.data()
		if (!data || !data.length) return
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
		for (const d of data as any[]) {
			if (typeof d.x !== 'number' || typeof d.y !== 'number') continue
			minX = Math.min(minX, d.x)
			minY = Math.min(minY, d.y)
			maxX = Math.max(maxX, d.x)
			maxY = Math.max(maxY, d.y)
		}
		if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return
		const padding = 80
		const w = maxX - minX + padding
		const h = maxY - minY + padding
		const scale = Math.max(0.1, Math.min(2, Math.min(width / w, height / h)))
		const cx = (minX + maxX) / 2
		const cy = (minY + maxY) / 2
		const transform = d3.zoomIdentity.translate(width / 2, height / 2).scale(scale).translate(-cx, -cy)
		d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.transform as any, transform)
	}
	const centerOnSelection = () => {
		if (!svgRef.current || !gRef.current || !zoomRef.current || !selectedNodeId) return
		const width = size.width || 800
		const height = (size.height || 560) - 56
		let target: any = null
		d3.select(gRef.current)
			.selectAll<any, any>('g.nodes g.node')
			.each(function (d: any) {
				if (d.id === selectedNodeId) target = d
			})
		if (!target) return
		const k = transformRef.current.k || 1
		const transform = d3.zoomIdentity.translate(width / 2, height / 2).scale(k).translate(-target.x, -target.y)
		d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.transform as any, transform)
	}
	const centerOnNode = (id: string) => {
		if (!svgRef.current || !gRef.current || !zoomRef.current) return
		const width = size.width || 800
		const height = (size.height || 560) - 56
		let target: any = null
		d3.select(gRef.current)
			.selectAll<any, any>('g.nodes g.node')
			.each(function (d: any) { if (d.id === id) target = d })
		if (!target) return
		const k = transformRef.current.k || 1
		const transform = d3.zoomIdentity.translate(width / 2, height / 2).scale(k).translate(-target.x, -target.y)
		d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.transform as any, transform)
		setSelectedNodeId(id)
		onInfo?.(`Centered on ${id}`)
	}
	const centerOnPath = () => {
		if (!svgRef.current || !gRef.current || !zoomRef.current || !pathCentroidRef.current) return
		const width = size.width || 800
		const height = (size.height || 560) - 56
		const k = transformRef.current.k || 1
		const { x, y } = pathCentroidRef.current
		const transform = d3.zoomIdentity.translate(width / 2, height / 2).scale(k).translate(-x, -y)
		d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.transform as any, transform)
		onInfo?.('Centered on path')
	}
	const saveLayout = () => {
		if (!storageKey || !gRef.current) return
		const data: Record<string, { x: number; y: number }> = {}
		d3.select(gRef.current)
			.selectAll<any, any>('g.nodes g.node')
			.each(function (d: any) {
				if (typeof d.x === 'number' && typeof d.y === 'number') data[d.id] = { x: d.x, y: d.y }
			})
		try { localStorage.setItem(`xv_layout_${storageKey}`, JSON.stringify(data)); onInfo?.('Layout saved') } catch {}
	}
	// const clearLayout = () => { if (!storageKey) return; try { localStorage.removeItem(`xv_layout_${storageKey}`); onInfo?.('Layout cleared') } catch {} }
	const toggleFreeze = () => {
		setFrozen(prev => {
			const next = !prev
			if (gRef.current) {
				d3.select(gRef.current).selectAll<any, any>('g.nodes g.node').each(function (d: any) {
					if (next) { (d as any).fx = d.x; (d as any).fy = d.y } else { (d as any).fx = null; (d as any).fy = null }
				})
			}
			onInfo?.(next ? 'Layout frozen' : 'Layout unfrozen')
			return next
		})
	}
	// const togglePinSelected = () => { /* reserved */ }

	useEffect(() => { try { localStorage.setItem('xv_zone_informal', showInformalZone ? '1' : '0') } catch {} }, [showInformalZone])
	useEffect(() => { try { localStorage.setItem('xv_zone_temporal', showTemporalZone ? '1' : '0') } catch {} }, [showTemporalZone])

	useEffect(() => {
		// capture Terms baseline Y on zone toggle to hold vertical band
		if (gRef.current) {
			const baseline: Record<string, number> = { ...termsBaselineYRef.current }
			d3.select(gRef.current)
				.selectAll<any, any>('g.nodes g.node')
				.each(function (nd: any) {
					const zid = (nd.zoneId || nd.zone) as string | undefined
					if (zid === 'terms' && typeof nd.y === 'number' && typeof nd.id === 'string') {
						baseline[nd.id] = nd.y
					}
				})
			termsBaselineYRef.current = baseline
			if (debug) console.log('[ZLFN] captured Terms baselineY for', Object.keys(baseline).length, 'nodes')
		}
		if (simulationRef.current) { simulationRef.current.alpha(0.6).restart() }
	}, [showInformalZone, showTemporalZone])

	useEffect(() => {
		if (simulationRef.current) {
			// restart on zone toggle only
		}
	}, [])

	return (
		<div ref={elementRef} style={{ width: '100%', height: 560, position: 'relative' }}>
			<Stack direction="row" spacing={1} sx={{ position: 'absolute', top: 8, left: 8, zIndex: 2, flexWrap: 'wrap', alignItems: 'center', paddingRight: 6 }}>
				<Button aria-label="Toggle simulation mode" size="small" variant={simulationMode ? 'contained' : 'outlined'} onClick={() => {
					const next = !simulationMode
					setSimulationMode(next)
					if (!next) resetStates()
					onInfo?.(next ? 'Simulation enabled' : 'Simulation disabled')
				}}>
					Simulation
				</Button>
				<Button aria-label="Fit to contents" size="small" variant="outlined" onClick={fitToContents}>
					Fit
				</Button>
				<Button aria-label="Center on selection" size="small" variant="outlined" onClick={centerOnSelection} disabled={!selectedNodeId}>
					Center
				</Button>
				<Button aria-label="Path highlight" size="small" variant={pathHighlight ? 'contained' : 'outlined'} onClick={()=>{ setPathHighlight(s=>{ const next = !s; onInfo?.(next ? 'Path highlight on' : 'Path highlight off'); return next }) }}>
					Path Highlight
				</Button>
				<Button aria-label="Hierarchy mode" size="small" variant={hierarchyMode ? 'contained' : 'outlined'} onClick={()=>{ const next = !hierarchyMode; setHierarchyMode(next); try { localStorage.setItem('xv_hierarchy', next ? '1' : '0') } catch {}; onInfo?.(next ? 'Hierarchy mode on' : 'Hierarchy mode off') }}>Hierarchy</Button>
				<Button aria-label="Toggle clusters" size="small" variant={showClusters ? 'contained' : 'outlined'} onClick={()=> setShowClusters(s=>!s)}>Clusters</Button>
				<Button aria-label="Toggle rivers" size="small" variant={showRivers ? 'contained' : 'outlined'} onClick={()=> setShowRivers(s=>!s)}>Rivers</Button>
				<TextField size="small" placeholder="Filter rule" value={ruleFilter} onChange={(e)=>setRuleFilter(e.target.value)} inputRef={ruleFilterRef} sx={{ minWidth: 140, maxWidth: 220 }} />
				<Button aria-label="Clear filters" size="small" variant="outlined" onClick={()=>{ setRuleFilter(''); setPathHighlight(false); setHideNonPath(false); onInfo?.('Cleared filters') }}>Clear</Button>
				<IconButton aria-label="More options" size="small" onClick={openMenu}>
					<MoreVertIcon />
				</IconButton>
				{/* Modes legend */}
				<Stack direction="row" spacing={0.5} sx={{ ml: 1, alignItems: 'center' }}>
					{Object.entries(modes).filter(([,v]) => !!v).map(([k]) => (
						<Chip key={k} size="small" label={k} color="primary" variant="outlined" />
					))}
				</Stack>
				{/* Status summary */}
				<span style={{ marginLeft: 8, fontSize: 12, opacity: 0.8 }}>{statusText}</span>
				{/* Argument selector chips */}
				{argumentIds.length > 0 && (
					<Stack direction="row" spacing={0.5} sx={{ ml: 1, alignItems: 'center' }}>
						<Chip
							size="small"
							label={selectedArgumentId ? 'All' : 'Overview'}
							variant={selectedArgumentId ? 'outlined' : 'filled'}
							onClick={() => { setSelectedArgumentId(null); if (storageKey) { try { localStorage.removeItem(`xv_argument_${storageKey}`) } catch {} } }}
							title="Show all arguments"
						/>
						{argumentIds.map(aid => (
							<Chip
								key={aid}
								size="small"
								label={aid}
								color={selectedArgumentId === aid ? 'warning' : 'default'}
								variant={selectedArgumentId === aid ? 'filled' : 'outlined'}
								title="Focus argument"
								onClick={() => {
									setSelectedArgumentId(prev => {
										const next = prev === aid ? null : aid
										if (storageKey) { try { if (next) localStorage.setItem(`xv_argument_${storageKey}`, next); else localStorage.removeItem(`xv_argument_${storageKey}`) } catch {} }
										return next
									})
								}}
							/>
						))}
					</Stack>
				)}
				<Button aria-label="Toggle informal" size="small" variant={showInformalZone ? 'contained' : 'outlined'} onClick={()=> setShowInformalZone(s=>!s)}>Informal</Button>
				<Button aria-label="Toggle temporal" size="small" variant={showTemporalZone ? 'contained' : 'outlined'} onClick={()=> setShowTemporalZone(s=>!s)}>Temporal</Button>
				{/* Floating legend chip */}
				<Chip size="small" label={showLegend ? 'Legend: On' : 'Legend'} onClick={() => { const next = !showLegend; setShowLegend(next); try { localStorage.setItem('xv_legend', next ? '1' : '0') } catch {}; onInfo?.(next ? 'Legend shown' : 'Legend hidden') }} />
			</Stack>
			{tooltip && (
				<div
					style={{
						position: 'absolute',
						left: tooltip.x,
						top: tooltip.y,
						background: 'rgba(30, 30, 47, 0.95)',
						border: '1px solid var(--ai-purple)',
						borderRadius: 8,
						padding: '8px 12px',
						color: 'var(--ai-text-primary)',
						fontSize: 12,
						pointerEvents: 'none',
						zIndex: 10,
						maxWidth: 300
					}}
					dangerouslySetInnerHTML={{ __html: tooltip.html }}
				/>
			)}
			<Menu anchorEl={menuAnchorEl} open={menuOpen} onClose={closeMenu} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }}>
				<MenuItem disabled>Legend</MenuItem>
				<Divider />
				<MenuItem disabled>Zones: Premises • Terms • Conclusions • Fallacies</MenuItem>
				<MenuItem disabled>Edges: solid=semantic, dashed=dashed rule, dotted=weak</MenuItem>
				<MenuItem disabled>Badges: color encodes rule; dot=weight</MenuItem>
				<Divider />
				<MenuItem onClick={() => { const next = !hierarchyMode; setHierarchyMode(next); try { localStorage.setItem('xv_hierarchy', next ? '1' : '0') } catch {}; onInfo?.(next ? 'Hierarchy mode on' : 'Hierarchy mode off'); closeMenu() }}>Hierarchy Mode</MenuItem>
				<MenuItem onClick={() => { setShowClusters(s=>!s); closeMenu() }}>{showClusters ? 'Hide Clusters' : 'Show Clusters'}</MenuItem>
				<MenuItem onClick={() => { setShowRivers(s=>!s); closeMenu() }}>{showRivers ? 'Hide Rivers' : 'Show Rivers'}</MenuItem>
				<Divider />
				<MenuItem onClick={() => { setPathHighlight(s=>{ const next = !s; onInfo?.(next ? 'Path highlight on' : 'Path highlight off'); return next }); closeMenu() }}>{pathHighlight ? 'Disable Path Highlight' : 'Enable Path Highlight'}</MenuItem>
				<MenuItem onClick={() => { setHideNonPath(s=>!s); onInfo?.('Toggled Isolate Path'); closeMenu() }}>{hideNonPath ? 'Show All Paths' : 'Isolate Path'}</MenuItem>
				<Divider />
				<MenuItem onClick={() => { const next = !showInformalZone; setShowInformalZone(next); closeMenu() }}>{showInformalZone ? 'Hide Informal Zone' : 'Show Informal Zone'}</MenuItem>
				<MenuItem onClick={() => { const next = !showTemporalZone; setShowTemporalZone(next); closeMenu() }}>{showTemporalZone ? 'Hide Temporal Zone' : 'Show Temporal Zone'}</MenuItem>
				<Divider />
				<MenuItem onClick={() => { saveLayout(); onInfo?.('Layout saved'); closeMenu() }}>Save Layout</MenuItem>
				<MenuItem onClick={() => { copySelectedDetails(); closeMenu() }} disabled={!selectedNodeId}>Copy Selected Details</MenuItem>
				<MenuItem onClick={() => { const next = !showLegend; setShowLegend(next); try { localStorage.setItem('xv_legend', next ? '1' : '0') } catch {}; onInfo?.(next ? 'Legend shown' : 'Legend hidden'); closeMenu() }}>{showLegend ? 'Hide Legend' : 'Show Legend'}</MenuItem>
			</Menu>
			<svg ref={miniMapRef} width={160} height={110} style={{ position: 'absolute', right: 8, bottom: 8, background: 'rgba(20,20,30,0.6)', border: '1px solid rgba(64,196,255,0.25)', borderRadius: 6 }} />
		</div>
	)
}

export default ZlfnGraph

// ARIA note: main graph controls include buttons with labels; link badges have titles for screen readers. Path highlight is indicated by a status message and dimming non-path elements.


