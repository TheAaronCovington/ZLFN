/**
 * Argument Normalization Service
 * Converts various input formats (document, expression, imported JSON) to SharedArgument[]
 * Handles field mapping and defaults for ZLFN/STN/ATN compatibility
 */

import type { SharedArgument } from '../context/LogicSharedContext'
import type { ZlfnNode, ZlfnEdge } from '../components/Visualizations/ZlfnGraph/types'
// Removed unused imports - these will be needed when we implement full normalization
import { parseDocumentToGraph } from './documentParser'

// Input JSON structure (generalized format from user instructions)
export interface ImportedArgument {
  core: {
    name: string
    summary?: string
    layoutMode?: string
    variables?: Record<string, any>
    mode?: {
      zlfMode?: boolean
      stnMode?: boolean
      atnMode?: boolean
    }
    layoutOptions?: string[]
  }
  zones?: Array<{
    name: string
    range: { xMin: number; xMax: number }
    color?: string
    nodes: Array<{
      id: string
      name?: string
      symbolic?: string
      translation?: string
      type?: string
      vennRelevant?: boolean
      timelineRelevant?: boolean
      facets?: any[]
      closed?: boolean
      markdownRef?: string
      status?: {
        closed?: boolean
        attacked?: boolean
      }
      decomposed?: boolean
      closureIntent?: boolean
    }>
  }>
  dependencies?: Array<{
    sourceId: string
    targetId: string
    type: string
    weight?: number
    rule?: string
    scheme?: string
    priority?: number
  }>
  modes?: {
    propositional?: boolean
    predicate?: boolean
    epistemic?: boolean
    deontic?: boolean
    temporal?: boolean
    informal?: boolean
    paraconsistent?: boolean
    fuzzy?: boolean
  }
  counterarguments?: Array<{
    name: string
    summary?: string
    facets?: any[]
    dependencies?: Array<{
      sourceId: string
      targetId: string
      type: string
      weight?: number
      rule?: string
      priority?: number
    }>
  }>
  metadata?: {
    confidence?: number
    uncertain?: string[]
  }
  validation?: {
    errors?: string[]
    warnings?: string[]
  }
  pagination?: {
    page?: number
    total?: number
  }
}

export interface ImportedJSON {
  arguments: ImportedArgument[]
}

/**
 * Normalize imported JSON to SharedArgument format
 */
export function normalizeImportedJSON(json: ImportedJSON, documentContent?: string): SharedArgument[] {
  return json.arguments.map((arg, index) => {
    const argumentId = `imported-${index + 1}`
    
    // Normalize core
    const core = {
      name: arg.core.name || "Default Argument",
      summary: arg.core.summary || "Summary of the argument",
      layoutMode: arg.core.layoutMode || "network",
      variables: arg.core.variables || {},
      mode: arg.core.mode || { zlfMode: false, stnMode: false, atnMode: false },
      layoutOptions: arg.core.layoutOptions || ["network", "tree", "table", "hierarchical"]
    }

    // Normalize zones and nodes
    const zones = (arg.zones || []).map(zone => ({
      id: zone.name.toLowerCase().replace(/\s+/g, '-'),
      name: zone.name || "Default Zone",
      color: zone.color || "#26a69a",
      xRange: [zone.range.xMin, zone.range.xMax] as [number, number],
      yRange: [80, 300] as [number, number], // Default yRange for ZLFN
      visible: true
    }))

    // Normalize nodes
    const nodes: ZlfnNode[] = []
    zones.forEach(zone => {
      const zoneNodes = arg.zones?.find(z => z.name === zone.name)?.nodes || []
      zoneNodes.forEach((node, nodeIndex) => {
        const normalizedNode: ZlfnNode = {
          id: node.id || `node${nodeIndex + 1}`,
          name: node.name || `Node ${nodeIndex + 1} Name`,
          symbol: node.symbolic || `P${nodeIndex + 1}`,
          label: node.name || node.symbolic || `P${nodeIndex + 1}`,
          translation: node.translation || `Statement ${node.symbolic || `P${nodeIndex + 1}`} is true`,
          type: normalizeNodeType(node.type || "generic"),
          zone: zone.name,
          zoneId: zone.id,
          argumentId,
          facets: {
            vennRelevant: node.vennRelevant || false,
            truthTableRelevant: false, // Default
            timelineRelevant: node.timelineRelevant || false,
            counterRelevant: false
          },
          color: getNodeColor(normalizeNodeType(node.type || "generic")),
          size: getNodeSize(normalizeNodeType(node.type || "generic")),
          markdownRef: node.markdownRef || undefined
          // Note: STN-specific fields like closed, decomposed will be handled during STN conversion
        }
        
        // ATN-specific fields
        if (node.status?.attacked) {
          (normalizedNode as any).attackedBy = [] // Will be populated when processing dependencies
        }
        
        nodes.push(normalizedNode)
      })
    })

    // Normalize dependencies/edges
    const edges: ZlfnEdge[] = (arg.dependencies || []).map((dep, depIndex) => {
      const normalizedEdge: ZlfnEdge = {
        id: `edge-${depIndex + 1}`,
        from: dep.sourceId,
        to: dep.targetId,
        weight: dep.weight || 75,
        rule: titleCaseRule(dep.rule || "modus ponens"),
        priority: dep.priority || 1,
        // ZLFN mapping
        type: mapDependencyTypeToZlfn(dep.type),
        style: mapDependencyTypeToStyle(dep.type)
        // Note: ATN-specific fields like relationshipType will be added during ATN conversion
      }
      
      return normalizedEdge
    })

    // Process counterarguments
    if (arg.counterarguments) {
      arg.counterarguments.forEach((counter, counterIndex) => {
        // Add counter nodes
        const counterNode: ZlfnNode = {
          id: `counter-${counterIndex + 1}`,
          name: counter.name || `Rebuttal ${counterIndex + 1}`,
          label: counter.name || `Rebuttal ${counterIndex + 1}`,
          translation: counter.summary || "Opposes the claim",
          type: "fallacy",
          argumentId,
          facets: {
            counterRelevant: true
          },
          color: "#DC143C",
          size: { width: 100, height: 30 }
        }
        nodes.push(counterNode)

        // Add counter dependencies
        if (counter.dependencies) {
          counter.dependencies.forEach((counterDep, counterDepIndex) => {
            const counterEdge: ZlfnEdge = {
              id: `counter-edge-${counterIndex + 1}-${counterDepIndex + 1}`,
              from: counterDep.sourceId,
              to: counterDep.targetId,
              weight: counterDep.weight || 60,
              rule: titleCaseRule(counterDep.rule || "rebuttal"),
              type: "counterexample",
              style: "dashed"
            }
            edges.push(counterEdge)
          })
        }
      })
    }

    // Create expressions from nodes (simplified)
    const expressions = nodes
      .filter(node => node.symbol && node.symbol !== node.id)
      .map(node => node.symbol!)
      .slice(0, 3) // Limit to first 3 for expression parsing

    const sharedArgument: SharedArgument = {
      id: argumentId,
      title: core.name,
      markdown: {
        documentId: argumentId,
        content: documentContent || `# ${core.name}\n\n${core.summary || ''}`
      },
      expressions: expressions.length > 0 ? expressions : ['P → Q'], // Fallback
      // Pre-populate derived data
      zlfnGraph: { nodes, edges },
      // Notes will be empty initially
      notes: {}
    }

    return sharedArgument
  })
}

/**
 * Create SharedArgument from expression
 */
export function normalizeExpression(expression: string, title?: string): SharedArgument {
  const argumentId = `expression-${Date.now()}`
  
  return {
    id: argumentId,
    title: title || `Expression: ${expression}`,
    markdown: {
      documentId: argumentId,
      content: `# ${title || 'Logic Expression'}\n\nExpression: \`${expression}\``
    },
    expressions: [expression]
  }
}

/**
 * Create SharedArgument from document
 */
export async function normalizeDocument(documentId: string, content: string): Promise<SharedArgument[]> {
  try {
    const documentGraphData = await parseDocumentToGraph(documentId)
    if (!documentGraphData) {
      throw new Error('Failed to parse document')
    }

    // Convert document graph data to SharedArgument format
    const sharedArguments: SharedArgument[] = documentGraphData.arguments.map(arg => ({
      id: arg.id,
      title: arg.title,
      markdown: {
        documentId,
        content
      },
      expressions: arg.expressions,
      zlfnGraph: {
        nodes: documentGraphData.nodes,
        edges: documentGraphData.edges
      },
      refs: documentGraphData.nodes.reduce((acc, node) => {
        if (node.markdownRef) {
          acc[node.id] = node.markdownRef
        }
        return acc
      }, {} as Record<string, string>),
      notes: {}
    }))

    return sharedArguments
  } catch (error) {
    console.error('Error normalizing document:', error)
    // Fallback: create a simple argument from document content
    return [{
      id: documentId,
      title: `Document: ${documentId}`,
      markdown: { documentId, content },
      expressions: ['P → Q'], // Fallback expression
      notes: {}
    }]
  }
}

// Helper functions

function normalizeNodeType(type: string): ZlfnNode['type'] {
  const typeMap: Record<string, ZlfnNode['type']> = {
    'generic': 'term',
    'premise': 'premise',
    'conclusion': 'conclusion',
    'term': 'term',
    'fallacy': 'fallacy',
    'core': 'core',
    'informal': 'informal',
    'temporal': 'temporal'
  }
  return typeMap[type] || 'term'
}

function getNodeColor(type: ZlfnNode['type']): string {
  const colorMap: Record<string, string> = {
    'premise': '#20B2AA',
    'conclusion': '#9370DB',
    'term': '#4169E1',
    'fallacy': '#DC143C',
    'core': '#FFD700',
    'informal': '#FF8C00',
    'temporal': '#8A2BE2'
  }
  return colorMap[type || 'term'] || '#4169E1'
}

function getNodeSize(type: ZlfnNode['type']): { width: number; height: number } | { radius: number } {
  if (type === 'term') {
    return { radius: 20 }
  }
  return { width: 100, height: 30 }
}

function mapDependencyTypeToZlfn(type: string): ZlfnEdge['type'] {
  const typeMap: Record<string, ZlfnEdge['type']> = {
    'support': 'implication',
    'attack': 'counterexample',
    'undercut': 'counterexample'
  }
  return typeMap[type] || 'implication'
}

function mapDependencyTypeToStyle(type: string): ZlfnEdge['style'] {
  const styleMap: Record<string, ZlfnEdge['style']> = {
    'support': 'solid',
    'attack': 'dashed',
    'undercut': 'dashed'
  }
  return styleMap[type] || 'solid'
}

function titleCaseRule(rule: string): string {
  // Convert "modus ponens" to "Modus Ponens"
  return rule
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
