import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useResizeObserver } from '../../hooks/useResizeObserver'
import { Button, Stack, IconButton, Menu, MenuItem, TextField } from '@mui/material'
import { useLogicShared } from '../../context/LogicSharedContext'
import MoreVertIcon from '@mui/icons-material/MoreVert'

export type ZlfnNode = {
	id: string
	name?: string
	symbol?: string
	translation?: string
	type?: 'premise' | 'conclusion' | 'term' | 'fallacy' | 'core'
	zone?: string
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
}

export const ZlfnGraph: React.FC<ZlfnGraphProps> = ({ nodes, edges, zones, storageKey, onInfo, centerOnSelectionTrigger, centerOnNodeId, centerOnNodeTrigger }) => {
	const { elementRef, size } = useResizeObserver<HTMLDivElement>()
	const svgRef = useRef<SVGSVGElement | null>(null)
	const gRef = useRef<SVGGElement | null>(null)
	const miniMapRef = useRef<SVGSVGElement | null>(null)
	const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
	const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)
	const { simulationMode, setSimulationMode, nodeIdToActive, setNodeIdToActive, resetStates, selectedNodeId, setSelectedNodeId } = useLogicShared()
	const [tooltip, setTooltip] = useState<{ x: number; y: number; html: string } | null>(null)
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null)
	const pathCentroidRef = useRef<{ x: number; y: number } | null>(null)
  const mmBoundsRef = useRef<{ minX: number; minY: number; sx: number; sy: number } | null>(null)
	const [frozen, setFrozen] = useState(false)
	const [pathHighlight, setPathHighlight] = useState(false)
	const [showEdgeLabels, setShowEdgeLabels] = useState(true)
	const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
		if (!storageKey) return new Set()
		try { const raw = localStorage.getItem(`xv_pins_layout_${storageKey}`); return new Set<string>(raw ? JSON.parse(raw) : []) } catch { return new Set() }
	})
	const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
	const [ruleFilter, setRuleFilter] = useState('')
	const [hideNonPath, setHideNonPath] = useState(false)
	const ruleFilterRef = useRef<HTMLInputElement | null>(null)
	const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number | null>(null)

	const exportSvg = () => {
		if (!svgRef.current) return
		try {
			const serializer = new XMLSerializer()
			const clone = svgRef.current.cloneNode(true) as SVGSVGElement
			clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
			const svgText = serializer.serializeToString(clone)
			const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
			const url = URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = 'zlfn-graph.svg'
			a.click()
			URL.revokeObjectURL(url)
			onInfo?.('Exported SVG')
		} catch {}
	}

	const defaultZones: ZlfnZone[] = useMemo(
		() => [
			{ id: 'premises', name: 'Premises', color: '#20B2AA', xRange: [100, 400], yRange: [80, 500] },
			{ id: 'terms', name: 'Terms', color: '#4169E1', xRange: [450, 750], yRange: [80, 500] },
			{ id: 'conclusions', name: 'Conclusions', color: '#9370DB', xRange: [800, 1100], yRange: [80, 500] },
			{ id: 'fallacies', name: 'Fallacies', color: '#DC143C', xRange: [1150, 1350], yRange: [80, 300] }
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
			if (e.key.toLowerCase() === 'e') { setSelectedEdgeIndex(null); onInfo?.('Cleared edge selection') }
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [simulationMode, setSimulationMode, resetStates, onInfo, frozen, showEdgeLabels])

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
		const zonesToUse = zones && zones.length ? zones : defaultZones
		const zoneGroup = g.append('g').attr('class', 'zones')
		zoneGroup
			.selectAll('.zone')
			.data(zonesToUse)
			.join('rect')
			.attr('class', 'zone')
			.attr('x', d => d.xRange[0])
			.attr('y', d => d.yRange[0])
			.attr('width', d => d.xRange[1] - d.xRange[0])
			.attr('height', d => d.yRange[1] - d.yRange[0])
			.attr('fill', d => d.color)
			.attr('fill-opacity', 0.08)
			.attr('stroke', d => d.color)
			.attr('stroke-opacity', 0.25)
			.attr('stroke-width', 2)
			.attr('rx', 8)

		zoneGroup
			.selectAll('.zone-label')
			.data(zonesToUse)
			.join('text')
			.attr('class', 'zone-label')
			.attr('x', d => (d.xRange[0] + d.xRange[1]) / 2)
			.attr('y', d => d.yRange[0] - 10)
			.attr('text-anchor', 'middle')
			.attr('fill', d => d.color)
			.attr('data-base-size', 12)
			.attr('font-weight', 'bold')
			.text(d => d.name)

		// derive edges for d3 (source/target)
		const linkData = edges.map(e => ({
			...e,
			source: (e.source ?? e.from) as string,
			target: (e.target ?? e.to) as string
		}))

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

		// load layout if available
		const layoutKey = storageKey ? `xv_layout_${storageKey}` : null
		let saved: Record<string, { x: number; y: number }> | null = null
		if (layoutKey) {
			try { saved = JSON.parse(localStorage.getItem(layoutKey) || 'null') } catch { saved = null }
			if (saved) {
				for (const n of nodes as any[]) {
					const pos = saved[n.id]
					if (pos) { n.x = pos.x; n.y = pos.y }
				}
			}
		}

		const simulation = d3
			.forceSimulation(nodes as any)
			.force('link', d3.forceLink(linkData as any).id((d: any) => d.id).distance(100))
			.force('charge', d3.forceManyBody().strength(-300))
			.force('center', d3.forceCenter(width / 2, height / 2))
			.force('collision', d3.forceCollide().radius(50))
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
			})

		// paths for curved labels
		const linkPathsGroup = g.append('g').attr('class', 'link-paths')
		const linkPaths = linkPathsGroup
			.selectAll('path.curve')
			.data(linkData)
			.join('path')
			.attr('class', 'curve')
			.attr('id', (_d: any, i: number) => `edge-path-${i}`)
			.attr('fill', 'none')
			.attr('stroke', 'none')

		const linkCurvedLabels = linkPathsGroup
			.selectAll('text.curved-label')
			.data(linkData)
			.join(enter => {
				const t = enter.append('text').attr('class', 'curved-label').attr('fill', '#e0e6ff').attr('data-base-size', 10)
				const tp = t.append('textPath').attr('startOffset', '50%').attr('text-anchor', 'middle')
				tp.text(d => d.rule || d.label || '')
				return t
			})

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
			.data(nodes)
			.join('g')
			.attr('class', 'node')
			.style('cursor', 'pointer')
			.call(
				d3
					.drag<any, ZlfnNode>()
					.on('start', (event, d) => {
						if (!event.active) simulation.alphaTarget(0.3).restart()
						;(d as any).fx = (d as any).x
						;(d as any).fy = (d as any).y
					})
					.on('drag', (event, d) => {
						;(d as any).fx = event.x
						;(d as any).fy = event.y
					})
					.on('end', (event, d) => {
						if (!event.active) simulation.alphaTarget(0)
						if (!frozen) { (d as any).fx = null; (d as any).fy = null }
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
					const next = { ...toggled }
					for (const e of edges) {
						const src = (e.from ?? e.source) as string | undefined
						const tgt = (e.to ?? e.target) as string | undefined
						const weight = e.weight ?? 0
						if (src && tgt && toggled[src] && weight >= 70) {
							next[tgt] = true
						}
					}
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
			link
				.attr('x1', (d: any) => (d.source as any).x)
				.attr('y1', (d: any) => (d.source as any).y)
				.attr('x2', (d: any) => (d.target as any).x)
				.attr('y2', (d: any) => (d.target as any).y)

			// update curved paths and decide label mode
			linkPaths.attr('d', (d: any) => {
				const sx = (d.source as any).x, sy = (d.source as any).y
				const tx = (d.target as any).x, ty = (d.target as any).y
				const dx = tx - sx, dy = ty - sy
				const len = Math.hypot(dx, dy) || 1
				const nx = -dy / len, ny = dx / len
				const ox = (sx + tx) / 2 + nx * Math.min(40, len * 0.15)
				const oy = (sy + ty) / 2 + ny * Math.min(40, len * 0.15)
				return `M ${sx},${sy} Q ${ox},${oy} ${tx},${ty}`
			})
			linkCurvedLabels.select('textPath')
				.attr('href', (_: any, i: number) => `#edge-path-${i}`)
			// show curved labels only on long edges
			const longThreshold = 180
			linkCurvedLabels.attr('display', (d: any) => {
				const sx = (d.source as any).x, sy = (d.source as any).y
				const tx = (d.target as any).x, ty = (d.target as any).y
				return Math.hypot(tx - sx, ty - sy) > longThreshold && showEdgeLabels ? null : 'none'
			})
			linkLabelG.attr('display', (d: any) => {
				const sx = (d.source as any).x, sy = (d.source as any).y
				const tx = (d.target as any).x, ty = (d.target as any).y
				return Math.hypot(tx - sx, ty - sy) <= longThreshold && showEdgeLabels ? null : 'none'
			})

			linkLabelG
				.attr('transform', (d: any) => {
					const s = d.source as any, t = d.target as any
					const sx = s.x, sy = s.y, tx = t.x, ty = t.y
					const cx = (sx + tx) / 2
					const cy = (sy + ty) / 2 - 4
					const angle = (Math.atan2(ty - sy, tx - sx) * 180) / Math.PI
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
					.attr('x', -bbox.width / 2 - 4)
					.attr('y', -bbox.height + 2)
					.attr('width', bbox.width + 8)
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
			linkCurvedLabels.attr('opacity', (d: any, i: number) => {
				const base = matches(d) ? 1 : 0.15
				return selectedEdgeIndex === null ? base : (i === selectedEdgeIndex ? 1 : 0.1)
			})

			linkLabelG
				.attr('transform', (d: any) => {
					const s = d.source as any, t = d.target as any
					const sx = s.x, sy = s.y, tx = t.x, ty = t.y
					const cx = (sx + tx) / 2
					const cy = (sy + ty) / 2 - 4
					const angle = (Math.atan2(ty - sy, tx - sx) * 180) / Math.PI
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
					.attr('x', -bbox.width / 2 - 4)
					.attr('y', -bbox.height + 2)
					.attr('width', bbox.width + 8)
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
		})

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

		return () => {
			simulation.stop()
			simulationRef.current = null
		}
	}, [nodes, edges, zones, defaultZones, size, simulationMode, nodeIdToActive, selectedNodeId, setSelectedNodeId, storageKey, frozen, showEdgeLabels, pinnedIds, onInfo, ruleFilter, pathHighlight, selectedEdgeIndex])

	useEffect(() => {
		if (!storageKey) return
		try { localStorage.setItem(`xv_pins_layout_${storageKey}`, JSON.stringify(Array.from(pinnedIds))) } catch {}
	}, [pinnedIds, storageKey])

	// update selection styling without full redraw
	useEffect(() => {
		if (!gRef.current) return
		const g = d3.select(gRef.current)
		g.selectAll('.node')
			.selectAll('rect, circle')
			.attr('stroke', (d: any) => (selectedNodeId === d.id ? '#ff4081' : '#fff'))
			.attr('stroke-width', (d: any) => (selectedNodeId === d.id ? 3 : 2))
	}, [selectedNodeId])

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
			g.selectAll('g.links line, g.links g.link-label, g.link-paths text.curved-label, g.nodes g.node').attr('display', null)
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

	// helpers
	const resetLayout = () => {
		simulationRef.current?.alpha(1).restart()
	}
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
	const clearLayout = () => {
		if (!storageKey) return
		try { localStorage.removeItem(`xv_layout_${storageKey}`); onInfo?.('Layout cleared') } catch {}
	}
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
	const togglePinSelected = () => {
		if (!selectedNodeId || !gRef.current) return
		setPinnedIds(prev => {
			const next = new Set(prev)
			let found: any = null
			d3.select(gRef.current).selectAll<any, any>('g.nodes g.node').each(function (d: any) { if (d.id === selectedNodeId) found = d })
			if (next.has(selectedNodeId)) {
				next.delete(selectedNodeId)
				if (found) { (found as any).fx = null; (found as any).fy = null }
				onInfo?.('Unpinned')
			} else {
				next.add(selectedNodeId)
				if (found) { (found as any).fx = (found as any).x; (found as any).fy = (found as any).y }
				onInfo?.('Pinned')
			}
			return next
		})
	}

	return (
		<div ref={elementRef} style={{ width: '100%', height: 560, position: 'relative' }}>
			<Stack direction="row" spacing={1} sx={{ position: 'absolute', top: 8, left: 8, zIndex: 2, flexWrap: 'wrap', alignItems: 'center' }}>
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
				<TextField size="small" placeholder="Filter rule" value={ruleFilter} onChange={(e)=>setRuleFilter(e.target.value)} inputRef={ruleFilterRef} sx={{ minWidth: 140 }} />
				<Button aria-label="Clear filters" size="small" variant="outlined" onClick={()=>{ setRuleFilter(''); setPathHighlight(false); setHideNonPath(false); onInfo?.('Cleared filters') }}>Clear</Button>
				<IconButton aria-label="More options" size="small" onClick={(e) => setMenuAnchorEl(e.currentTarget)}>
					<MoreVertIcon />
				</IconButton>
				<Menu
					anchorEl={menuAnchorEl}
					open={Boolean(menuAnchorEl)}
					onClose={() => setMenuAnchorEl(null)}
				>
					<MenuItem onClick={resetLayout}>Reset Layout</MenuItem>
					<MenuItem onClick={() => resetStates()}>Reset States</MenuItem>
					<MenuItem onClick={centerOnPath} disabled={!pathCentroidRef.current}>Center Path</MenuItem>
					<MenuItem onClick={()=> setHideNonPath(v=>{ const next = !v; onInfo?.(next ? 'Isolate Path on' : 'Isolate Path off'); return next })}>{hideNonPath ? 'Show All' : 'Isolate Path'}</MenuItem>
					<MenuItem onClick={() => setShowEdgeLabels(s=>!s)}>
						{showEdgeLabels ? 'Hide Edge Labels' : 'Show Edge Labels'}
					</MenuItem>
					<MenuItem onClick={toggleFreeze}>
						{frozen ? 'Unfreeze Layout' : 'Freeze Layout'}
					</MenuItem>
					<MenuItem onClick={togglePinSelected} disabled={!selectedNodeId}>
						{selectedNodeId && pinnedIds.has(selectedNodeId) ? 'Unpin Selected' : 'Pin Selected'}
					</MenuItem>
					<MenuItem onClick={saveLayout} disabled={!storageKey}>Save Layout</MenuItem>
					<MenuItem onClick={clearLayout} disabled={!storageKey}>Clear Layout</MenuItem>
					<MenuItem onClick={exportSvg}>Export SVG</MenuItem>
					<MenuItem onClick={() => { setSelectedEdgeIndex(null); onInfo?.('Cleared edge selection') }}>Clear Edge Selection</MenuItem>
				</Menu>
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
			<svg ref={miniMapRef} width={160} height={110} style={{ position: 'absolute', right: 8, bottom: 8, background: 'rgba(20,20,30,0.6)', border: '1px solid rgba(64,196,255,0.25)', borderRadius: 6 }} />
		</div>
	)
}

export default ZlfnGraph

// ARIA note: main graph controls include buttons with labels; link badges have titles for screen readers. Path highlight is indicated by a status message and dimming non-path elements.


