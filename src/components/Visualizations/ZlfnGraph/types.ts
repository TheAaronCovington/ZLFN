/**
 * Type definitions for ZlfnGraph components
 * Shared interfaces and types used across ZlfnGraph modules
 */

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
  // Optional logical state and weight for interoperability with ATN/ZLFN features
  state?: 'T' | 'F' | 'B'
  weight?: number
  layoutMode?: LayoutMode  // For Core nodes: determines arrangement pattern
  complexity?: 'simple' | 'moderate' | 'complex'  // Influences layout mode selection
  centralHub?: boolean  // Marks this as a central argument hub
  connectedArguments?: string[]  // Arguments this Core connects
  facets?: { 
    vennRelevant?: boolean
    truthTableRelevant?: boolean
    timelineRelevant?: boolean
    counterRelevant?: boolean
    rebuttalRelevant?: boolean
    noteRelevant?: boolean
  }
  color?: string
  size?: { width: number; height: number } | { radius: number }
  label?: string
  markdownRef?: string  // Reference to markdown document section
  
  // D3 simulation properties (added at runtime)
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
  vx?: number
  vy?: number
  index?: number
}

export type ZlfnEdge = {
  id?: string
  from?: string
  to?: string
  source?: string | ZlfnNode
  target?: string | ZlfnNode
  type?: 'implication' | 'counterexample' | 'bidirectional' | 'semantic'
  weight?: number
  rule?: string
  style?: 'solid' | 'dashed' | 'dotted'
  priority?: number
  label?: string
  color?: string
  clusterKey?: string
  
  // D3 simulation properties (added at runtime)
  index?: number
}

export type ZlfnZone = {
  id: string
  name: string
  color: string
  xRange: [number, number]
  yRange: [number, number]
  visible?: boolean
}

export interface ZlfnGraphProps {
  nodes: ZlfnNode[]
  edges: ZlfnEdge[]
  zones?: ZlfnZone[]
  storageKey?: string
  onInfo?: (msg: string, severity?: 'success' | 'info' | 'warning' | 'error') => void
  centerOnSelectionTrigger?: number
  centerOnNodeId?: string
  centerOnNodeTrigger?: number
  onEdgeSelect?: (edge: ZlfnEdge | null) => void
  onOpenTruthTable?: (expr: string) => void
  onNotesToggle?: () => void
  notesEnabled?: boolean
  onNoteRequest?: (nodeId: string) => void
  externalSvgRef?: React.RefObject<SVGSVGElement>
  suppressInternalNoteMarkers?: boolean
  showNotesIndicators?: boolean
  onExportFull?: () => void
  onImportFull?: (file: File) => void
  collabCount?: number
  objectId?: string
  disableShortcuts?: boolean
  onNodeUpdate?: (node: ZlfnNode) => void
}

export interface GraphState {
  frozen: boolean
  pathHighlight: boolean
  showEdgeLabels: boolean
  hierarchyMode: boolean
  showClusters: boolean
  showRivers: boolean
  hideNonPath: boolean
  selectedEdgeIndex: number | null
  ruleFilter: string
  pinnedIds: Set<string>
  tooltip: { x: number; y: number; html: string } | null
}

export interface GraphRefs {
  svg: React.RefObject<SVGSVGElement>
  g: React.RefObject<SVGGElement>
  miniMap: React.RefObject<SVGSVGElement>
  zoom: React.RefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>
  transform: React.RefObject<d3.ZoomTransform>
  simulation: React.RefObject<d3.Simulation<any, any> | null>
  initialFitDone: React.RefObject<boolean>
  centeredAfterSim: React.RefObject<boolean>
  termsBaselineY: React.RefObject<Record<string, number>>
  layoutLoaded: React.RefObject<string | null>
  stableTicks: React.RefObject<number>
  pathCentroid: React.RefObject<{ x: number; y: number } | null>
  mmBounds: React.RefObject<{ minX: number; minY: number; sx: number; sy: number } | null>
  ruleFilter: React.RefObject<HTMLInputElement | null>
}

export interface NodeSearchState {
  showNodeSearch: boolean
  nodeSearchTerm: string
  selectedSearchIndex: number
}

export interface LayoutHistoryEntry {
  nodes: Array<{ id: string; x: number; y: number; fx?: number | null; fy?: number | null }>
  timestamp: number
}

export interface GraphCallbacks {
  onInfo?: (msg: string, severity?: 'success' | 'info' | 'warning' | 'error') => void
  onEdgeSelect?: (edge: ZlfnEdge | null) => void
  onOpenTruthTable?: (expr: string) => void
  onNotesToggle?: () => void
  onNoteRequest?: (nodeId: string) => void
  onExportFull?: () => void
  onImportFull?: (file: File) => void
  onNodeUpdate?: (node: ZlfnNode) => void
}

export interface RenderConfig {
  width: number
  height: number
  showEdgeLabels: boolean
  pathHighlight: boolean
  hideNonPath: boolean
  showRivers: boolean
  ruleFilter: string
  selectedEdgeIndex: number | null
  pinnedIds: Set<string>
}

export interface InteractionConfig {
  disableShortcuts: boolean
  notesEnabled: boolean
  suppressInternalNoteMarkers: boolean
  showNotesIndicators: boolean
}
