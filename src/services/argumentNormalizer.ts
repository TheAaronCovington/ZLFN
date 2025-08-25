/**
 * Argument Normalization Service
 * Converts various input formats (document, expression, imported JSON) to SharedArgument[]
 * Handles field mapping and defaults for ZLFN/ATN compatibility
 */

import type { SharedArgument } from '../context/types'
import type { ZlfnNode, ZlfnEdge } from '../components/Visualizations/ZlfnGraph/types'
// Removed unused imports - these will be needed when we implement full normalization
import { parseContentToGraph } from './documentParser'

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
      mode: {
        zlfMode: arg.core.mode?.zlfMode || false,
        atnMode: arg.core.mode?.atnMode || false,
        zlfConfig: { autoExpansion: (arg.core as any).mode?.zlfConfig?.autoExpansion || false },
        atnConfig: { schemePriority: (arg.core as any).mode?.atnConfig?.schemePriority || "" }
      },
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
            truthTableRelevant: node as unknown as any && (node as any).truthTableRelevant || false,
            timelineRelevant: node.timelineRelevant || false,
            counterRelevant: (node as any).counterRelevant || false,
            rebuttalRelevant: (node as any).rebuttalRelevant || false,
            noteRelevant: true
          },
          state: (node as any).state || 'T',
          weight: typeof (node as any).weight === 'number' ? (node as any).weight : 50,
          color: getNodeColor(normalizeNodeType(node.type || "generic")),
          size: getNodeSize(normalizeNodeType(node.type || "generic")),
          markdownRef: node.markdownRef || undefined
          // Note: Additional fields for future expansion
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
      
      // Basic scheme validation (confidence >= 70 for support/attack/undercut if present)
      const isDebatable = dep.type === 'attack' || dep.type === 'undercut'
      const minConfidence = isDebatable ? 60 : 50
      const conf = (dep as any).confidence as number | undefined
      if (typeof conf === 'number' && conf < minConfidence) {
        // Flag weak edges by style
        normalizedEdge.style = 'dotted'
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

    // Synthesize a main expression from supports/attacks
    // (pickConclusionId inlined into synthesizeExpressionFromGraph)

    // (symbolFor is provided by synthesizeExpressionFromGraph)

    function synthesizeExpression(): string {
      return synthesizeExpressionFromGraph(nodes, edges)
    }

    const synthesized = synthesizeExpression()
    const expressions = [synthesized]

    const sharedArgument: SharedArgument = {
      id: argumentId,
      title: core.name,
      markdown: {
        documentId: argumentId,
        content: documentContent || `# ${core.name}\n\n${core.summary || ''}`
      },
      expressions: expressions.length > 0 ? expressions : ['P → Q'],
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
    const documentGraphData = parseContentToGraph(documentId, content)
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

/**
 * Extract nodes and edges from ZLFNStructure arguments
 */
export function extractNodesAndEdgesFromArguments(zlfnJson: any): Record<string, { nodes: any[], edges: any[] }> {
  const result: Record<string, { nodes: any[], edges: any[] }> = {}
  
  if (!zlfnJson || !zlfnJson.arguments) {
    return result
  }
  
  // Extract from each argument
  zlfnJson.arguments.forEach((arg: any) => {
    const argumentId = arg.id || `argument-${Object.keys(result).length + 1}`
    result[argumentId] = { nodes: [], edges: [] }

    // Extract nodes from zones
    if (arg.zones) {
      arg.zones.forEach((zone: any) => {
        if (zone.nodes) {
          zone.nodes.forEach((node: any) => {
            result[argumentId].nodes.push({
              id: node.id,
              label: node.name || node.id,
              name: node.name,
              type: normalizeNodeType(node.type || 'term'),
              zone: zone.name,
              state: node.state || 'T',
              weight: typeof node.weight === 'number' ? node.weight : 50,
              symbol: node.symbolic,
              translation: node.translation,
              facets: {
                vennRelevant: node.vennRelevant || false,
                truthTableRelevant: node.truthTableRelevant || false,
                timelineRelevant: node.timelineRelevant || false,
                counterRelevant: false,
                noteRelevant: true
              },
              color: getNodeColor(normalizeNodeType(node.type || 'term')),
              size: getNodeSize(normalizeNodeType(node.type || 'term'))
            })
          })
        }
      })
    }
    
    // Extract edges from dependencies
    if (arg.dependencies) {
      arg.dependencies.forEach((dep: any, index: number) => {
        result[argumentId].edges.push({
          id: dep.id || `edge-${index}`,
          from: dep.source || dep.sourceId,
          to: dep.target || dep.targetId,
          rule: dep.rule || '',
          weight: typeof dep.weight === 'number' ? dep.weight : 50,
          type: dep.type || 'inference',
          style: mapDependencyTypeToStyle(dep.type || 'inference'),
          priority: dep.priority || 1
        })
      })
    }
  })
  
  return result
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

// Exported helper: synthesize a propositional expression from a ZLFN graph
export function synthesizeExpressionFromGraph(nodes: ZlfnNode[], edges: ZlfnEdge[]): string {
  const counts: Record<string, number> = {}
  for (const e of edges) {
    if (e.type === 'implication' && e.to) {
      const key = String(e.to)
      counts[key] = (counts[key] || 0) + 1
    }
  }
  let target: string | null = null
  let max = -1
  for (const id of Object.keys(counts)) {
    if (counts[id] > max) { max = counts[id]; target = id }
  }
  if (!target && nodes.length) target = nodes[0].id
  if (!target) return 'P → Q'

  const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0
  const supportSources = edges.filter(e => e.type === 'implication' && e.to === target && isString((e as any).from)).map(e => (e as any).from as string)
  const attackSources = edges.filter(e => e.type === 'counterexample' && e.to === target && isString((e as any).from)).map(e => (e as any).from as string)

  const symbolFor = (id: string): string => {
    const n = nodes.find(x => x.id === id)
    if (!n) return id
    if ((n as any).symbol && (n as any).symbol !== n.id) return (n as any).symbol as string
    if (n.label) return String(n.label).replace(/\s+/g, '_')
    return id.toUpperCase()
  }

  const concl = symbolFor(target)
  const mkConj = (ids: string[]) => ids.length > 1 ? `(${ids.map(symbolFor).join(' ∧ ')})` : (ids[0] ? symbolFor(ids[0]) : '')

  const parts: string[] = []
  if (supportSources.length) {
    const p = mkConj(supportSources)
    parts.push(p ? `${p} → ${concl}` : concl)
  }
  if (attackSources.length) {
    const a = mkConj(attackSources)
    parts.push(a ? `${a} → ¬${concl}` : `¬${concl}`)
  }
  if (!parts.length) {
    const syms = nodes.slice(0, 3).map(n => symbolFor(n.id))
    if (syms.length >= 2) return `(${syms.slice(0, syms.length - 1).join(' ∧ ')}) → ${syms[syms.length - 1]}`
    return 'P → Q'
  }
  return parts.length === 1 ? parts[0] : `(${parts.join(' ∧ ')})`
}
