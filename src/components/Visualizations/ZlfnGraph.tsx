import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useResizeObserver } from '../../hooks/useResizeObserver'
import { useTouchGestures } from '../../hooks/useTouchGestures'
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout'
import { Button, Stack, IconButton, TextField, Chip, Menu, MenuItem, Divider, ButtonGroup, Collapse, Paper, Box } from '@mui/material'
import { Dialog as MuiDialog, DialogTitle as MuiDialogTitle, DialogContent as MuiDialogContent, DialogActions as MuiDialogActions } from '@mui/material'
import { useLogicShared } from '../../context/LogicSharedContext'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import SearchIcon from '@mui/icons-material/Search'
import FilterListIcon from '@mui/icons-material/FilterList'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DownloadIcon from '@mui/icons-material/Download'
import StickyNote2Icon from '@mui/icons-material/StickyNote2'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import BatchPredictionIcon from '@mui/icons-material/BatchPrediction'
import { evaluateInference, evaluateStates, getRuleStrength, isRuleFallacy, bayesianUpdate } from '../../services/inference'
import { downloadJson } from '../../services/io'
import { parseVennRule, computeShading } from '../../services/venn'
import { api } from '../../services/zlfnAPI'
import BatchOperationsDialog from '../BatchOperations/BatchOperationsDialog'
import { parseExpressionToAst } from '../../services/logic'
import { renderZones } from '../../vis/layers/zones'

// AST-based evaluator (no eval)
function evaluateExpressionWithAst(expression: string, variables: string[], values: boolean[]): boolean {
	const ast = parseExpressionToAst(expression)
	const env: Record<string, boolean> = {}
	variables.forEach((v, i) => { env[v] = values[i] })

	function evalAst(node: any): boolean {
		if (!node) return false
		const label = node.label
		const children = node.children || []
		// treat non-operator leaf as propositional var
		if (!children.length && !('∧∨⊻→↔¬∀∃'.includes(label))) {
			return !!env[label]
		}
		if (label === '¬') return !evalAst(children[0])
		if (label === '∧') return children.every((c: any) => evalAst(c))
		if (label === '∨') return children.some((c: any) => evalAst(c))
		if (label === '⊻') { const t = children.filter((c: any) => evalAst(c)).length; return t === 1 }
		if (label === '→') { const a = evalAst(children[0]), b = evalAst(children[1]); return (!a) || b }
		if (label === '↔') { const a = evalAst(children[0]), b = evalAst(children[1]); return a === b }
		// quantifiers unsupported in truth-table view: evaluate body
		if (label === '∀' || label === '∃') return evalAst(children[children.length-1])
		return false
	}

	return evalAst(ast)
}

export type LayoutMode = 'radial' | 'hierarchical' | 'grid' | 'force' | 'temporal'

export type ZlfnNode = {
	id: string
	name?: string
	symbol?: string
	translation?: string
	type?: 'premise' | 'conclusion' | 'term' | 'fallacy' | 'core' | 'informal' | 'temporal'
	zone?: string
	zoneId?: string
	argumentId?: string
	layoutMode?: LayoutMode  // For Core nodes: determines arrangement pattern
	complexity?: 'simple' | 'moderate' | 'complex'  // Influences layout mode selection
	centralHub?: boolean  // Marks this as a central argument hub
	connectedArguments?: string[]  // Arguments this Core connects
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
	onNotesToggle?: () => void
	notesEnabled?: boolean
	onNoteRequest?: (nodeId: string) => void
	externalSvgRef?: React.RefObject<SVGSVGElement | null>
	suppressInternalNoteMarkers?: boolean
    onExportFull?: () => void
    onImportFull?: (file: File) => void
    collabCount?: number
    objectId?: string
    disableShortcuts?: boolean
}

export const ZlfnGraph: React.FC<ZlfnGraphProps> = ({ nodes, edges, zones, storageKey, onInfo, centerOnSelectionTrigger, centerOnNodeId, centerOnNodeTrigger, onEdgeSelect, onOpenTruthTable, onNotesToggle, notesEnabled, onNoteRequest, externalSvgRef, suppressInternalNoteMarkers, onExportFull, onImportFull, collabCount, objectId, disableShortcuts }) => {
  // Mobile optimization hooks
  const responsive = useResponsiveLayout();
  const mobileConfig = responsive.getMobileLayoutConfig();
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
	// simulation stability (to reduce ticks once layout settles)
	const stableTicksRef = useRef<number>(0)
	const { simulationMode, setSimulationMode, nodeIdToActive, setNodeIdToActive, resetStates, selectedNodeId, setSelectedNodeId, modes } = useLogicShared()
	const [tooltip, setTooltip] = useState<{ x: number; y: number; html: string } | null>(null)
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null)
	const pathCentroidRef = useRef<{ x: number; y: number } | null>(null)
  const mmBoundsRef = useRef<{ minX: number; minY: number; sx: number; sy: number } | null>(null)
	const [frozen, setFrozen] = useState(false)
	const [pathHighlight, setPathHighlight] = useState(false)
	const [showEdgeLabels, setShowEdgeLabels] = useState<boolean>(() => { try { return localStorage.getItem('xv_edge_labels') !== '0' } catch { return true } })
	const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
		if (!storageKey) return new Set()
		try { const raw = localStorage.getItem(`xv_pins_layout_${storageKey}`); return new Set<string>(raw ? JSON.parse(raw) : []) } catch { return new Set() }
	})
	const [ruleFilter, setRuleFilter] = useState('')
	const [hideNonPath, setHideNonPath] = useState(false)
	const ruleFilterRef = useRef<HTMLInputElement | null>(null)
	const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number | null>(null)
	const [hierarchyMode, setHierarchyMode] = useState<boolean>(() => localStorage.getItem('xv_hierarchy') === '1')
	const [showClusters, setShowClusters] = useState<boolean>(() => {
		try {
			const v = localStorage.getItem('xv_clusters')
			return v ? v === '1' : false
		} catch { return false }
	})
	const [showRivers, setShowRivers] = useState<boolean>(() => localStorage.getItem(`xv_rivers_${storageKey||'default'}`) !== '0')
	const showRiversRef = useRef<boolean>(showRivers)
	useEffect(() => { showRiversRef.current = showRivers }, [showRivers])
	useEffect(() => {
		try { localStorage.setItem(`xv_rivers_${storageKey||'default'}`, showRivers ? '1' : '0') } catch {}
	}, [showRivers, storageKey])
	const [statusText, setStatusText] = useState<string>('')
	const [notesCount, setNotesCount] = useState<number>(0)
	const [showLegend, setShowLegend] = useState<boolean>(() => localStorage.getItem('xv_legend') === '1')
	const [dynamicFit, setDynamicFit] = useState<boolean>(() => localStorage.getItem('xv_dynamic_fit') === '1')
	const [snapEnabled, setSnapEnabled] = useState<boolean>(() => localStorage.getItem('xv_snap') !== '0')
	const [batchDialogOpen, setBatchDialogOpen] = useState(false)
	const [showMiniMap, setShowMiniMap] = useState<boolean>(() => localStorage.getItem('xv_minimap') !== '0')
	const [showHelp, setShowHelp] = useState<boolean>(false)
	const [nodeSearchTerm, setNodeSearchTerm] = useState<string>('')
	const [showNodeSearch, setShowNodeSearch] = useState<boolean>(false)
	const [selectedSearchIndex, setSelectedSearchIndex] = useState<number>(-1)
	const [toolbarExpanded, setToolbarExpanded] = useState<boolean>(false)
	const fileInputRef = useRef<HTMLInputElement | null>(null)
	const nodeSearchRef = useRef<HTMLInputElement | null>(null)

	// Layout history (undo/redo) — capture node positions
	const historyRef = useRef<Array<Record<string,{x:number;y:number}>>>([])
	const historyIndexRef = useRef<number>(-1)
	const captureLayout = () => {
		if (!gRef.current) return
		const data: Record<string,{x:number;y:number}> = {}
		d3.select(gRef.current).selectAll<any,any>('g.nodes g.node').each(function(d:any){ if(typeof d?.x==='number'&&typeof d?.y==='number'&&d?.id){ data[d.id]={x:d.x,y:d.y} }})
		// Truncate forward
		historyRef.current = historyRef.current.slice(0, historyIndexRef.current+1)
		historyRef.current.push(data)
		historyIndexRef.current = historyRef.current.length-1
	}
	const applyLayout = (snap: Record<string,{x:number;y:number}>) => {
		if (!gRef.current) return
		d3.select(gRef.current).selectAll<any,any>('g.nodes g.node').each(function(d:any){ const s=snap[d?.id]; if(s){ d.x=s.x; d.y=s.y; (d as any).fx=null; (d as any).fy=null }})
		if (simulationRef.current) simulationRef.current.alpha(0.4).restart()
	}
	const undoLayout = () => {
		if (historyIndexRef.current<=0) return
		historyIndexRef.current -= 1
		applyLayout(historyRef.current[historyIndexRef.current])
		onInfo?.('Layout: undo')
	}
	const redoLayout = () => {
		if (historyIndexRef.current>=historyRef.current.length-1) return
		historyIndexRef.current += 1
		applyLayout(historyRef.current[historyIndexRef.current])
		onInfo?.('Layout: redo')
	}

	// Force clusters off (prevents duplicate-looking rule boxes from cluster labels)
	useEffect(() => {
		if (showClusters) {
			setShowClusters(false)
			try { localStorage.setItem('xv_clusters', '0') } catch {}
		}
	}, [])

	// Label update mutex to coalesce layout work and avoid duplicate/overlapping renders
	const labelMutexRef = useRef<boolean>(false)
	const labelPendingRef = useRef<boolean>(false)

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
			}
			await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
			onInfo?.('Copied selection details')
		} catch {}
	}
	// overflow menu for secondary controls
	const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
	const menuOpen = Boolean(menuAnchorEl)
	const openMenu = (e: React.MouseEvent<HTMLElement>) => setMenuAnchorEl(e.currentTarget)
	const closeMenu = () => setMenuAnchorEl(null)
	// debug helpers (set to false for normal operation)
	const debug = false
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

	// filtered nodes for search
	const filteredSearchNodes = useMemo(() => {
		if (!nodeSearchTerm.trim()) return []
		const term = nodeSearchTerm.toLowerCase().trim()
		return (nodes as any[]).filter(node => 
			(node.name && node.name.toLowerCase().includes(term)) ||
			(node.symbol && node.symbol.toLowerCase().includes(term)) ||
			(node.translation && node.translation.toLowerCase().includes(term)) ||
			(node.id && node.id.toLowerCase().includes(term)) ||
			(node.type && node.type.toLowerCase().includes(term))
		).slice(0, 10) // limit to 10 results
	}, [nodes, nodeSearchTerm])

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
		if (disableShortcuts) return
		const onKey = (e: KeyboardEvent) => {
			const active = (document.activeElement as HTMLElement | null) || (e.target as HTMLElement | null)
			if (active) {
				const tag = active.tagName
				const inDialog = !!active.closest('[role="dialog"], .MuiDialog-root, .MuiModal-root, .MuiPopover-root, [data-notes-dialog="true"]')
				const role = active.getAttribute?.('role')
				const isEditable = (active as any).isContentEditable || role === 'textbox'
				// Debug log for key handling context
				try { console.debug('[ZLFN-KEY]', { key: e.key, tag, inDialog, isEditable, disableShortcuts, activeId: active.id || null }) } catch {}
				if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || isEditable || inDialog) {
					try { console.debug('[ZLFN-KEY] skip due to input/dialog'); } catch {}
					return
				}
			}
			if (e.key.toLowerCase() === 'f') { e.preventDefault(); fitToContents() }
			if (e.key.toLowerCase() === 'c') { e.preventDefault(); centerOnSelection() }
			if (e.key.toLowerCase() === 'p') { e.preventDefault(); centerOnPath() }
			if (e.key.toLowerCase() === 'z') { e.preventDefault(); centerOnSelection() }
			if (e.key.toLowerCase() === 's' && e.ctrlKey) { e.preventDefault(); saveLayout(); onInfo?.('Layout saved') }
			if (e.key.toLowerCase() === 'm') { e.preventDefault(); const next = !simulationMode; setSimulationMode(next); if (!next) resetStates(); onInfo?.(next ? 'Simulation enabled' : 'Simulation disabled') }
			if (e.key.toLowerCase() === 'r') { e.preventDefault(); resetStates(); onInfo?.('States reset') }
			if (e.key.toLowerCase() === 'x') { e.preventDefault(); toggleFreeze() }
			if (e.key.toLowerCase() === 'h') { e.preventDefault(); setPathHighlight(s=>!s) }
			if (e.key.toLowerCase() === 'o') { e.preventDefault(); exportSvg() }
			if (e.key.toLowerCase() === 't') { e.preventDefault(); const next = !showEdgeLabels; setShowEdgeLabels(next); try { localStorage.setItem('xv_edge_labels', next ? '1' : '0') } catch {}; onInfo?.(next ? 'Labels on' : 'Labels off') }
			if (e.key.toLowerCase() === 'l') { e.preventDefault(); const next = !showLegend; setShowLegend(next); try { localStorage.setItem('xv_legend', next ? '1' : '0') } catch {}; onInfo?.(next ? 'Legend shown' : 'Legend hidden') }
			if (e.key.toLowerCase() === 'd') { e.preventDefault(); const next = !dynamicFit; setDynamicFit(next); try { localStorage.setItem('xv_dynamic_fit', next ? '1' : '0') } catch {}; onInfo?.(next ? 'Dynamic fit on' : 'Dynamic fit off') }
			if (e.key.toLowerCase() === 'u') { e.preventDefault(); setShowClusters(v=>!v) }
			if (e.key.toLowerCase() === 'g') { e.preventDefault(); setShowRivers(v=>!v) }
			if (e.key.toLowerCase() === 'i') { e.preventDefault(); setHideNonPath(v=>!v); onInfo?.('Toggled isolate path') }
			if (e.key.toLowerCase() === 'v') { e.preventDefault(); resetZoom() }
			if (e.key.toLowerCase() === 'y') { e.preventDefault(); clearLayout() }
			if (e.key === '/') { e.preventDefault(); ruleFilterRef.current?.focus() }
			if (e.key === '?' || (e.shiftKey && e.key === '/')) { e.preventDefault(); setShowHelp(v=>!v); onInfo?.('Toggled shortcuts help') }
			if (e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); setShowNodeSearch(v=>!v); if (!showNodeSearch) { nodeSearchRef.current?.focus(); setSelectedSearchIndex(-1) }; onInfo?.('Toggled node search') }
			// Search navigation within search results
			if (showNodeSearch && filteredSearchNodes.length > 0) {
				if (e.key === 'ArrowDown') {
					e.preventDefault()
					setSelectedSearchIndex(prev => Math.min(prev + 1, filteredSearchNodes.length - 1))
				}
				if (e.key === 'ArrowUp') {
					e.preventDefault()
					setSelectedSearchIndex(prev => Math.max(prev - 1, 0))
				}
				if (e.key === 'Enter' && selectedSearchIndex >= 0) {
					e.preventDefault()
					const selectedNode = filteredSearchNodes[selectedSearchIndex]
					if (selectedNode) {
						setSelectedNodeId(selectedNode.id)
						if (storageKey) { try { localStorage.setItem(`xv_selected_${storageKey}`, selectedNode.id) } catch {} }
						// Center on node
						const nodeEl = (nodes as any[]).find(n => n.id === selectedNode.id)
						if (nodeEl && svgRef.current && zoomRef.current) {
							const transform = d3.zoomTransform(svgRef.current)
							const k = transform.k
							const centerX = svgRef.current.clientWidth / 2
							const centerY = svgRef.current.clientHeight / 2
							const newTransform = d3.zoomIdentity.translate(centerX - nodeEl.x * k, centerY - nodeEl.y * k).scale(k)
							d3.select(svgRef.current).transition().duration(750).call(zoomRef.current.transform, newTransform)
						}
						onInfo?.(`Selected ${selectedNode.name || selectedNode.symbol || selectedNode.id} from search`)
						setShowNodeSearch(false)
						setNodeSearchTerm('')
						setSelectedSearchIndex(-1)
					}
				}
			}
			if (e.key.toLowerCase() === 'e') { setSelectedEdgeIndex(null); onInfo?.('Cleared edge selection'); onEdgeSelect?.(null) }
			// Enhanced keyboard navigation
			if (e.key === 'Tab') {
				e.preventDefault()
				const allNodes = (nodes as any[])
				if (!allNodes.length) return
				const currentIndex = selectedNodeId ? allNodes.findIndex(n => n.id === selectedNodeId) : -1
				const nextIndex = e.shiftKey ? 
					(currentIndex <= 0 ? allNodes.length - 1 : currentIndex - 1) :
					(currentIndex + 1) % allNodes.length
				const nextNode = allNodes[nextIndex]
				setSelectedNodeId(nextNode.id)
				if (storageKey) { try { localStorage.setItem(`xv_selected_${storageKey}`, nextNode.id) } catch {} }
				onInfo?.(`Selected ${nextNode.name || nextNode.symbol || nextNode.id}`)
			}
			if (e.key === 'Enter' && selectedNodeId) {
				e.preventDefault()
				// Center on selected node
				const nodeEl = (nodes as any[]).find(n => n.id === selectedNodeId)
				if (nodeEl && svgRef.current && zoomRef.current) {
					const transform = d3.zoomTransform(svgRef.current)
					const k = transform.k
					const centerX = svgRef.current.clientWidth / 2
					const centerY = svgRef.current.clientHeight / 2
					const newTransform = d3.zoomIdentity.translate(centerX - nodeEl.x * k, centerY - nodeEl.y * k).scale(k)
					d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, newTransform)
					onInfo?.(`Centered on ${nodeEl.name || nodeEl.symbol || nodeEl.id}`)
				}
			}
			// Quick toggles
			if (e.key.toLowerCase() === 'n') { e.preventDefault(); onNotesToggle?.(); onInfo?.('Toggled Notes') }
			if (e.key.toLowerCase() === 'f') { e.preventDefault(); fitToContents(); onInfo?.('Fit') }
			if (e.key.toLowerCase() === 'c') { e.preventDefault(); centerOnSelection(); onInfo?.('Center selection') }
			if (e.key === 'Escape') {
				e.preventDefault()
				setSelectedNodeId(null)
				setSelectedEdgeIndex(null)
				setNodeSearchTerm('')
				setShowNodeSearch(false)
				setSelectedArgumentId(null)
				if (storageKey) { 
					try { 
						localStorage.removeItem(`xv_selected_${storageKey}`)
						localStorage.removeItem(`xv_argument_${storageKey}`)
					} catch {} 
				}
				onInfo?.('Cleared all selections')
			}
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
			if (e.ctrlKey && e.key.toLowerCase()==='z') { e.preventDefault(); undoLayout() }
			if (e.ctrlKey && e.key.toLowerCase()==='y') { e.preventDefault(); redoLayout() }
		}
		window.addEventListener('keydown', onKey, { capture: true })
		const onCenter = (ev: Event) => {
			const detail = (ev as CustomEvent).detail as any
			const targetId: string | undefined = detail?.nodeId
			if (targetId) {
				setSelectedNodeId(targetId)
				queueMicrotask(() => centerOnSelection())
			}
		}
		window.addEventListener('zlfn:center-node', onCenter as any)
		return () => window.removeEventListener('keydown', onKey, { capture: true } as any)
	}, [disableShortcuts, simulationMode, setSimulationMode, resetStates, onInfo, frozen, showEdgeLabels, onEdgeSelect, selectedArgumentId, argumentIds, storageKey, showLegend, dynamicFit, setSelectedNodeId, showNodeSearch, selectedNodeId, nodes, filteredSearchNodes, selectedSearchIndex])

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
				// remove any legacy curved labels to prevent visual duplicates
				g.selectAll<any, any>('g.link-paths text.curved-label').remove()
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

		// dynamic canvas sizing option (fit to extents when enabled)
		const fitDynamic = dynamicFit

		// clear content
		g.selectAll('*').remove()

		// Mobile touch gesture support
		if (responsive.isTouch) {
			const touchGestures = useTouchGestures({
				onPinch: (scale, _center) => {
					if (!zoomRef.current) return;
					const currentTransform = d3.zoomTransform(svgRef.current!);
					const newScale = Math.max(0.1, Math.min(10, currentTransform.k * scale));
					const newTransform = currentTransform.scale(newScale / currentTransform.k);
					d3.select(svgRef.current!).call(zoomRef.current.transform, newTransform);
				},
				onPan: (delta, _center) => {
					if (!zoomRef.current) return;
					const currentTransform = d3.zoomTransform(svgRef.current!);
					const newTransform = currentTransform.translate(
						delta.x * mobileConfig.panSensitivity, 
						delta.y * mobileConfig.panSensitivity
					);
					d3.select(svgRef.current!).call(zoomRef.current.transform, newTransform);
				},
				onDoubleTap: (_point) => {
					fitToContents();
				},
				onLongPress: (point) => {
					// Find node at touch point and show context menu
					const transform = d3.zoomTransform(svgRef.current!);
					const [x, y] = transform.invert([point.x, point.y]);
					const touchedNode = (nodes as any[]).find(node => {
						const dx = node.x - x;
						const dy = node.y - y;
						const radius = (node.width || node.height || 40) / 2;
						return Math.sqrt(dx * dx + dy * dy) <= radius;
					});
					if (touchedNode) {
						setSelectedNodeId(touchedNode.id);
						onInfo?.(`Long press on ${touchedNode.name || touchedNode.id}`);
					}
				}
			});

			// Attach touch gestures to SVG
			const cleanup = touchGestures.attachToElement(svgRef.current as any);
			
			// Store cleanup for later
			(svgRef.current as any)._touchCleanup = cleanup;
		}

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
		const zoneGroup = renderZones(g as any, zonesToUse as any)

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

		// Scalability optimizations based on graph size
		const nodeCount = nodesWithArgs.length
		const edgeCount = linkData.length
		const isLargeGraph = nodeCount > 50 || edgeCount > 100
		const isExtraLargeGraph = nodeCount > 200 || edgeCount > 500
		
		// Dynamic performance adjustments
		const performanceSettings = {
			velocityDecay: isExtraLargeGraph ? 0.4 : isLargeGraph ? 0.3 : 0.25,
			chargeStrength: isExtraLargeGraph ? -200 : isLargeGraph ? -280 : -360,
			collisionIterations: isExtraLargeGraph ? 2 : isLargeGraph ? 4 : 6,
			alphaDecay: isExtraLargeGraph ? 0.05 : isLargeGraph ? 0.03 : 0.0228,
			alphaMin: isExtraLargeGraph ? 0.1 : 0.001
		}
		
		// Adaptive canvas sizing
		const adjustCanvasSize = () => {
			// Expand canvas for large graphs to prevent overcrowding
			if (isLargeGraph) {
				const expansionFactor = isExtraLargeGraph ? 1.5 : 1.3
				const newWidth = width * expansionFactor
				const newHeight = height * expansionFactor
				
				// Update SVG viewBox for dynamic scaling
				svg.attr('viewBox', `0 0 ${newWidth} ${newHeight}`)
					.attr('preserveAspectRatio', 'xMidYMid meet')
				
				return { width: newWidth, height: newHeight }
			}
			return { width, height }
		}
		
		const adjustedDimensions = adjustCanvasSize()
		const adjustedWidth = adjustedDimensions.width
		const adjustedHeight = adjustedDimensions.height
		
		// Create optimized simulation with DAG pruning for large graphs
		const simulation = d3.forceSimulation(nodesWithArgs as any)
			.velocityDecay(performanceSettings.velocityDecay)
			.alphaDecay(performanceSettings.alphaDecay)
			.alphaMin(performanceSettings.alphaMin)
			.force('link', d3.forceLink(linkData as any)
				.id((d: any) => d.id)
				.distance(isLargeGraph ? 80 : 100)
				.strength(isLargeGraph ? 0.8 : 1.0)
			)
			.force('charge', d3.forceManyBody()
				.strength(performanceSettings.chargeStrength)
				.distanceMin(10)
				.distanceMax(isLargeGraph ? 150 : 200)
			)
			.force('center', d3.forceCenter(adjustedWidth / 2, adjustedHeight / 2))
			.force('collision', d3.forceCollide()
				.radius((d: any) => radiusFor(d) + (isLargeGraph ? 15 : 20))
				.strength(isLargeGraph ? 0.8 : 1.0)
				.iterations(performanceSettings.collisionIterations)
			)
			.force('boxCollide', boxCollide(8, isLargeGraph ? 1.0 : 1.15))
			.force('termsRepel', termsRepel(showInformalZone && showTemporalZone ? 1.3 : 0.7))
			.force('termsSpread', termsSpreadForce(showInformalZone && showTemporalZone, 0.16))
			.force('termsHoldY', termsHoldYForce((showInformalZone || showTemporalZone), 0.25))
			.force('zoneX', d3.forceX().x((d: any) => {
				const zid = (d.zoneId || d.zone) as string | undefined
				const z = zid ? zoneById.get(zid) : undefined
				if (z) { return (z.xRange[0] + z.xRange[1]) / 2 }
				return (adjustedWidth / 2)
			}).strength(isLargeGraph ? 0.1 : 0.14))
			.force('zoneY', d3.forceY().y((d: any) => {
				const zid = (d.zoneId || d.zone) as string | undefined
				const z = zid ? zoneById.get(zid) : undefined
				if (z) { return (z.yRange[0] + z.yRange[1]) / 2 }
				return (adjustedHeight / 2)
			}).strength(isLargeGraph ? 0.06 : 0.08))
			.force('boundary', boundaryRepel(28, isLargeGraph ? 0.2 : 0.28))
		
		// Performance monitoring and adaptive optimization
		let tickCount = 0
		let performanceMetrics = {
			avgTickTime: 0,
			maxTickTime: 0,
			frameDrops: 0
		}
		
		const startOptimization = performance.now()
		simulation.on('tick', () => {
			const tickStart = performance.now()
			tickCount++
			
			// Reduced iteration simulation for large graphs
			if (isExtraLargeGraph && tickCount > 100) {
				simulation.alpha(Math.max(simulation.alpha() * 0.99, performanceSettings.alphaMin))
			}
			
			// Performance monitoring
			const tickTime = performance.now() - tickStart
			performanceMetrics.avgTickTime = (performanceMetrics.avgTickTime * (tickCount - 1) + tickTime) / tickCount
			performanceMetrics.maxTickTime = Math.max(performanceMetrics.maxTickTime, tickTime)
			
			if (tickTime > 16.67) { // > 60fps
				performanceMetrics.frameDrops++
			}
			
			// Lazy evaluation for large graphs - skip expensive updates on some ticks
			if (isLargeGraph && tickCount % (isExtraLargeGraph ? 3 : 2) !== 0) {
				return
			}
		})
		
		// Early termination for converged simulations
		simulation.on('end', () => {
			const optimizationTime = performance.now() - startOptimization
			if (debug) {
				console.log('[ZLFN] Simulation completed:', {
					nodes: nodeCount,
					edges: edgeCount,
					time: optimizationTime.toFixed(1) + 'ms',
					ticks: tickCount,
					avgTickTime: performanceMetrics.avgTickTime.toFixed(2) + 'ms',
					frameDrops: performanceMetrics.frameDrops,
					settings: performanceSettings
				})
			}
		})
		// Validate performance for large datasets
		const perfValidation = validatePerformance(nodeCount, edgeCount)
		if (debug || isLargeGraph) {
			console.log('[ZLFN] Performance validation:', perfValidation)
			console.log('[ZLFN] Adaptive render settings:', adaptiveRenderSettings)
		}
		
		if (debug) console.log('[ZLFN] simulation init with nodes=', (nodesWithArgs as any[]).length)
		simulationRef.current = simulation

		// links
		const linksGroup = g.append('g').attr('class', 'links')
		// dedicated layer for link labels to avoid accidental duplication across groups
		// Recreate the labels layer each render to guarantee a single source of truth
		g.select('g.link-labels').remove()
		let labelsLayerSel = g.append('g').attr('class', 'link-labels').attr('pointer-events','none')
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
		// ensure any old curved-labels are cleared to avoid duplicate-looking overlays
		g.selectAll('g.link-paths').remove()

		// edge labels with background (stable keyed join to avoid duplicates)
		const linkKey = (d: any) => {
				// d3 may later replace source/target with node objects; at join-time they are strings
				const s = (typeof d.source === 'string') ? d.source : (d.source?.id ?? '')
				const t = (typeof d.target === 'string') ? d.target : (d.target?.id ?? '')
				const r = (d.rule || d.label || '') as string
				return `${s}->${t}:${r}`
			}

		// deterministic small jitter so labels for similar edges don't stack
		const keyToJitter = (d: any) => {
			const k = linkKey(d)
			let h = 0
			for (let i = 0; i < k.length; i++) h = ((h << 5) - h) + k.charCodeAt(i)
			// map to [-1, 1]
			const s = (h % 100) / 50 - 1
			return s
		}

		// Deduplicate labels in case edges array contains logical duplicates
		const seenKeys = new Set<string>()
		const linkLabelData = linkData.filter((d: any) => {
			const k = linkKey(d)
			if (seenKeys.has(k)) return false
			seenKeys.add(k)
			return true
		})

		// Assign stable spread indices per rule to avoid visual overlap when different edges share the same rule text
		const ruleCounts = new Map<string, number>()
		for (const d of linkLabelData as any[]) {
			const r = (d.rule || d.label || '') as string
			ruleCounts.set(r, (ruleCounts.get(r) || 0) + 1)
		}
		const ruleNext = new Map<string, number>()
		for (const d of linkLabelData as any[]) {
			const r = (d.rule || d.label || '') as string
			const nxt = ruleNext.get(r) || 0
			;(d as any)._spreadIndex = nxt
			ruleNext.set(r, nxt + 1)
		}

		if (debug) {
			console.log('[ZLFN] labels join', { edges: linkData.length, labels: linkLabelData.length, keys: linkLabelData.slice(0,10).map(linkKey) })
			try {
				const existing = labelsLayerSel.selectAll('g.link-label').nodes().length
				console.log('[ZLFN] pre-layout labels count', existing)
			} catch {}
		}

		const linkLabelG = labelsLayerSel
			.selectAll('g.link-label')
			.data(linkLabelData, linkKey as any)
			.join(enter => {
				const g = enter.append('g').attr('class', 'link-label')
					.attr('data-key', (d: any) => linkKey(d))
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
			}, update => update.attr('data-key', (d: any) => linkKey(d)), exit => exit.remove())
		linkLabelG.attr('display', showEdgeLabels ? null : 'none')
		if (!showEdgeLabels) {
			// If labels hidden, skip position work
			return
		}
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
			.attr('id', (d: any) => `node-${d.id}`)
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
						if (snapEnabled && typeof (d as any).x === 'number' && typeof (d as any).y === 'number') {
							(d as any).x = Math.round((d as any).x / 10) * 10;
							(d as any).y = Math.round((d as any).y / 10) * 10;
						}
						// Capture layout snapshot after a drag ends
						captureLayout()
					})
				)

		// Enhanced shape rendering with Core component support
		nodeEnter.each(function (d) {
			const sel = d3.select(this)
			const active = simulationMode && nodeIdToActive[d.id]
			const isSelected = selectedNodeId === d.id
			const isCore = d.type === 'core' || d.centralHub
			const baseFill = nodeColor(d)
			const fill = active ? d3.color(baseFill)?.brighter(0.5)?.toString() || baseFill : baseFill
			
			// Core nodes get special hexagonal shape and enhanced styling
			if (isCore) {
				const radius = 25
				const hexPath = `M ${radius},0 L ${radius/2},${radius*0.866} L ${-radius/2},${radius*0.866} L ${-radius},0 L ${-radius/2},${-radius*0.866} L ${radius/2},${-radius*0.866} Z`
				
				// Core background with gradient effect
				sel.append('path')
					.attr('d', hexPath)
					.attr('fill', `url(#coreGradient-${d.id})`)
					.attr('stroke', isSelected ? '#ff4081' : '#ffd700')
					.attr('stroke-width', isSelected ? 4 : 3)
					.attr('opacity', 0.9)
				
				// Define gradient for Core nodes
				const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs')
				const gradient = defs.append('radialGradient')
					.attr('id', `coreGradient-${d.id}`)
					.attr('cx', '50%').attr('cy', '30%').attr('r', '70%')
				gradient.append('stop').attr('offset', '0%').attr('stop-color', d3.color(fill)?.brighter(0.8)?.toString() || fill)
				gradient.append('stop').attr('offset', '100%').attr('stop-color', fill)
				
				// Core hub indicator (inner ring)
				sel.append('circle')
					.attr('r', 8)
					.attr('fill', 'none')
					.attr('stroke', '#ffd700')
					.attr('stroke-width', 2)
					.attr('opacity', 0.8)
				
				// Layout mode indicator
				if (d.layoutMode) {
					const modeIcon = getLayoutModeIcon(d.layoutMode)
					sel.append('text')
						.attr('class', 'layout-mode-indicator')
						.attr('x', 18).attr('y', -18)
						.attr('text-anchor', 'middle')
						.attr('fill', '#ffd700')
						.attr('font-size', 12)
						.text(modeIcon)
						.append('title').text(`Layout Mode: ${d.layoutMode}`)
				}
				
				// Complexity indicator
				if (d.complexity) {
					const complexityColor = d.complexity === 'simple' ? '#4caf50' : 
											 d.complexity === 'moderate' ? '#ff9800' : '#f44336'
					sel.append('circle')
						.attr('cx', -20).attr('cy', -18)
						.attr('r', 4)
						.attr('fill', complexityColor)
						.attr('opacity', 0.9)
						.append('title').text(`Complexity: ${d.complexity}`)
				}
				
				// Connected arguments indicator
				if (d.connectedArguments && d.connectedArguments.length > 0) {
					sel.append('text')
						.attr('class', 'connected-args-indicator')
						.attr('x', 0).attr('y', 35)
						.attr('text-anchor', 'middle')
						.attr('fill', '#90caf9')
						.attr('font-size', 8)
						.text(`${d.connectedArguments.length} args`)
						.append('title').text(`Connected Arguments: ${d.connectedArguments.join(', ')}`)
				}
				
			} else if (d.size && 'radius' in d.size) {
				// Regular circular nodes
				sel
					.append('circle')
					.attr('r', d.size.radius)
					.attr('fill', fill)
					.attr('stroke', isSelected ? '#ff4081' : '#fff')
					.attr('stroke-width', isSelected ? 3 : 2)
			} else {
				// Regular rectangular nodes
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
		
		// Helper function for layout mode icons
		function getLayoutModeIcon(layoutMode: LayoutMode): string {
			const icons = {
				radial: '🌟',
				hierarchical: '📊',
				grid: '⚏',
				force: '🔗',
				temporal: '⏰'
			}
			return icons[layoutMode] || '⚙️'
		}

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

		// facet icons (use extracted helper)
		const iconGroup = nodeEnter.append('g').attr('class', 'facet-icons').attr('transform', 'translate(-20,-18)')
		try { console.debug('[FACETS] creating facet-icons for nodes:', (nodeEnter as any).size && (nodeEnter as any).size()) } catch {}
		// keep handlers below; the group structure remains the same for minimal risk
		iconGroup.append('circle').attr('r', 4).attr('cx', 0).attr('cy', 0).attr('fill', '#7ac7ff').attr('stroke', '#2aa4f4').attr('tabindex', 0).style('cursor', 'pointer')
			.append('title').text('Open Venn facet')
		iconGroup.append('rect').attr('x', 8).attr('y', -4).attr('width', 8).attr('height', 8).attr('fill', '#c0c0c0').attr('stroke', '#888').attr('tabindex', 0).style('cursor', 'pointer')
			.append('title').text('Open Truth Table facet')
		iconGroup.append('line').attr('x1', 18).attr('y1', 0).attr('x2', 26).attr('y2', 0).attr('stroke', '#aaa').attr('stroke-width', 2).attr('tabindex', 0).style('cursor', 'pointer')
			.append('title').text('Open Timeline facet')
		iconGroup.append('path').attr('d', 'M 32,-5 L 38,5 L 26,5 Z').attr('fill', '#ff8a80').attr('stroke', '#ff5252').attr('tabindex', 0).style('cursor', 'pointer')
			.append('title').text('Open Counter facet')

		function toggleFacetOverlay(this: any, type: 'venn'|'truth'|'timeline'|'counter', pinned?: boolean) {
			const nodeGroup = (this as Element).closest('g.node') as SVGGElement | null
			const host = nodeGroup ? d3.select(nodeGroup) : d3.select(this.parentNode?.parentNode as SVGGElement)
			const existing = host.select('g.facet-overlay')
			if (!existing.empty()) {
				const isPinned = existing.attr('data-pinned') === '1'
				if (!isPinned) existing.remove(); else return
			}
			const overlay = host.append('g').attr('class', 'facet-overlay').attr('aria-label', `${type} overlay`).attr('role', 'dialog').attr('data-pinned', pinned ? '1' : '0')
			overlay.append('rect').attr('x', -90).attr('y', -70).attr('width', 180).attr('height', 120).attr('rx', 8).attr('fill', 'rgba(20,20,30,0.92)').attr('stroke', '#40c4ff')
			// overlay legend/help
			overlay.append('text').attr('x', -84).attr('y', -54).attr('fill', '#9fb8ff').attr('font-size', 10).text('Esc to close • Drag nodes normally')
			const onEsc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { overlay.remove(); window.removeEventListener('keydown', onEsc) } }
			window.addEventListener('keydown', onEsc)
			if (type === 'venn') {
				const datum: any = (host.datum && host.datum()) || {}
				const label: string = (datum.symbol || datum.label || datum.id || '').toString()
				const termsAll = (label.match(/[A-Za-z]+/g) || ['A','B']).slice(0,5)
				const terms = termsAll.length >= 2 ? termsAll : ['A','B']
				const op = /∧|\^|\band\b|&/.test(label) ? 'and' : (/∨|\bor\b|\|/.test(label) ? 'or' : (/→|->/.test(label) ? 'imp' : 'unknown'))
				const parsed = parseVennRule((datum.name || datum.translation || '') as string)
				const shade = computeShading(parsed.kind)
				
				// Enhanced overlay with zoom controls and simulation mode support
				const enhancedOverlay = overlay.append('g').attr('class', 'enhanced-venn')
				let currentScale = 1.0
				const minScale = 0.5
				const maxScale = 3.0
				
				// Zoom controls
				const zoomControls = enhancedOverlay.append('g').attr('class', 'zoom-controls').attr('transform', 'translate(60, -60)')
				zoomControls.append('circle').attr('r', 8).attr('fill', '#2e7d32').attr('stroke', '#4caf50').style('cursor', 'pointer')
					.on('click', () => { currentScale = Math.min(maxScale, currentScale * 1.2); updateVenn() })
				zoomControls.append('text').attr('text-anchor', 'middle').attr('dy', 3).attr('fill', 'white').attr('font-size', 10).text('+').style('pointer-events', 'none')
				
				zoomControls.append('circle').attr('cx', 20).attr('r', 8).attr('fill', '#c62828').attr('stroke', '#f44336').style('cursor', 'pointer')
					.on('click', () => { currentScale = Math.max(minScale, currentScale / 1.2); updateVenn() })
				zoomControls.append('text').attr('x', 20).attr('text-anchor', 'middle').attr('dy', 3).attr('fill', 'white').attr('font-size', 10).text('−').style('pointer-events', 'none')
				
				// Simulation mode toggle
				const simToggle = enhancedOverlay.append('g').attr('class', 'sim-toggle').attr('transform', 'translate(-80, -60)')
				const simRect = simToggle.append('rect').attr('width', 50).attr('height', 16).attr('rx', 8)
					.attr('fill', simulationMode ? '#4caf50' : '#757575').style('cursor', 'pointer')
				simToggle.append('text').attr('x', 25).attr('y', 10).attr('text-anchor', 'middle').attr('fill', 'white').attr('font-size', 8).text('SIM').style('pointer-events', 'none')
				simRect.on('click', () => {
					setSimulationMode(!simulationMode)
					updateVenn()
				})
				
				const vennContainer = enhancedOverlay.append('g').attr('class', 'venn-container')
				
				function updateVenn() {
					vennContainer.selectAll('*').remove()
					
					const gx = vennContainer.append('g').attr('transform', `translate(-20,-20) scale(${currentScale})`)
					const palette = ['#40c4ff','#00e676','#ffd740','#ff8a80','#b388ff']
					const r = 28
					const positions: Array<[number,number]> = terms.length <= 2 ? [[-20,20],[20,20]] : terms.length === 3 ? [[-24,20],[24,20],[0,-2]] : terms.length === 4 ? [[-24,20],[24,20],[-24,-2],[24,-2]] : [[-28,18],[0,32],[28,18],[-16,-2],[16,-2]]
					
					// Enhanced circles with interactive features
					terms.forEach((t, i) => {
						const circle = gx.append('circle')
							.attr('cx', positions[i][0]).attr('cy', positions[i][1]).attr('r', r)
							.attr('fill', simulationMode ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.10)')
							.attr('stroke', palette[i%palette.length])
							.attr('stroke-width', simulationMode ? 2.5 : 2)
							.style('cursor', simulationMode ? 'pointer' : 'default')
						
						if (simulationMode) {
							circle.on('mouseover', function() {
								d3.select(this).attr('fill', 'rgba(255,255,255,0.25)')
								onInfo?.(`Set ${t}: Click to evaluate relations`)
							})
							.on('mouseout', function() {
								d3.select(this).attr('fill', 'rgba(255,255,255,0.15)')
							})
							.on('click', () => {
								// Trigger Bayesian update for this set
								const priorBelief = 0.5
								const evidence = Math.random() * 0.3 + 0.7 // Simulate evidence
								const likelihood = getRuleStrength(datum.rule, modes)
								const posteriorBelief = bayesianUpdate(priorBelief, evidence, likelihood)
								onInfo?.(`Set ${t}: Updated belief ${(posteriorBelief * 100).toFixed(1)}%`)
							})
						}
						
						gx.append('text').attr('x', positions[i][0] + (positions[i][0]<0?-r-8:r+8)).attr('y', positions[i][1]-10)
							.attr('fill', '#cfe9ff').attr('font-size', simulationMode ? 12 : 11).text(t)
					})
					
					// Enhanced operation highlighting
					if (op === 'and') {
						const intersectionPath = gx.append('ellipse').attr('cx', 0).attr('cy', 20).attr('rx', 18).attr('ry', 12)
							.attr('fill', simulationMode ? 'rgba(0,230,118,0.5)' : 'rgba(0,230,118,0.35)')
						if (simulationMode) {
							intersectionPath.style('cursor', 'pointer')
								.on('click', () => onInfo?.('Intersection: A ∧ B - Elements in both sets'))
						}
						overlay.append('text').attr('x', -80).attr('y', 36).attr('fill', '#a0ffcf').attr('font-size', 11).text('Highlight: ∩')
					} else if (op === 'or') {
						gx.append('circle').attr('cx', -20).attr('cy', 20).attr('r', 28).attr('fill', 'none')
							.attr('stroke', '#40c4ff').attr('stroke-width', simulationMode ? 3 : 2.5).attr('stroke-opacity', simulationMode ? 0.8 : 0.6)
						gx.append('circle').attr('cx', 20).attr('cy', 20).attr('r', 28).attr('fill', 'none')
							.attr('stroke', '#00e676').attr('stroke-width', simulationMode ? 3 : 2.5).attr('stroke-opacity', simulationMode ? 0.8 : 0.6)
						overlay.append('text').attr('x', -80).attr('y', 36).attr('fill', '#cfe9ff').attr('font-size', 11).text('Highlight: ∪')
					} else if (op === 'imp' && terms.length >= 2) {
						const arrow = gx.append('path').attr('d', 'M -32,8 L -6,8').attr('stroke', '#8ad7ff')
							.attr('stroke-width', simulationMode ? 3 : 2).attr('marker-end', 'url(#arrow)')
						if (simulationMode) {
							arrow.style('cursor', 'pointer')
								.on('click', () => onInfo?.(`Implication: ${terms[0]} → ${terms[1]} - Subset relation`))
						}
						overlay.append('text').attr('x', -80).attr('y', 36).attr('fill', '#ffd54f').attr('font-size', 11).text(`${terms[0]} ⊆ ${terms[1]} (cue)`)
					} else {
						overlay.append('text').attr('x', -80).attr('y', 36).attr('fill', '#e0e6ff').attr('font-size', 11).text('Venn preview')
					}
					
					// Enhanced shading indicators
					if (shade.intersection) {
						gx.append('ellipse').attr('cx', 0).attr('cy', 20).attr('rx', 14).attr('ry', 9)
							.attr('fill', simulationMode ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)')
							.attr('stroke', simulationMode ? '#fff' : 'none')
							.attr('stroke-dasharray', simulationMode ? '2,2' : 'none')
					}
					if (shade.disjoint) {
						gx.append('line').attr('x1', -40).attr('y1', 20).attr('x2', 40).attr('y2', 20)
							.attr('stroke', '#ff8080').attr('stroke-dasharray', '4,3')
							.attr('stroke-width', simulationMode ? 2.5 : 2)
					}
					
					// Update zoom indicator
					vennContainer.append('text').attr('x', -80).attr('y', 50)
						.attr('fill', '#90caf9').attr('font-size', 9).text(`Zoom: ${(currentScale * 100).toFixed(0)}%`)
				}
				
				// Enhanced validation badge
				if (parsed.kind) {
					const ok = parsed.kind !== 'no'
					const validationStrength = getRuleStrength(datum.rule, modes)
					const badgeColor = ok ? (validationStrength > 0.8 ? '#00e676' : '#ffc107') : '#ff5252'
					const badgeText = ok ? (validationStrength > 0.8 ? 'Valid' : 'Weak') : 'Invalid'
					
					overlay.append('rect').attr('x', 54).attr('y', -68).attr('rx', 4).attr('width', 40).attr('height', 16)
						.attr('fill', `${badgeColor}40`).attr('stroke', badgeColor)
					overlay.append('text').attr('x', 74).attr('y', -56).attr('fill', badgeColor).attr('font-size', 10)
						.attr('text-anchor', 'middle').text(badgeText)
					
					// Add strength indicator
					if (simulationMode) {
						overlay.append('text').attr('x', 54).attr('y', -45).attr('fill', '#90caf9').attr('font-size', 8)
							.text(`Strength: ${(validationStrength * 100).toFixed(0)}%`)
					}
				}
				
				// Initialize the diagram
				updateVenn()
			} else if (type === 'truth') {
				// Enhanced interactive truth table facet
				const datum: any = (host.datum && host.datum()) || {}
				const expression = datum.symbol || datum.label || datum.id || 'P ∧ Q'
				
				// Extract variables from expression
				const variables: string[] = Array.from(new Set((expression.match(/[A-Z]/g) || ['P', 'Q']).slice(0, 4)))
				const numRows = Math.pow(2, variables.length)
				
				// Create truth table container
				const truthContainer = overlay.append('g').attr('class', 'truth-table-container')
				
				// Calculate table dimensions
				const cellWidth = 20
				const cellHeight = 16
				const tableWidth = (variables.length + 1) * cellWidth
				const startX = -tableWidth / 2
				const startY = -50
				
				// Header row
				variables.forEach((variable, i) => {
					const rect = truthContainer.append('rect')
						.attr('x', startX + i * cellWidth)
						.attr('y', startY)
						.attr('width', cellWidth)
						.attr('height', cellHeight)
						.attr('fill', '#2e3440')
						.attr('stroke', '#4c566a')
						.style('cursor', simulationMode ? 'pointer' : 'default')
					
					truthContainer.append('text')
						.attr('x', startX + i * cellWidth + cellWidth / 2)
						.attr('y', startY + cellHeight / 2 + 4)
						.attr('text-anchor', 'middle')
						.attr('fill', '#eceff4')
						.attr('font-size', 10)
						.text(variable.toString())
					
					if (simulationMode) {
						rect.on('click', () => onInfo?.(`Variable ${variable}: Click to toggle column`))
					}
				})
				
				// Result column header
				truthContainer.append('rect')
					.attr('x', startX + variables.length * cellWidth)
					.attr('y', startY)
					.attr('width', cellWidth)
					.attr('height', cellHeight)
					.attr('fill', '#5e81ac')
					.attr('stroke', '#4c566a')
				
				truthContainer.append('text')
					.attr('x', startX + variables.length * cellWidth + cellWidth / 2)
					.attr('y', startY + cellHeight / 2 + 4)
					.attr('text-anchor', 'middle')
					.attr('fill', '#eceff4')
					.attr('font-size', 8)
					.text('Result')
				
				// Data rows
				for (let row = 0; row < numRows; row++) {
					const truthValues: boolean[] = []
					
					// Generate truth values for this row
					for (let col = 0; col < variables.length; col++) {
						const value = Boolean(row & (1 << (variables.length - 1 - col)))
						truthValues.push(value)
					}
					
					// Evaluate expression using AST
					const result = evaluateExpressionWithAst(expression.toString(), variables, truthValues)
					
					// Variable cells
					variables.forEach((variable, col) => {
						const value = truthValues[col]
						const cellColor = value ? '#a3be8c' : '#bf616a'
						const textColor = value ? '#2e3440' : '#eceff4'
						
						const rect = truthContainer.append('rect')
							.attr('x', startX + col * cellWidth)
							.attr('y', startY + (row + 1) * cellHeight)
							.attr('width', cellWidth)
							.attr('height', cellHeight)
							.attr('fill', cellColor)
							.attr('stroke', '#4c566a')
							.style('cursor', simulationMode ? 'pointer' : 'default')
						
						truthContainer.append('text')
							.attr('x', startX + col * cellWidth + cellWidth / 2)
							.attr('y', startY + (row + 1) * cellHeight + cellHeight / 2 + 4)
							.attr('text-anchor', 'middle')
							.attr('fill', textColor)
							.attr('font-size', 10)
							.text(value ? 'T' : 'F')
						
						if (simulationMode) {
							rect.on('mouseover', function() {
								d3.select(this).attr('opacity', 0.8)
							})
							.on('mouseout', function() {
								d3.select(this).attr('opacity', 1)
							})
							.on('click', () => {
								onInfo?.(`Row ${row + 1}: ${variable} = ${value ? 'True' : 'False'}`)
							})
						}
					})
					
					// Result cell
					const resultColor = result ? '#a3be8c' : '#bf616a'
					const resultTextColor = result ? '#2e3440' : '#eceff4'
					
					const resultRect = truthContainer.append('rect')
						.attr('x', startX + variables.length * cellWidth)
						.attr('y', startY + (row + 1) * cellHeight)
						.attr('width', cellWidth)
						.attr('height', cellHeight)
						.attr('fill', resultColor)
						.attr('stroke', '#4c566a')
						.style('cursor', simulationMode ? 'pointer' : 'default')
					
					truthContainer.append('text')
						.attr('x', startX + variables.length * cellWidth + cellWidth / 2)
						.attr('y', startY + (row + 1) * cellHeight + cellHeight / 2 + 4)
						.attr('text-anchor', 'middle')
						.attr('fill', resultTextColor)
						.attr('font-size', 10)
						.text(result ? 'T' : 'F')
					
					if (simulationMode) {
						resultRect.on('click', () => {
							const assignment = variables.map((v, i) => `${v}=${truthValues[i] ? 'T' : 'F'}`).join(', ')
							onInfo?.(`Row ${row + 1}: ${assignment} → ${result ? 'True' : 'False'}`)
						})
					}
				}
				
				// Add expression label
				overlay.append('text')
					.attr('x', 0)
					.attr('y', -60)
					.attr('text-anchor', 'middle')
					.attr('fill', '#81a1c1')
					.attr('font-size', 12)
					.text(`Truth Table: ${expression}`)
				
				// Add tautology/contradiction indicator
				const allResults = Array.from({ length: numRows }, (_, row) => {
					const truthValues = variables.map((_, col) => 
						Boolean(row & (1 << (variables.length - 1 - col)))
					)
					return evaluateExpressionWithAst(expression.toString(), variables, truthValues)
				})
				
				const isTautology = allResults.every(r => r)
				const isContradiction = allResults.every(r => !r)
				
				if (isTautology || isContradiction) {
					const indicatorColor = isTautology ? '#a3be8c' : '#bf616a'
					const indicatorText = isTautology ? 'Tautology' : 'Contradiction'
					
					overlay.append('rect')
						.attr('x', startX + tableWidth + 5)
						.attr('y', startY)
						.attr('width', 60)
						.attr('height', 20)
						.attr('fill', `${indicatorColor}40`)
						.attr('stroke', indicatorColor)
						.attr('rx', 4)
					
					overlay.append('text')
						.attr('x', startX + tableWidth + 35)
						.attr('y', startY + 14)
						.attr('text-anchor', 'middle')
						.attr('fill', indicatorColor)
						.attr('font-size', 8)
						.text(indicatorText)
				}
				
			} else if (type === 'timeline') {
				// Enhanced timeline preview with interactive segments
				const gtl = overlay.append('g').attr('transform', 'translate(-70, -10)')
				
				// Main axis
				gtl.append('line').attr('x1', 0).attr('y1', 40).attr('x2', 140).attr('y2', 40)
					.attr('stroke', '#90caf9').attr('stroke-width', 2)
				
				// Time points and segments
				const timePoints = [
					{ x: 0, label: 't₀', description: 'Initial state' },
					{ x: 28, label: 't₁', description: 'Premise introduced' },
					{ x: 56, label: 't₂', description: 'Inference applied' },
					{ x: 84, label: 't₃', description: 'Conclusion reached' },
					{ x: 112, label: 't₄', description: 'Evaluation' },
					{ x: 140, label: 't₅', description: 'Final state' }
				]
				
				// Draw ticks and labels
				timePoints.forEach((point, i) => {
					const tick = gtl.append('line')
						.attr('x1', point.x).attr('x2', point.x)
						.attr('y1', 34).attr('y2', 46)
						.attr('stroke', '#90caf9').attr('stroke-width', 2)
						.style('cursor', simulationMode ? 'pointer' : 'default')
					
					gtl.append('text')
						.attr('x', point.x).attr('y', 56)
						.attr('fill', '#cfe9ff').attr('font-size', 10)
						.attr('text-anchor', 'middle').text(point.label)
					
					if (simulationMode) {
						tick.on('click', () => onInfo?.(`${point.label}: ${point.description}`))
						
						// Add interactive zones
						if (i < timePoints.length - 1) {
							const nextPoint = timePoints[i + 1]
							gtl.append('rect')
								.attr('x', point.x).attr('y', 36)
								.attr('width', nextPoint.x - point.x).attr('height', 8)
								.attr('fill', 'rgba(255,215,64,0.2)')
								.attr('stroke', 'none')
								.style('cursor', 'pointer')
								.on('mouseover', function() {
									d3.select(this).attr('fill', 'rgba(255,215,64,0.4)')
								})
								.on('mouseout', function() {
									d3.select(this).attr('fill', 'rgba(255,215,64,0.2)')
								})
								.on('click', () => {
									onInfo?.(`Segment ${i + 1}: ${point.label} → ${nextPoint.label}`)
								})
						}
					}
				})
				
				// Highlighted active interval
				gtl.append('rect')
					.attr('x', 28).attr('y', 36)
					.attr('width', 56).attr('height', 8)
					.attr('fill', 'rgba(255,215,64,0.5)')
					.attr('stroke', '#ffd740')
					.attr('stroke-width', simulationMode ? 2 : 1)
				
				overlay.append('text').attr('x', 0).attr('y', -60)
					.attr('text-anchor', 'middle').attr('fill', '#e0e6ff').attr('font-size', 12).text('Timeline Analysis')
			} else if (type === 'counter') {
				// Enhanced counter facet with mini-graph, pulsing animation, and fallacy detection
				const gc = overlay.append('g').attr('transform', 'translate(-40,-20)')
				
				// Counter-argument mini-graph nodes
				const counterNodes = [
					{ id: 'premise', x: 0, y: 40, label: 'P', type: 'premise' },
					{ id: 'counter', x: 50, y: 20, label: 'C', type: 'counterexample' },
					{ id: 'conclusion', x: 90, y: 44, label: 'Q', type: 'conclusion' }
				]
				
				// Counter-argument edges with red dashed style
				const counterEdges = [
					{ from: 'premise', to: 'conclusion', type: 'support', dashed: false },
					{ from: 'counter', to: 'premise', type: 'counterexample', dashed: true },
					{ from: 'counter', to: 'conclusion', type: 'counterexample', dashed: true }
				]
				
				// Draw edges first (so they appear behind nodes)
				counterEdges.forEach(edge => {
					const fromNode = counterNodes.find(n => n.id === edge.from)!
					const toNode = counterNodes.find(n => n.id === edge.to)!
					
					const line = gc.append('line')
						.attr('x1', fromNode.x).attr('y1', fromNode.y)
						.attr('x2', toNode.x).attr('y2', toNode.y)
						.attr('stroke', edge.type === 'counterexample' ? '#ff5252' : '#90caf9')
						.attr('stroke-width', edge.type === 'counterexample' ? 3 : 2)
						.attr('stroke-dasharray', edge.dashed ? '5,3' : 'none')
						.attr('opacity', 0.8)
					
					// Add pulsing animation for counterexample edges
					if (edge.type === 'counterexample') {
						line.append('animate')
							.attr('attributeName', 'opacity')
							.attr('values', '0.4;1;0.4')
							.attr('dur', '2s')
							.attr('repeatCount', 'indefinite')
						
						line.append('animate')
							.attr('attributeName', 'stroke-width')
							.attr('values', '2;4;2')
							.attr('dur', '2s')
							.attr('repeatCount', 'indefinite')
					}
					
					if (simulationMode) {
						line.style('cursor', 'pointer')
							.on('click', () => {
								const strength = getRuleStrength('Counterexample', modes)
								onInfo?.(`${edge.type === 'counterexample' ? 'Counter-evidence' : 'Support'}: ${fromNode.label} → ${toNode.label} (strength: ${(strength * 100).toFixed(0)}%)`)
							})
					}
				})
				
				// Draw nodes
				counterNodes.forEach(node => {
					const nodeGroup = gc.append('g').attr('class', 'counter-node')
					
					const nodeColor = node.type === 'counterexample' ? '#ff5252' : 
									  node.type === 'premise' ? '#2196f3' : '#4caf50'
					
					const circle = nodeGroup.append('circle')
						.attr('cx', node.x).attr('cy', node.y)
						.attr('r', node.type === 'counterexample' ? 8 : 6)
						.attr('fill', nodeColor)
						.attr('stroke', '#fff')
						.attr('stroke-width', 2)
						.style('cursor', simulationMode ? 'pointer' : 'default')
					
					// Add pulsing animation for counterexample nodes
					if (node.type === 'counterexample') {
						circle.append('animate')
							.attr('attributeName', 'r')
							.attr('values', '6;10;6')
							.attr('dur', '1.5s')
							.attr('repeatCount', 'indefinite')
						
						circle.append('animate')
							.attr('attributeName', 'fill-opacity')
							.attr('values', '0.7;1;0.7')
							.attr('dur', '1.5s')
							.attr('repeatCount', 'indefinite')
					}
					
					// Node labels
					nodeGroup.append('text')
						.attr('x', node.x).attr('y', node.y + 3)
						.attr('text-anchor', 'middle')
						.attr('fill', 'white')
						.attr('font-size', 8)
						.attr('font-weight', 'bold')
						.text(node.label)
						.style('pointer-events', 'none')
					
					// Node type labels
					nodeGroup.append('text')
						.attr('x', node.x).attr('y', node.y + 18)
						.attr('text-anchor', 'middle')
						.attr('fill', '#cfd8dc')
						.attr('font-size', 7)
						.text(node.type === 'counterexample' ? 'Counter' : 
							   node.type === 'premise' ? 'Premise' : 'Conclusion')
						.style('pointer-events', 'none')
					
					if (simulationMode) {
						circle.on('mouseover', function() {
							d3.select(this).attr('stroke-width', 3)
						})
						.on('mouseout', function() {
							d3.select(this).attr('stroke-width', 2)
						})
						.on('click', () => {
							if (node.type === 'counterexample') {
								// Demonstrate Bayesian update for counter-evidence
								const priorBelief = 0.8 // High initial belief
								const counterEvidence = 0.3 // Strong counter-evidence
								const likelihood = 0.4 // Likelihood of evidence given hypothesis
								const posteriorBelief = bayesianUpdate(priorBelief, counterEvidence, likelihood)
								onInfo?.(`Counter-evidence impact: Prior ${(priorBelief * 100).toFixed(0)}% → Posterior ${(posteriorBelief * 100).toFixed(0)}%`)
							} else {
								onInfo?.(`${node.type}: ${node.label} - Click to analyze logical role`)
							}
						})
					}
				})
				
				// Add conflict indicator
				const conflictIndicator = gc.append('g').attr('class', 'conflict-indicator')
					.attr('transform', 'translate(45, 0)')
				
				conflictIndicator.append('polygon')
					.attr('points', '-8,-5 8,-5 0,8')
					.attr('fill', '#ff5722')
					.attr('stroke', '#d32f2f')
					.attr('stroke-width', 1.5)
				
				conflictIndicator.append('text')
					.attr('x', 0).attr('y', 1)
					.attr('text-anchor', 'middle')
					.attr('fill', 'white')
					.attr('font-size', 8)
					.attr('font-weight', 'bold')
					.text('!')
				
				// Conflict indicator pulsing
				conflictIndicator.append('animateTransform')
					.attr('attributeName', 'transform')
					.attr('type', 'scale')
					.attr('values', '1;1.2;1')
					.attr('dur', '1s')
					.attr('repeatCount', 'indefinite')
				
				// Add fallacy detection
				const currentNode: any = (host.datum && host.datum()) || {}
				const ruleName = currentNode.rule || 'Unknown'
				const isFallacious = isRuleFallacy(ruleName)
				
				if (isFallacious) {
					const fallacyBadge = gc.append('g').attr('class', 'fallacy-badge')
						.attr('transform', 'translate(20, -15)')
					
					fallacyBadge.append('rect')
						.attr('width', 50).attr('height', 12)
						.attr('rx', 6).attr('fill', '#ff5722')
						.attr('stroke', '#d32f2f')
					
					fallacyBadge.append('text')
						.attr('x', 25).attr('y', 8)
						.attr('text-anchor', 'middle')
						.attr('fill', 'white')
						.attr('font-size', 7)
						.text('FALLACY')
					
					if (simulationMode) {
						fallacyBadge.style('cursor', 'pointer')
							.on('click', () => {
								onInfo?.(`Fallacy detected: ${ruleName}. This inference rule may be logically invalid.`)
							})
					}
				}
				
				// Add explanatory text
				overlay.append('text').attr('x', 0).attr('y', -60)
					.attr('text-anchor', 'middle').attr('fill', '#ffcdd2').attr('font-size', 12)
					.text('Counter-Argument Analysis')
				
				overlay.append('text').attr('x', 0).attr('y', -45)
					.attr('text-anchor', 'middle').attr('fill', '#ffcdd2').attr('font-size', 9)
					.text('Red = Counter-evidence • Pulsing = Active conflict')
			}
			overlay.append('text').attr('x', 72).attr('y', -56).attr('fill', '#ff8080').attr('font-size', 12).style('cursor','pointer').text('×').on('click', () => overlay.remove())
			overlay.raise()
		}
		iconGroup.select('circle').on('click', function(event: any){ event.stopPropagation(); toggleFacetOverlay.call(this, 'venn') })
		iconGroup.select('rect').on('click', function(this: any, event: any, d: any){
			event.stopPropagation()
			// open page-level truth table for this node if symbol/label present
			const expr = (d && (d.symbol || d.label)) as string | undefined
			if (event.ctrlKey && expr && onOpenTruthTable) { onOpenTruthTable(expr) }
			else { toggleFacetOverlay.call(this, 'truth', !!event.shiftKey) }
		})
		.on('keydown', function(this: any, event: any, d: any){ if (event.key === 'Enter') { event.preventDefault(); const expr = (d && (d.symbol || d.label)) as string | undefined; if (event.ctrlKey && expr && onOpenTruthTable) onOpenTruthTable(expr); else toggleFacetOverlay.call(this, 'truth', !!event.shiftKey) } })
		iconGroup.select('line').on('click', function(event: any){ event.stopPropagation(); toggleFacetOverlay.call(this, 'timeline', !!event.shiftKey) })
		.on('keydown', function(this: any, event: any){ if (event.key === 'Enter') { event.preventDefault(); toggleFacetOverlay.call(this, 'timeline', !!event.shiftKey) } })
		iconGroup.select('path').on('click', function(event: any){ event.stopPropagation(); toggleFacetOverlay.call(this, 'counter', !!event.shiftKey) })
		.on('keydown', function(this: any, event: any){ if (event.key === 'Enter') { event.preventDefault(); toggleFacetOverlay.call(this, 'counter', !!event.shiftKey) } })

		// Relevance gating: hide icons that are not applicable
		iconGroup.each(function(d: any){
			try { console.debug('[FACETS] relevance (bypassed)', { id: d?.id }) } catch {}
			const g = d3.select(this)
			g.select('circle').style('display', 'inline')
			g.select('rect').style('display', 'inline')
			g.select('line').style('display', 'inline')
			g.select('path').style('display', 'inline')
		})

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
				
				// Core component specific interactions
				if (d.type === 'core' || d.centralHub) {
					if (simulationMode) {
						handleCoreNodeClick(d, event)
					}
					return
				}
				
				if (!simulationMode) return
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

					// update note marker absolute translate using current node coordinates
					const offsetX = 18
					const offsetY = -18
					const marker = d3.select(this).select<SVGGElement>('g.note-marker')
					if (!marker.empty() && typeof nd.x === 'number' && typeof nd.y === 'number') {
						marker.attr('transform', `translate(${nd.x + offsetX}, ${nd.y + offsetY})`)
					}
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

			// stop or cool simulation once stable to save CPU
			if (simulation.alpha() < 0.03) { stableTicksRef.current += 1 } else { stableTicksRef.current = 0 }
			if (stableTicksRef.current > 45) {
				// cool down; will restart on user interaction
				simulation.alphaTarget(0)
				simulation.stop()
				if (debug) console.log('[ZLFN] simulation cooled')
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

			// lightweight initial placement every tick to avoid stacked labels at (0,0)
			linkLabelG.attr('transform', (d: any) => {
				const s = d.source as any, t = d.target as any
				const sx = s?.x ?? 0, sy = s?.y ?? 0, tx = t?.x ?? 0, ty = t?.y ?? 0
				const cx0 = (sx + tx) / 2
				const cy0 = (sy + ty) / 2 - 4
				let angle = (Math.atan2(ty - sy, tx - sx) * 180) / Math.PI
				if (angle > 90) angle -= 180
				if (angle < -90) angle += 180
				const dx = tx - sx, dy = ty - sy
				const len = Math.hypot(dx, dy) || 1
				const nx = -dy / len, ny = dx / len
				const baseOff = Math.min(12, Math.max(6, len * 0.06))
				const jitter = keyToJitter(d)
				// add small tangential nudge using edge direction (tx-sx, ty-sy)
				const txu = dx / len, tyu = dy / len
				const spread = Number((d as any)._spreadIndex || 0)
				const side = spread % 2 === 0 ? 1 : -1
				const rank = Math.floor(spread / 2)
				const extraN = rank * 10
				const extraT = side * rank * 10
				const bx = cx0 + nx * (baseOff + jitter * 6 + extraN) + txu * (jitter * 8 + extraT)
				const by = cy0 + ny * (baseOff + jitter * 6 + extraN) + tyu * (jitter * 8 + extraT)
				return `translate(${bx},${by}) rotate(${angle})`
			})

			// throttle heavy placement work every 3rd tick (with mutex)
			const tickCount = (tickRef.current = (tickRef.current + 1))
			const doHeavy = tickCount % 3 === 0
			if (doHeavy) {
				if (debug) console.log('[ZLFN] heavy refine tick', tickCount, 'locked=', labelMutexRef.current)
				if (labelMutexRef.current) { labelPendingRef.current = true; }
				if (!labelMutexRef.current) {
					labelMutexRef.current = true
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
					const jitter = keyToJitter(d)
					const spread = Number((d as any)._spreadIndex || 0)
					const side = spread % 2 === 0 ? 1 : -1
					const rank = Math.floor(spread / 2)
					const extraN = rank * 10
					const extraT = side * rank * 10
					let bestX = cx0 + nx * (off + jitter * 6 + extraN) + (dx/len) * (jitter * 8 + extraT)
					let bestY = cy0 + ny * (off + jitter * 6 + extraN) + (dy/len) * (jitter * 8 + extraT)
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
				// release and possibly run one queued refine pass
				Promise.resolve().then(() => {
					labelMutexRef.current = false
					if (labelPendingRef.current) {
						labelPendingRef.current = false
						if (debug) console.log('[ZLFN] queued refine run')
						const againCenters: Array<{ x: number; y: number }> = []
						linkLabelG.attr('transform', (d: any) => {
							const s = d.source as any, t = d.target as any
							const sx = s.x, sy = s.y, tx = t.x, ty = t.y
							const cx0 = (sx + tx) / 2
							const cy0 = (sy + ty) / 2 - 4
							let angle = (Math.atan2(ty - sy, tx - sx) * 180) / Math.PI
							if (angle > 90) angle -= 180
							if (angle < -90) angle += 180
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
							const k = transformRef.current.k || 1
							const labelLen = ((d.rule || d.label || '').toString().length || 6) * (6 / k)
							const labelRadius = Math.max(10 / k, Math.min(80, labelLen / 2))
							let tries = 0
							let bestX = cx0 + nx * off
							let bestY = cy0 + ny * off
							while (tries < 5) {
								const tooNearNode = (distTo(bestX, bestY, sx, sy) < radFor(s) + labelRadius) || (distTo(bestX, bestY, tx, ty) < radFor(t) + labelRadius)
								const tooNearLabel = againCenters.some(c => distTo(bestX, bestY, c.x, c.y) < (labelRadius + 14 / k))
								if (!tooNearNode && !tooNearLabel) break
								off += 8
								const side = (tries % 2 === 0) ? 1 : -1
								bestX = cx0 + nx * off * side
								bestY = cy0 + ny * off * side
								tries++
							}
							againCenters.push({ x: bestX, y: bestY })
							return `translate(${bestX},${bestY}) rotate(${angle})`
						})
					}
				})
				}
			}

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

			// update minimap (throttled every 3rd tick)
			if (miniMapRef.current && doHeavy) {
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
					if (fitDynamic && svgRef.current && zoomRef.current) {
						const padding = 80
						const w = maxX - minX + padding
						const h = maxY - minY + padding
						const scale = Math.max(0.1, Math.min(2, Math.min((size.width||800) / w, ((size.height||560)-56) / h)))
						const cx = (minX + maxX) / 2
						const cy = (minY + maxY) / 2
						const transform = d3.zoomIdentity.translate((size.width||800) / 2, ((size.height||560)-56) / 2).scale(scale).translate(-cx, -cy)
						d3.select(svgRef.current).call(zoomRef.current.transform as any, transform)
					}
					const dx = maxX - minX || 1, dy = maxY - minY || 1
					const sx = mmW / dx, sy = mmH / dy
					mmBoundsRef.current = { minX, minY, sx, sy }
					mm.selectAll('*').remove()
					const gmm = mm.append('g')
					
					// Enhanced minimap nodes with type-based colors and selection highlighting
					const nodePositions: Array<{x: number, y: number, id: string, selected: boolean, type: string}> = []
					d3.select(gRef.current)
						.selectAll<any, any>('g.nodes g.node')
						.each(function (nd: any) { 
							nodePositions.push({ 
								x: nd.x || 0, 
								y: nd.y || 0, 
								id: nd.id,
								selected: nd.id === selectedNodeId,
								type: nd.type || 'unknown'
							}) 
						})
					
					gmm.selectAll('circle')
						.data(nodePositions)
						.join('circle')
						.attr('cx', p => ((p.x - minX) * sx))
						.attr('cy', p => ((p.y - minY) * sy))
						.attr('r', p => p.selected ? 3 : 2)
						.attr('fill', p => p.selected ? '#ffff00' : 
							p.type === 'premise' ? '#4fc3f7' :
							p.type === 'conclusion' ? '#ff7043' :
							p.type === 'term' ? '#81c784' :
							p.type === 'core' ? '#e57373' :
							p.type === 'fallacy' ? '#f06292' :
							'#8ad7ff')
						.attr('stroke', p => p.selected ? '#fff' : 'none')
						.attr('stroke-width', p => p.selected ? 1 : 0)
						.style('cursor', 'pointer')
						.on('mouseover', function(_event, d) {
							d3.select(this).attr('r', d.selected ? 4 : 3)
						})
						.on('mouseout', function(_event, d) {
							d3.select(this).attr('r', d.selected ? 3 : 2)
						})
						.on('click', function(event, d) {
							event.stopPropagation()
							setSelectedNodeId(d.id)
							if (storageKey) { try { localStorage.setItem(`xv_selected_${storageKey}`, d.id) } catch {} }
							onInfo?.(`Selected ${d.id} via minimap`)
						})
						.append('title').text(d => `${d.id} (${d.type})`)
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
			const panelW = 280, panelH = 180
			lg.attr('transform', `translate(${(width - panelW - 12)},${12})`)
			
			// Background with educational styling
			lg.append('rect').attr('rx', 8).attr('fill', 'rgba(15,25,45,0.95)').attr('stroke', '#66a6ff')
				.attr('stroke-width', 2).attr('width', panelW).attr('height', panelH)
			
			// Header with mode indicators
			lg.append('text').attr('x', 10).attr('y', 18).attr('fill', '#cfe9ff').attr('font-size', 14)
				.attr('font-weight', 'bold').text('ZLFN Educational Guide')
			
			// Active modes indicator
			const activeModes = Object.keys(modes).filter(m => modes[m as keyof typeof modes])
			if (activeModes.length > 0) {
				lg.append('text').attr('x', 10).attr('y', 35).attr('fill', '#a8d5ff').attr('font-size', 9)
					.text(`Active Modes: ${activeModes.join(', ')}`)
			}
			
			// Node types section
			const nodeSection = lg.append('g').attr('transform', 'translate(10,45)')
			nodeSection.append('text').attr('x', 0).attr('y', 0).attr('fill', '#81c784').attr('font-size', 11)
				.attr('font-weight', 'bold').text('Node Types:')
			
			const nodeTypes = [
				{ label: 'Premises', color: '#20B2AA', description: 'Initial assumptions' },
				{ label: 'Terms', color: '#4169E1', description: 'Intermediate concepts' },
				{ label: 'Conclusions', color: '#9370DB', description: 'Final deductions' },
				{ label: 'Fallacies', color: '#DC143C', description: 'Logical errors' }
			]
			
			nodeTypes.forEach((type, i) => {
				const y = 12 + i * 14
				const nodeG = nodeSection.append('g').attr('transform', `translate(0, ${y})`)
				
				// Visual example
				nodeG.append('rect').attr('x', 0).attr('y', -6).attr('width', 12).attr('height', 8)
					.attr('fill', type.color).attr('rx', 2).attr('opacity', 0.8)
				
				// Label and description
				nodeG.append('text').attr('x', 18).attr('y', -1).attr('fill', '#cfe9ff').attr('font-size', 10)
					.text(`${type.label}: ${type.description}`)
			})
			
			// Edge types section
			const edgeSection = lg.append('g').attr('transform', 'translate(10,110)')
			edgeSection.append('text').attr('x', 0).attr('y', 0).attr('fill', '#81c784').attr('font-size', 11)
				.attr('font-weight', 'bold').text('Connection Types:')
			
			const edgeTypes = [
				{ style: 'solid', color: '#7aa', description: 'Strong inference', strength: '> 80%' },
				{ style: 'dashed', color: '#ffa726', description: 'Moderate inference', strength: '60-80%' },
				{ style: 'dotted', color: '#ef5350', description: 'Weak/Counter', strength: '< 60%' }
			]
			
			edgeTypes.forEach((edge, i) => {
				const y = 12 + i * 12
				const edgeG = edgeSection.append('g').attr('transform', `translate(0, ${y})`)
				
				// Visual example
				const line = edgeG.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 30).attr('y2', 0)
					.attr('stroke', edge.color).attr('stroke-width', 2)
				
				if (edge.style === 'dashed') line.attr('stroke-dasharray', '4,2')
				if (edge.style === 'dotted') line.attr('stroke-dasharray', '2,2')
				
				// Arrow
				edgeG.append('polygon').attr('points', '28,-2 32,0 28,2').attr('fill', edge.color)
				
				// Description
				edgeG.append('text').attr('x', 38).attr('y', 3).attr('fill', '#cfe9ff').attr('font-size', 9)
					.text(`${edge.description} (${edge.strength})`)
			})
			
			// Status indicators section
			const statusSection = lg.append('g').attr('transform', 'translate(150,110)')
			statusSection.append('text').attr('x', 0).attr('y', 0).attr('fill', '#81c784').attr('font-size', 11)
				.attr('font-weight', 'bold').text('Status Indicators:')
			
			const statusTypes = [
				{ indicator: '●', color: '#4caf50', description: 'Active node' },
				{ indicator: '●', color: '#f44336', description: 'Conflict detected' },
				{ indicator: '📌', color: '#ffc107', description: 'Pinned position' },
				{ indicator: '!', color: '#ff5722', description: 'Fallacy warning' }
			]
			
			statusTypes.forEach((status, i) => {
				const y = 12 + i * 12
				const statusG = statusSection.append('g').attr('transform', `translate(0, ${y})`)
				
				statusG.append('text').attr('x', 0).attr('y', 3).attr('fill', status.color)
					.attr('font-size', 10).attr('text-anchor', 'middle').text(status.indicator)
				
				statusG.append('text').attr('x', 12).attr('y', 3).attr('fill', '#cfe9ff').attr('font-size', 9)
					.text(status.description)
			})
			
			// Educational tips
			const tipsSection = lg.append('g').attr('transform', 'translate(10,165)')
			if (simulationMode) {
				tipsSection.append('text').attr('x', 0).attr('y', 0).attr('fill', '#90caf9').attr('font-size', 8)
					.text('💡 Tips: Hover nodes/edges for details • Click facet icons for analysis')
			} else {
				tipsSection.append('text').attr('x', 0).attr('y', 0).attr('fill', '#90caf9').attr('font-size', 8)
					.text('ℹ️ Enable Simulation Mode for interactive educational features')
			}
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

	// Update a small notes count for toolbar via localStorage mirror
	useEffect(() => {
		const key = `${objectId || storageKey || 'default'}`
		const tick = () => {
			try {
				const raw = localStorage.getItem(`zlfn_notes_${key}`) || '{}'
				const map = JSON.parse(raw) as Record<string,string>
				const count = Object.values(map).filter(v => (v||'').trim()).length
				setNotesCount(count)
			} catch {}
		}
		tick()
		const id = window.setInterval(tick, 2000)
		return () => window.clearInterval(id)
	}, [objectId, storageKey])

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
		// ensure legacy curved labels remain removed
		g.selectAll<any, any>('g.link-paths text.curved-label').remove()
	}, [hideNonPath, selectedNodeId, edges])

	// persist clusters toggle
	useEffect(() => {
		try { localStorage.setItem('xv_clusters', showClusters ? '1' : '0') } catch {}
	}, [showClusters])

	// persist rivers toggle
	useEffect(() => {
		try { localStorage.setItem(`xv_rivers_${storageKey||'default'}`, showRivers ? '1' : '0') } catch {}
	}, [showRivers, storageKey])

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

	// export SVG utility
	const exportSvg = () => {
		if (!svgRef.current) return
		const serializer = new XMLSerializer()
		const svgString = serializer.serializeToString(svgRef.current)
		const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = 'zlfn-export.svg'
		a.click()
		URL.revokeObjectURL(url)
		onInfo?.('SVG exported')
	}

	// export PNG by rasterizing current SVG
	const exportPng = async () => {
		if (!svgRef.current) return
		const serializer = new XMLSerializer()
		const svgString = serializer.serializeToString(svgRef.current)
		const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
		const url = URL.createObjectURL(svgBlob)
		const img = new Image()
		const width = (size.width || 1200)
		const height = ((size.height || 720))
		await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = url })
		const canvas = document.createElement('canvas')
		canvas.width = width
		canvas.height = height
		const ctx = canvas.getContext('2d')!
		ctx.fillStyle = '#141826'
		ctx.fillRect(0, 0, width, height)
		ctx.drawImage(img, 0, 0, width, height)
		canvas.toBlob((blob) => {
			if (!blob) return
			const a = document.createElement('a')
			const pngUrl = URL.createObjectURL(blob)
			a.href = pngUrl
			a.download = 'zlfn-export.png'
			a.click()
			URL.revokeObjectURL(pngUrl)
			URL.revokeObjectURL(url)
			onInfo?.('PNG exported')
		})
	}

	// clear saved layout and unpin
	const clearLayout = () => {
		if (!storageKey) return
		try {
			localStorage.removeItem(`xv_layout_${storageKey}`)
			localStorage.removeItem(`xv_pins_layout_${storageKey}`)
			setPinnedIds(new Set())
			onInfo?.('Saved layout cleared')
			if (simulationRef.current) simulationRef.current.alpha(0.7).restart()
			// snapshot this action for version history
			if (objectId) {
				try { void api.createSnapshot(objectId, 'Cleared saved layout', 'modified') } catch {}
			}
		} catch {}
	}

	// reset zoom transform
	const resetZoom = () => {
		if (!svgRef.current || !zoomRef.current) return
		d3.select(svgRef.current).transition().duration(200).call(zoomRef.current.transform as any, d3.zoomIdentity)
		onInfo?.('View reset')
	}

	// Performance validation and large dataset utilities
	const validatePerformance = (nodeCount: number, edgeCount: number) => {
		const complexity = nodeCount * Math.log(nodeCount) + edgeCount * Math.log(edgeCount)
		const estimatedTime = complexity / 1000 // Rough estimate in ms
		
		if (complexity > 100000) {
			onInfo?.(`⚠️ Large dataset detected: ${nodeCount} nodes, ${edgeCount} edges. Performance optimizations active.`)
		}
		
		return {
			complexity,
			estimatedTime,
			recommendation: complexity > 200000 ? 'Consider data filtering or clustering' : 
						   complexity > 100000 ? 'Large graph - optimizations enabled' : 'Normal performance expected'
		}
	}
	
	// Adaptive rendering for performance
	const adaptiveRenderSettings = {
		useLevelOfDetail: (nodes as ZlfnNode[]).length > 100,
		simplifyLabels: (nodes as ZlfnNode[]).length > 200,
		skipAnimations: (nodes as ZlfnNode[]).length > 500,
		batchUpdates: (nodes as ZlfnNode[]).length > 150
	}
	
	// restart simulation softly
	// const restartSimulation = () => {
	// 	if (simulationRef.current) {
	// 		simulationRef.current.alpha(0.9).restart()
	// 	}
	// }
	
	// Core component functionality
	const handleCoreNodeClick = (coreNode: ZlfnNode, event: any) => {
		if (event.shiftKey) {
			// Shift-click cycles through layout modes for this Core
			cycleLayoutMode(coreNode)
		} else if (event.altKey) {
			// Alt-click toggles complexity level
			toggleComplexity(coreNode)
		} else {
			// Regular click shows Core management interface
			showCoreManagementDialog(coreNode)
		}
	}
	
	const cycleLayoutMode = (coreNode: ZlfnNode) => {
		const modes: LayoutMode[] = ['radial', 'hierarchical', 'grid', 'force', 'temporal']
		const currentIndex = coreNode.layoutMode ? modes.indexOf(coreNode.layoutMode) : 0
		const nextIndex = (currentIndex + 1) % modes.length
		const nextMode = modes[nextIndex]
		
		// Update the node's layout mode in the D3 simulation
		const d3Node = simulationRef.current?.nodes().find((n: any) => n.id === coreNode.id)
		if (d3Node) {
			(d3Node as any).layoutMode = nextMode
		}
		
		// Apply layout mode specific positioning
		applyLayoutMode(coreNode.id, nextMode)
		onInfo?.(`Core ${coreNode.label}: Switched to ${nextMode} layout`)
	}
	
	const toggleComplexity = (coreNode: ZlfnNode) => {
		const complexities: Array<'simple' | 'moderate' | 'complex'> = ['simple', 'moderate', 'complex']
		const currentIndex = coreNode.complexity ? complexities.indexOf(coreNode.complexity) : 0
		const nextIndex = (currentIndex + 1) % complexities.length
		const nextComplexity = complexities[nextIndex]
		
		// Update the node's complexity in the D3 simulation
		const d3Node = simulationRef.current?.nodes().find((n: any) => n.id === coreNode.id)
		if (d3Node) {
			(d3Node as any).complexity = nextComplexity
		}
		
		onInfo?.(`Core ${coreNode.label}: Complexity set to ${nextComplexity}`)
	}
	
	const showCoreManagementDialog = (coreNode: ZlfnNode) => {
		const connectedArgs = coreNode.connectedArguments || []
		const message = `Core Component: ${coreNode.label || coreNode.id}
Layout Mode: ${coreNode.layoutMode || 'Default'}
Complexity: ${coreNode.complexity || 'Not set'}
Connected Arguments: ${connectedArgs.length > 0 ? connectedArgs.join(', ') : 'None'}

Controls:
• Shift+Click: Cycle layout modes
• Alt+Click: Toggle complexity
• Ctrl+Click: Pin/unpin position`
		
		onInfo?.(message)
	}
	
	const applyLayoutMode = (coreNodeId: string, layoutMode: LayoutMode) => {
		if (!simulationRef.current) return
		
		// Find nodes connected to this Core
		const connectedNodeIds = new Set<string>()
		edges.forEach(edge => {
			const source = edge.from || edge.source
			const target = edge.to || edge.target
			if (source === coreNodeId) connectedNodeIds.add(target as string)
			if (target === coreNodeId) connectedNodeIds.add(source as string)
		})
		
		const coreNode = nodes.find(n => n.id === coreNodeId)
		if (!coreNode) return
		
		const connectedNodes = nodes.filter(n => connectedNodeIds.has(n.id))
		const corePosition = { x: (coreNode as any).x || 0, y: (coreNode as any).y || 0 }
		
		// Apply layout-specific positioning
		switch (layoutMode) {
			case 'radial':
				applyRadialLayout(connectedNodes, corePosition)
				break
			case 'hierarchical':
				applyHierarchicalLayout(connectedNodes, corePosition)
				break
			case 'grid':
				applyGridLayout(connectedNodes, corePosition)
				break
			case 'temporal':
				applyTemporalLayout(connectedNodes, corePosition)
				break
			case 'force':
			default:
				// Force layout is the default D3 behavior
				break
		}
		
		// Restart simulation to apply new positions
		simulationRef.current.alpha(0.3).restart()
	}
	
	const applyRadialLayout = (connectedNodes: ZlfnNode[], center: { x: number; y: number }) => {
		const radius = 80
		const angleStep = (2 * Math.PI) / connectedNodes.length
		
		connectedNodes.forEach((node, i) => {
			const angle = i * angleStep
			const x = center.x + Math.cos(angle) * radius
			const y = center.y + Math.sin(angle) * radius
			
			// Update D3 node positions
			const d3Node = simulationRef.current?.nodes().find((n: any) => n.id === node.id)
			if (d3Node) {
				(d3Node as any).x = x;
				(d3Node as any).y = y
			}
		})
	}
	
	const applyHierarchicalLayout = (connectedNodes: ZlfnNode[], center: { x: number; y: number }) => {
		const levelHeight = 60
		const nodeWidth = 80
		
		// Group nodes by type for hierarchical arrangement
		const premises = connectedNodes.filter(n => n.type === 'premise')
		const terms = connectedNodes.filter(n => n.type === 'term')
		const conclusions = connectedNodes.filter(n => n.type === 'conclusion')
		
		const levels = [premises, terms, conclusions].filter(level => level.length > 0)
		
		levels.forEach((level, levelIndex) => {
			const y = center.y - (levels.length - 1) * levelHeight / 2 + levelIndex * levelHeight
			level.forEach((node, nodeIndex) => {
				const x = center.x - (level.length - 1) * nodeWidth / 2 + nodeIndex * nodeWidth
				
				const d3Node = simulationRef.current?.nodes().find((n: any) => n.id === node.id)
				if (d3Node) {
					(d3Node as any).x = x;
					(d3Node as any).y = y
				}
			})
		})
	}
	
	const applyGridLayout = (connectedNodes: ZlfnNode[], center: { x: number; y: number }) => {
		const cols = Math.ceil(Math.sqrt(connectedNodes.length))
		const cellSize = 60
		
		connectedNodes.forEach((node, i) => {
			const row = Math.floor(i / cols)
			const col = i % cols
			const x = center.x - (cols - 1) * cellSize / 2 + col * cellSize
			const y = center.y - (Math.ceil(connectedNodes.length / cols) - 1) * cellSize / 2 + row * cellSize
			
			const d3Node = simulationRef.current?.nodes().find((n: any) => n.id === node.id)
			if (d3Node) {
				(d3Node as any).x = x;
				(d3Node as any).y = y
			}
		})
	}
	
	const applyTemporalLayout = (connectedNodes: ZlfnNode[], center: { x: number; y: number }) => {
		// Arrange nodes in temporal sequence (left to right)
		const spacing = 70
		const startX = center.x - (connectedNodes.length - 1) * spacing / 2
		
		connectedNodes.forEach((node, i) => {
			const x = startX + i * spacing
			const y = center.y + (Math.random() - 0.5) * 40 // Small vertical variance
			
			const d3Node = simulationRef.current?.nodes().find((n: any) => n.id === node.id)
			if (d3Node) {
				(d3Node as any).x = x;
				(d3Node as any).y = y
			}
		})
	}

	// export only layout JSON
	const exportLayoutJson = () => {
		if (!gRef.current) return
		const data: Record<string, { x: number; y: number }> = {}
		d3.select(gRef.current)
			.selectAll<any, any>('g.nodes g.node')
			.each(function (d: any) {
				if (typeof d.x === 'number' && typeof d.y === 'number' && d.id) data[d.id] = { x: d.x, y: d.y }
			})
		downloadJson({ expression: storageKey || 'layout', layout: data }, 'layout-export.json')
		onInfo?.('Layout JSON exported')
	}
	const saveLayout = () => {
		if (!storageKey || !gRef.current) return
		const data: Record<string, { x: number; y: number }> = {}
		d3.select(gRef.current)
			.selectAll<any, any>('g.nodes g.node')
			.each(function (d: any) {
				if (typeof d.x === 'number' && typeof d.y === 'number') data[d.id] = { x: d.x, y: d.y }
			})
		try { 
			localStorage.setItem(`xv_layout_${storageKey}`, JSON.stringify(data)); 
			onInfo?.('Layout saved')
			if (objectId) { try { void api.createSnapshot(objectId, 'Saved layout', 'modified', undefined, data) } catch {} }
		} catch {}
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

	useEffect(() => {
		if (!gRef.current) return
		if (suppressInternalNoteMarkers) return
		const g = d3.select(gRef.current)
		const nodesSel = g.selectAll<SVGGElement, any>('g.nodes g.node')

		if (notesEnabled) {
			// Add note markers if missing
			nodesSel.each(function () {
				const node = d3.select(this)
				const nodeDatum: any = node.datum()
				if (node.select('g.note-marker').empty()) {
					const marker = node.append('g').attr('class', 'note-marker').style('cursor', 'pointer')
					// Use local transform so it follows the node group translation
					const offsetX = 18
					const offsetY = -18
					const nx = (nodeDatum?.x ?? 0) + offsetX
					const ny = (nodeDatum?.y ?? 0) + offsetY
					marker.attr('transform', `translate(${nx}, ${ny})`)
					marker.append('title').text('Edit note')
					marker.append('circle').attr('r', 7).attr('fill', '#ffc107').attr('stroke', '#ff8f00').attr('stroke-width', 1.5)
					marker.append('text').attr('y', 3).attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', '#000').text('📝')
					marker.on('click', (event: any) => {
						event.stopPropagation()
						if (nodeDatum && typeof nodeDatum.id === 'string' && onNoteRequest) {
							onNoteRequest(nodeDatum.id)
						} else {
							onInfo?.('Note marker clicked')
						}
					})
				}
			})
		} else {
			// Remove note markers
			nodesSel.selectAll('g.note-marker').remove()
		}
	}, [notesEnabled, gRef, onNoteRequest, onInfo, suppressInternalNoteMarkers])

	useEffect(() => {
		// keep external ref in sync
		if (externalSvgRef) {
			externalSvgRef.current = svgRef.current
		}
	}, [externalSvgRef, svgRef.current])

	// presence rendering (lightweight)
	useEffect(() => {
		if (!gRef.current) return
		const g = d3.select(gRef.current)
		const nodesSel = g.selectAll<SVGGElement, any>('g.nodes g.node')
		// remove old presence
		nodesSel.selectAll('g.presence').remove()
		// placeholder: no actual context wired here, keep structure for future
		// attach small circle avatar placeholder at top-left
		nodesSel.each(function(){
			const node = d3.select(this)
			const p = node.append('g').attr('class','presence')
			p.append('circle').attr('cx', -18).attr('cy', -18).attr('r', 7).attr('fill', 'rgba(64,196,255,0.9)')
			p.append('text').attr('x', -18).attr('y', -16).attr('text-anchor','middle').attr('font-size', 8).attr('fill', '#001018').text('U')
		})
	}, [gRef])

	// top banner placeholder for collaboration
	const collabBanner = (
		<Box sx={{ position: 'absolute', top: 0, right: 0, p: 0.5, px: 1, bgcolor: 'rgba(64,196,255,0.12)', border: '1px solid rgba(64,196,255,0.25)', borderRadius: 1, color: '#8ad7ff', fontSize: 11, display: 'none' }}>
			Collaboration Active
		</Box>
	)

	// Global Shift+Esc closes all facet overlays
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && (e.shiftKey || e.metaKey)) {
				try { d3.selectAll('g.facet-overlay').remove() } catch {}
			}
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [])

	return (
		<div ref={elementRef} style={{ 
			width: '100%', 
			height: responsive.isMobile ? '100vh' : 560, 
			position: 'relative',
			overflow: 'hidden'
		}}>
			{/* Responsive Main Toolbar */}
			<Paper 
				elevation={2} 
				sx={{ 
					position: 'absolute', 
					top: responsive.isMobile ? 'auto' : 8,
					bottom: responsive.isMobile ? 8 : 'auto',
					left: 8, 
					right: responsive.isMobile ? 8 : 'auto',
					zIndex: 2, 
					borderRadius: 2,
					overflow: 'hidden',
					maxWidth: responsive.isMobile ? 'none' : 'calc(100% - 180px)',
					transform: responsive.isMobile ? 'none' : undefined
				}}
			>
				{/* Primary Controls Row */}
				<Box sx={{ 
					p: responsive.isMobile ? 0.5 : 1, 
					display: 'flex', 
					alignItems: 'center', 
					gap: responsive.isMobile ? 0.5 : 1, 
					backgroundColor: 'rgba(25,25,35,0.95)',
					flexWrap: responsive.isMobile ? 'wrap' : 'nowrap',
					justifyContent: responsive.isMobile ? 'space-around' : 'flex-start'
				}}>
					{/* Core Controls */}
					<ButtonGroup size={responsive.isMobile ? 'medium' : 'small'} variant="outlined">
						<Button 
							variant={simulationMode ? 'contained' : 'outlined'}
							startIcon={simulationMode ? <PauseIcon /> : <PlayArrowIcon />}
							onClick={() => {
								const next = !simulationMode
								setSimulationMode(next)
								if (!next) resetStates()
								onInfo?.(next ? 'Simulation enabled' : 'Simulation disabled')
							}}
						>
							{simulationMode ? 'Pause' : 'Simulate'}
						</Button>
						<Button onClick={fitToContents}>
							Fit
						</Button>
						<Button onClick={centerOnSelection} disabled={!selectedNodeId}>
							Center
						</Button>
					</ButtonGroup>
					
					{/* Quick Search */}
					<IconButton 
						size={responsive.isMobile ? 'medium' : 'small'} 
						onClick={() => setShowNodeSearch(v => !v)}
						color={showNodeSearch ? 'primary' : 'default'}
						sx={{ minWidth: responsive.isMobile ? 44 : 'auto' }}
					>
						<SearchIcon />
					</IconButton>
					{!responsive.isMobile && (
						<IconButton size="small" onClick={async ()=>{ try { await navigator.clipboard.writeText(JSON.stringify({ nodes, edges }, null, 2)); onInfo?.('Copied graph JSON') } catch {} }} title="Copy Graph JSON">
							<ContentCopyIcon />
						</IconButton>
					)}
					<IconButton size="small" onClick={() => onExportFull?.()} title="Export Object">
						<DownloadIcon />
					</IconButton>
					<Button size="small" variant="outlined" component="label" title="Import Object">
						Import
						<input hidden type="file" accept="application/json" onChange={(e)=>{ const f=e.target.files?.[0]; if(f) onImportFull?.(f) }} />
					</Button>
					<IconButton size="small" onClick={() => {
						const overlay = document.createElement('div')
						overlay.style.position = 'fixed'
						overlay.style.right = '12px'
						overlay.style.top = '64px'
						overlay.style.zIndex = '9999'
						overlay.style.background = 'rgba(25,25,35,0.98)'
						overlay.style.border = '1px solid rgba(255,255,255,0.15)'
						overlay.style.borderRadius = '8px'
						overlay.style.padding = '12px'
						overlay.style.color = '#e0e0e0'
						overlay.style.fontSize = '12px'
						overlay.innerHTML = `
							<div style="font-weight:600;color:#40c4ff;margin-bottom:8px">Shortcuts</div>
							<div>n: Toggle Notes</div>
							<div>f: Fit</div>
							<div>c: Center on selection</div>
							<div>[/]: Cycle argument</div>
							<div>Enter: Center on selected node</div>
							<div style="margin-top:8px;color:#8ad7ff">Esc: Close</div>
						`
						document.body.appendChild(overlay)
						const onEsc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { overlay.remove(); window.removeEventListener('keydown', onEsc) } }
						window.addEventListener('keydown', onEsc)
					}} title="Shortcuts">
						<HelpOutlineIcon />
					</IconButton>
					{/* Notes Toggle (always visible in toolbar) */}
					{typeof onNotesToggle === 'function' && (
						<IconButton
							size="small"
							onClick={onNotesToggle}
							color={notesEnabled ? 'warning' : 'default'}
							title="Toggle Notes"
						>
							<StickyNote2Icon />
						</IconButton>
					)}
					{showNodeSearch && (
						<TextField 
							size="small" 
							placeholder="Search nodes..." 
							value={nodeSearchTerm} 
							onChange={(e) => setNodeSearchTerm(e.target.value)} 
							inputRef={nodeSearchRef} 
							sx={{ width: 160 }}
						/>
					)}

					{/* Mode Indicators and Quick Actions */}
					<Stack direction="row" spacing={0.5}>
						{typeof collabCount === 'number' && (
							<Chip size="small" label={`Collab: ${collabCount}`} variant="outlined" sx={{ ml: 1 }} />
						)}
						<Chip size="small" label={`Notes: ${notesCount}`} color={notesCount>0 ? 'warning' : 'default'} variant={notesCount>0 ? 'filled' : 'outlined'} sx={{ ml: 1 }} />
					</Stack>

					{/* Expand Toggle */}
					<IconButton 
						size="small" 
						onClick={() => setToolbarExpanded(v => !v)}
						sx={{ ml: 'auto' }}
						aria-label={toolbarExpanded ? 'Collapse toolbar' : 'Expand toolbar'}
					>
						{toolbarExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
					</IconButton>
				</Box>

				{/* Expanded Toolbar */}
				<Collapse in={toolbarExpanded}>
					<Box sx={{ p: 1, backgroundColor: 'rgba(35,35,45,0.98)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
						<Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
							{/* Visual Controls */}
							<ButtonGroup size="small">
								<Button 
									variant={showClusters ? 'contained' : 'outlined'}
									onClick={() => setShowClusters(s => !s)}
								>
									Clusters
								</Button>
								<Button 
									variant={showRivers ? 'contained' : 'outlined'}
									onClick={() => setShowRivers(s => !s)}
								>
									Rivers
								</Button>
								<Button 
									variant={pathHighlight ? 'contained' : 'outlined'}
									onClick={() => {
										setPathHighlight(s => {
											const next = !s
											onInfo?.(next ? 'Path highlight on' : 'Path highlight off')
											return next
										})
									}}
								>
									Highlight
								</Button>
								{typeof onNotesToggle === 'function' && (
									<Button 
										variant={notesEnabled ? 'contained' : 'outlined'}
										color={notesEnabled ? 'warning' : 'inherit'}
										onClick={onNotesToggle}
									>
										Notes
									</Button>
								)}
							</ButtonGroup>

							{/* Layout Controls */}
							<ButtonGroup size="small">
								<Button 
									variant={hierarchyMode ? 'contained' : 'outlined'}
									onClick={() => {
										const next = !hierarchyMode
										setHierarchyMode(next)
										try { localStorage.setItem('xv_hierarchy', next ? '1' : '0') } catch {}
										onInfo?.(next ? 'Hierarchy mode on' : 'Hierarchy mode off')
									}}
								>
									Hierarchy
								</Button>
								<Button 
									variant={showLegend ? 'contained' : 'outlined'}
									onClick={() => {
										const next = !showLegend
										setShowLegend(next)
										try { localStorage.setItem('xv_legend', next ? '1' : '0') } catch {}
										onInfo?.(next ? 'Legend shown' : 'Legend hidden')
									}}
								>
									Legend
								</Button>
								<Button 
									variant={showMiniMap ? 'contained' : 'outlined'}
									onClick={() => {
										const next = !showMiniMap
										setShowMiniMap(next)
										try { localStorage.setItem('xv_minimap', next ? '1' : '0') } catch {}
										onInfo?.(next ? 'Minimap on' : 'Minimap off')
									}}
								>
									Minimap
								</Button>
							</ButtonGroup>

							{/* Zone Controls */}
							<ButtonGroup size="small">
								<Button 
									variant={showInformalZone ? 'contained' : 'outlined'}
									onClick={() => setShowInformalZone(s => !s)}
								>
									Informal Zone
								</Button>
								<Button 
									variant={showTemporalZone ? 'contained' : 'outlined'}
									onClick={() => setShowTemporalZone(s => !s)}
								>
									Temporal Zone
								</Button>
								<Button 
									variant={snapEnabled ? 'contained' : 'outlined'}
									onClick={() => {
										const next = !snapEnabled
										setSnapEnabled(next)
										try { localStorage.setItem('xv_snap', next ? '1' : '0') } catch {}
										onInfo?.(next ? 'Snap enabled' : 'Snap disabled')
									}}
								>
									Snap
								</Button>
							</ButtonGroup>

							{/* Filter Controls */}
							<TextField 
								size="small" 
								placeholder="Filter rules..." 
								value={ruleFilter} 
								onChange={(e) => setRuleFilter(e.target.value)} 
								inputRef={ruleFilterRef}
								InputProps={{
									startAdornment: <FilterListIcon sx={{ mr: 1, color: 'action.active' }} />
								}}
								sx={{ width: 180 }}
							/>
							
							<Button 
								size="small" 
								variant="outlined" 
								onClick={() => {
									setRuleFilter('')
									setPathHighlight(false)
									setHideNonPath(false)
									setNodeSearchTerm('')
									onInfo?.('Cleared filters')
								}}
							>
								Clear
							</Button>

							<IconButton size="small" onClick={openMenu} aria-label="More options">
								<MoreVertIcon />
							</IconButton>
						</Stack>
					</Box>
				</Collapse>
			</Paper>

			{/* Argument Selector - Positioned Below Toolbar */}
			{argumentIds.length > 0 && (
				<Paper 
					elevation={1} 
					sx={{ 
						position: 'absolute', 
						top: toolbarExpanded ? 120 : 70, 
						left: 8, 
						zIndex: 1,
						p: 0.5,
						backgroundColor: 'rgba(25,25,35,0.95)',
						borderRadius: 1
					}}
				>
					<Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
						<span style={{ fontSize: 11, opacity: 0.7, marginRight: 4 }}>Args:</span>
						<Chip
							size="small"
							label="All"
							variant={!selectedArgumentId ? 'filled' : 'outlined'}
							onClick={() => { 
								setSelectedArgumentId(null); 
								if (storageKey) { 
									try { localStorage.removeItem(`xv_argument_${storageKey}`) } catch {} 
								} 
							}}
						/>
						{argumentIds.map(aid => (
							<Chip
								key={aid}
								size="small"
								label={aid}
								color={selectedArgumentId === aid ? 'warning' : 'default'}
								variant={selectedArgumentId === aid ? 'filled' : 'outlined'}
								onClick={() => {
									setSelectedArgumentId(prev => {
										const next = prev === aid ? null : aid
										if (storageKey) { 
											try { 
												if (next) localStorage.setItem(`xv_argument_${storageKey}`, next)
												else localStorage.removeItem(`xv_argument_${storageKey}`) 
											} catch {} 
										}
										return next
									})
								}}
							/>
						))}
					</Stack>
				</Paper>
			)}

			{/* Status Text */}
			{statusText && (
				<Box 
					sx={{ 
						position: 'absolute', 
						bottom: 8, 
						left: 8, 
						backgroundColor: 'rgba(0,0,0,0.7)', 
						color: 'white', 
						px: 1, 
						py: 0.5, 
						borderRadius: 1, 
						fontSize: 12,
						zIndex: 1
					}}
				>
					{statusText}
				</Box>
			)}
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
				{/* Legend */}
				<MenuItem disabled>Legend</MenuItem>
				<MenuItem disabled>Zones: Premises • Terms • Conclusions • Fallacies</MenuItem>
				<MenuItem disabled>Edges: solid=semantic, dashed=dashed rule, dotted=weak</MenuItem>
				<MenuItem disabled>Badges: color encodes rule; dot=weight</MenuItem>

				{/* View & Visuals */}
				<MenuItem onClick={() => { const next = !hierarchyMode; setHierarchyMode(next); try { localStorage.setItem('xv_hierarchy', next ? '1' : '0') } catch {}; onInfo?.(next ? 'Hierarchy mode on' : 'Hierarchy mode off'); closeMenu() }}>Hierarchy Mode</MenuItem>
				<MenuItem onClick={() => { setShowClusters(s=>!s); closeMenu() }}>{showClusters ? 'Hide Clusters' : 'Show Clusters'}</MenuItem>
				<MenuItem onClick={() => { setShowRivers(s=>!s); closeMenu() }}>{showRivers ? 'Hide Rivers' : 'Show Rivers'}</MenuItem>
				<MenuItem onClick={() => { setPathHighlight(s=>{ const next = !s; onInfo?.(next ? 'Path highlight on' : 'Path highlight off'); return next }); closeMenu() }}>{pathHighlight ? 'Disable Path Highlight' : 'Enable Path Highlight'}</MenuItem>
				<MenuItem onClick={() => { setHideNonPath(s=>!s); onInfo?.('Toggled Isolate Path'); closeMenu() }}>{hideNonPath ? 'Show All Paths' : 'Isolate Path'}</MenuItem>
				<MenuItem onClick={() => { const next = !showInformalZone; setShowInformalZone(next); closeMenu() }}>{showInformalZone ? 'Hide Informal Zone' : 'Show Informal Zone'}</MenuItem>
				<MenuItem onClick={() => { const next = !showTemporalZone; setShowTemporalZone(next); closeMenu() }}>{showTemporalZone ? 'Hide Temporal Zone' : 'Show Temporal Zone'}</MenuItem>
				<MenuItem onClick={() => { const next = !showMiniMap; setShowMiniMap(next); try { localStorage.setItem('xv_minimap', next ? '1' : '0') } catch {}; onInfo?.(next ? 'Minimap on' : 'Minimap off'); closeMenu() }}>{showMiniMap ? 'Hide Minimap' : 'Show Minimap'}</MenuItem>
				<Divider />

				{/* Layout */}
				<MenuItem onClick={() => { saveLayout(); onInfo?.('Layout saved'); closeMenu() }}>Save Layout</MenuItem>
				<MenuItem onClick={() => { exportLayoutJson(); closeMenu() }}>Export Layout JSON</MenuItem>
				<MenuItem onClick={() => { clearLayout(); closeMenu() }}>Clear Saved Layout</MenuItem>
				<MenuItem onClick={() => { const next = !dynamicFit; setDynamicFit(next); try { localStorage.setItem('xv_dynamic_fit', next ? '1' : '0') } catch {}; onInfo?.(next ? 'Dynamic fit on' : 'Dynamic fit off'); closeMenu() }}>{dynamicFit ? 'Disable Dynamic Fit' : 'Enable Dynamic Fit'}</MenuItem>
				<MenuItem onClick={() => { resetZoom(); closeMenu() }}>Reset View</MenuItem>
				<Divider />

				{/* Import / Export */}
				<MenuItem onClick={() => { onExportFull?.(); closeMenu() }}>Export Full Object</MenuItem>
				<MenuItem>
					<label style={{ cursor: 'pointer' }}>
						Import Object JSON<input hidden type="file" accept="application/json" onChange={(e)=>{ const f=e.target.files?.[0]; if (f) onImportFull?.(f); closeMenu() }} />
					</label>
				</MenuItem>
				<MenuItem onClick={() => { exportSvg(); closeMenu() }}>Export SVG</MenuItem>
				<MenuItem onClick={() => { exportPng(); closeMenu() }}>Export PNG</MenuItem>
				<MenuItem onClick={async () => { try { await navigator.clipboard.writeText(JSON.stringify({ nodes, edges }, null, 2)); onInfo?.('Copied graph JSON') } catch {}; closeMenu() }}>Copy Graph JSON</MenuItem>
				<Divider />

				{/* Utilities */}
				<MenuItem onClick={() => { setBatchDialogOpen(true); closeMenu() }}>
					<BatchPredictionIcon sx={{ mr: 1 }} />
					Batch Operations
				</MenuItem>
				<MenuItem onClick={() => { const next = !showNodeSearch; setShowNodeSearch(next); if (next) setTimeout(() => nodeSearchRef.current?.focus(), 100); onInfo?.(next ? 'Node search on' : 'Node search off'); closeMenu() }}>{showNodeSearch ? 'Hide Node Search' : 'Show Node Search'}</MenuItem>
				<MenuItem onClick={() => { setShowHelp(v=>!v); closeMenu() }}>{showHelp ? 'Hide Shortcuts' : 'Show Shortcuts'}</MenuItem>
				<MenuItem onClick={() => { const next = !showLegend; setShowLegend(next); try { localStorage.setItem('xv_legend', next ? '1' : '0') } catch {}; onInfo?.(next ? 'Legend shown' : 'Legend hidden'); closeMenu() }}>{showLegend ? 'Hide Legend' : 'Show Legend'}</MenuItem>
				<MenuItem onClick={() => { copySelectedDetails(); closeMenu() }} disabled={!selectedNodeId}>Copy Selected Details</MenuItem>
			</Menu>
			<input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={async (e) => {
				const f = e.target?.files?.[0]
				if (!f) return
				try {
					const text = await f.text()
					const data = JSON.parse(text)
					if (data && data.layout && typeof data.layout === 'object') {
						if (storageKey) localStorage.setItem(`xv_layout_${storageKey}`, JSON.stringify(data.layout))
						onInfo?.('Layout imported')
						if (simulationRef.current) simulationRef.current.alpha(0.8).restart()
					}
				} catch { onInfo?.('Import failed') }
				(e.target as HTMLInputElement).value = ''
			}} />
			{/* Node search results */}
			{showNodeSearch && filteredSearchNodes.length > 0 && (
				<div style={{ position: 'absolute', top: 50, right: 8, background: 'rgba(20,20,30,0.95)', border: '1px solid rgba(64,196,255,0.35)', borderRadius: 8, padding: 8, maxWidth: 300, zIndex: 1000 }}>
					<div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 4, color: 'rgba(64,196,255,0.8)' }}>Search Results ({filteredSearchNodes.length}) {selectedSearchIndex >= 0 && `• ↑↓ Navigate • Enter: Select`}</div>
					{filteredSearchNodes.map((node, index) => (
						<div key={node.id} 
							 style={{ 
								 padding: '4px 8px', 
								 cursor: 'pointer', 
								 borderRadius: 4, 
								 marginBottom: 2,
								 backgroundColor: index === selectedSearchIndex ? 'rgba(255,193,7,0.3)' :
													selectedNodeId === node.id ? 'rgba(64,196,255,0.2)' : 'transparent',
								 fontSize: 11,
								 border: index === selectedSearchIndex ? '1px solid rgba(255,193,7,0.8)' :
										selectedNodeId === node.id ? '1px solid rgba(64,196,255,0.5)' : '1px solid transparent'
							 }}
							 onClick={() => {
								 setSelectedNodeId(node.id)
								 if (storageKey) { try { localStorage.setItem(`xv_selected_${storageKey}`, node.id) } catch {} }
								 // center on node
								 const nodeEl = (nodes as any[]).find(n => n.id === node.id)
								 if (nodeEl && svgRef.current && zoomRef.current) {
									 const transform = d3.zoomTransform(svgRef.current)
									 const k = transform.k
									 const centerX = svgRef.current.clientWidth / 2
									 const centerY = svgRef.current.clientHeight / 2
									 const newTransform = d3.zoomIdentity.translate(centerX - nodeEl.x * k, centerY - nodeEl.y * k).scale(k)
									 d3.select(svgRef.current).transition().duration(750).call(zoomRef.current.transform, newTransform)
								 }
								 onInfo?.(`Selected ${node.name || node.symbol || node.id}`)
							 }}>
							<div style={{ fontWeight: 'bold', color: '#fff' }}>{node.name || node.symbol || node.id}</div>
							{node.translation && <div style={{ color: 'rgba(255,255,255,0.7)' }}>{node.translation}</div>}
							<div style={{ color: 'rgba(255,255,255,0.5)' }}>{node.type} • {node.zone || 'no zone'}</div>
						</div>
					))}
				</div>
			)}
			{showMiniMap && (
				<svg ref={miniMapRef} width={160} height={110} style={{ position: 'absolute', right: 8, bottom: 8, background: 'rgba(20,20,30,0.6)', border: '1px solid rgba(64,196,255,0.25)', borderRadius: 6 }} />
			)}
			{showHelp && (
				<MuiDialog open={showHelp} onClose={() => setShowHelp(false)} aria-labelledby="shortcuts-title">
					<MuiDialogTitle id="shortcuts-title">Keyboard Shortcuts</MuiDialogTitle>
					<MuiDialogContent dividers>
						<Box component="ul" sx={{ pl: 2, m: 0 }}>
							<li>n: Toggle Notes</li>
							<li>f: Fit • c/z: Center • Enter: Center on selected</li>
							<li>[ ]: Cycle arguments • /: Filter rules • Ctrl+F: Search</li>
							<li>t: Toggle labels • h: Highlight path • m: Simulation</li>
							<li>l: Legend • d: Dynamic fit • i: Isolate path</li>
						</Box>
					</MuiDialogContent>
					<MuiDialogActions>
						<Button onClick={() => setShowHelp(false)}>Close</Button>
					</MuiDialogActions>
				</MuiDialog>
			)}
			{collabBanner}
			
			{/* Batch Operations Dialog */}
			<BatchOperationsDialog
				open={batchDialogOpen}
				onClose={() => setBatchDialogOpen(false)}
			/>
		</div>
	)
}

export default ZlfnGraph

// ARIA note: main graph controls include buttons with labels; link badges have titles for screen readers. Path highlight is indicated by a status message and dimming non-path elements.

// Relevance helpers (heuristic, fast)
function isTruthTableRelevant(d: any): boolean {
    const s = (d?.symbol || d?.label || '').toString()
    return /[¬∧∨⊻→↔]|\b(and|or|not)\b/i.test(s)
}
function isVennRelevant(d: any): boolean {
    const t = (d?.translation || '').toString()
    const s = (d?.symbol || '').toString()
    return /\b(all|some|no)\b/i.test(t) || /→|↔/.test(s)
}
function isTimelineRelevant(d: any): boolean {
    return (d?.zone === 'temporal' || d?.zoneId === 'temporal')
}
function isCounterRelevant(d: any): boolean {
    return (d?.type === 'fallacy')
}


