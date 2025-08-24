/**
 * Argument Tableau Network (ATN) Types
 * ATN-local types extending base shapes without global mutations
 */

import type { ZlfnNode, ZlfnEdge } from '../ZlfnGraph/types'

export type ArgumentType = 'claim' | 'ground' | 'warrant' | 'backing' | 'rebuttal' | 'qualifier'
export type RelationshipType = 'support' | 'attack' | 'undercut'
export type ATNLayoutMode = 'tree' | 'hierarchical' | 'table'

/**
 * Argument node extending base ZlfnNode with argument-specific properties
 */
export interface ArgumentNode extends ZlfnNode {
  // Argument-specific properties
  argumentType: ArgumentType
  argumentId: string
  scheme?: string
  strength?: number // 0-100, rhetorical confidence
  attackedBy?: string[] // IDs of nodes that attack this one
  
  // Layout properties
  atnLayoutMode?: ATNLayoutMode
  
  // Facet properties (extend existing)
  facets?: {
    vennRelevant?: boolean
    truthTableRelevant?: boolean
    timelineRelevant?: boolean
    counterRelevant?: boolean
    rebuttalRelevant?: boolean // New for ATN
    noteRelevant?: boolean
  }
}

/**
 * Argument edge extending base ZlfnEdge with relationship properties
 */
export interface ArgumentEdge extends ZlfnEdge {
  // Relationship properties
  relationshipType: RelationshipType
  scheme: string // Argumentation scheme (e.g., "Authority", "Practical Reasoning")
  confidence: number // 0-100, strength of the relationship
  
  // Visual properties
  clustered?: boolean // Whether this edge is part of a scheme cluster
  clusterLabel?: string // Label for the cluster this edge belongs to
}

/**
 * Argument data structure for a complete argument
 */
export interface ArgumentData {
  id: string
  name: string
  description?: string
  core: ArgumentNode // The main claim
  components: ArgumentNode[] // Grounds, warrants, backings, rebuttals, qualifiers
  relationships: ArgumentEdge[] // Support/attack/undercut relationships
  layoutMode: ATNLayoutMode
  metadata?: {
    created?: string
    modified?: string
    author?: string
    tags?: string[]
  }
}

/**
 * Multi-argument container
 */
export interface ArgumentCollection {
  arguments: ArgumentData[]
  selectedArgumentId?: string
  globalSettings?: {
    showSchemeLabels?: boolean
    clusterByScheme?: boolean
    defaultLayoutMode?: ATNLayoutMode
  }
}

/**
 * Argumentation scheme metadata
 */
export interface ArgumentationScheme {
  name: string
  description: string
  strength: number // Base strength 0-1
  applicableTypes: ArgumentType[]
  examples?: string[]
  validModes?: string[] // Logic modes where this scheme is valid
}

/**
 * Attack detection result
 */
export interface AttackResult {
  isAttacked: boolean
  attackers: string[]
  attackType: 'direct' | 'undercut' | 'rebuttal'
  severity: number // 0-1
}

/**
 * Scheme cluster for visual grouping
 */
export interface SchemeCluster {
  scheme: string
  edges: ArgumentEdge[]
  priority: number
  label: string
  color?: string
}

/**
 * ATN component props
 */
export interface ArgumentTableauProps {
  expression: string
  ast?: any // AST from logic service
  compact?: boolean
  // Optional: unified shared-data argument to render instead of the demo
  argument?: ArgumentData
  onArgumentSelect?: (argumentId: string) => void
  onNodeSelect?: (node: ArgumentNode) => void
  onEdgeSelect?: (edge: ArgumentEdge) => void
  onLayoutModeChange?: (mode: ATNLayoutMode) => void
  // Schemes data callbacks for inspector sidebar
  onSchemeClustersChange?: (clusters: SchemeCluster[]) => void
  onSchemeClusterClickChange?: (clickHandler: (cluster: SchemeCluster) => void) => void
}

/**
 * ATN render configuration
 */
export interface ArgumentRenderConfig {
  width: number
  height: number
  layoutMode: ATNLayoutMode
  showSchemeLabels: boolean
  clusterByScheme: boolean
  nodeSpacing: [number, number] // [width, height] spacing for tree layout
  edgeStyle: {
    support: { stroke: string; strokeWidth: number; strokeDasharray?: string }
    attack: { stroke: string; strokeWidth: number; strokeDasharray: string }
    undercut: { stroke: string; strokeWidth: number; strokeDasharray: string }
  }
}

/**
 * Default argument render configuration
 */
export const DEFAULT_ATN_CONFIG: ArgumentRenderConfig = {
  width: 800,
  height: 600,
  layoutMode: 'tree',
  showSchemeLabels: true,
  clusterByScheme: true,
  nodeSpacing: [120, 80],
  edgeStyle: {
    support: { stroke: '#4CAF50', strokeWidth: 2 },
    attack: { stroke: '#F44336', strokeWidth: 2, strokeDasharray: '5,5' },
    undercut: { stroke: '#FF9800', strokeWidth: 2, strokeDasharray: '2,3' }
  }
}

/**
 * Color scheme for argument types
 */
export const ARGUMENT_COLORS: Record<ArgumentType, string> = {
  claim: '#1976D2', // Blue - prominent
  ground: '#388E3C', // Green - evidence
  warrant: '#7B1FA2', // Purple - justification
  backing: '#303F9F', // Indigo - support for warrant
  rebuttal: '#D32F2F', // Red - counterargument
  qualifier: '#F57C00' // Orange - strength indicator
}

/**
 * Helper function to convert ZlfnNode to ArgumentNode
 */
export function toArgumentNode(node: ZlfnNode, argumentType: ArgumentType, argumentId: string): ArgumentNode {
  return {
    ...node,
    argumentType,
    argumentId,
    strength: 80, // Default strength
    facets: {
      ...node.facets,
      rebuttalRelevant: argumentType === 'rebuttal',
      noteRelevant: true
    }
  }
}

/**
 * Helper function to convert ZlfnEdge to ArgumentEdge
 */
export function toArgumentEdge(edge: ZlfnEdge, relationshipType: RelationshipType, scheme: string): ArgumentEdge {
  return {
    ...edge,
    relationshipType,
    scheme,
    confidence: edge.weight || 70, // Use existing weight as confidence
    clustered: false
  }
}
