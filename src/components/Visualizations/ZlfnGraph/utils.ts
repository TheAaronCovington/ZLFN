/**
 * Utility Functions for ZlfnGraph
 * Helper functions and calculations used across ZlfnGraph modules
 */

import type { ZlfnNode, ZlfnEdge, LayoutHistoryEntry } from './types'

/**
 * Calculates the bounding box of all nodes
 */
export function calculateBounds(nodes: ZlfnNode[]): {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
} {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  nodes.forEach(node => {
    const x = node.x || 0
    const y = node.y || 0
    const nodeRadius = getNodeRadius(node)

    minX = Math.min(minX, x - nodeRadius)
    minY = Math.min(minY, y - nodeRadius)
    maxX = Math.max(maxX, x + nodeRadius)
    maxY = Math.max(maxY, y + nodeRadius)
  })

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  }
}

/**
 * Gets the radius of a node for collision detection
 */
export function getNodeRadius(node: ZlfnNode): number {
  if (node.size) {
    if ('radius' in node.size) {
      return node.size.radius
    }
    return Math.max(node.size.width, node.size.height) / 2
  }
  return 20 // default radius
}

/**
 * Calculates the distance between two nodes
 */
export function getNodeDistance(node1: ZlfnNode, node2: ZlfnNode): number {
  const x1 = node1.x || 0
  const y1 = node1.y || 0
  const x2 = node2.x || 0
  const y2 = node2.y || 0
  
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
}

/**
 * Finds the shortest path between two nodes
 */
export function findShortestPath(
  startId: string,
  endId: string,
  nodes: ZlfnNode[],
  edges: ZlfnEdge[]
): string[] | null {
  // Build adjacency list
  const adjacency: Record<string, string[]> = {}
  nodes.forEach(node => {
    adjacency[node.id] = []
  })

  edges.forEach(edge => {
    const source = edge.from || edge.source
    const target = edge.to || edge.target
    
    if (typeof source === 'string' && typeof target === 'string') {
      adjacency[source]?.push(target)
      // For undirected graph, add reverse edge
      adjacency[target]?.push(source)
    }
  })

  // BFS to find shortest path
  const queue: Array<{ nodeId: string; path: string[] }> = [{ nodeId: startId, path: [startId] }]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const { nodeId, path } = queue.shift()!

    if (nodeId === endId) {
      return path
    }

    if (visited.has(nodeId)) continue
    visited.add(nodeId)

    const neighbors = adjacency[nodeId] || []
    neighbors.forEach(neighborId => {
      if (!visited.has(neighborId)) {
        queue.push({ nodeId: neighborId, path: [...path, neighborId] })
      }
    })
  }

  return null // No path found
}

/**
 * Groups nodes by their type or zone
 */
export function groupNodesByType(nodes: ZlfnNode[]): Record<string, ZlfnNode[]> {
  const groups: Record<string, ZlfnNode[]> = {}
  
  nodes.forEach(node => {
    const key = node.type || 'unknown'
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(node)
  })
  
  return groups
}

/**
 * Filters edges based on criteria
 */
export function filterEdges(
  edges: ZlfnEdge[],
  criteria: {
    rule?: string
    type?: string
    minWeight?: number
    maxWeight?: number
  }
): ZlfnEdge[] {
  return edges.filter(edge => {
    if (criteria.rule && edge.rule !== criteria.rule) return false
    if (criteria.type && edge.type !== criteria.type) return false
    if (criteria.minWeight !== undefined && (edge.weight || 0) < criteria.minWeight) return false
    if (criteria.maxWeight !== undefined && (edge.weight || 0) > criteria.maxWeight) return false
    return true
  })
}

/**
 * Calculates the centroid of a set of nodes
 */
export function calculateCentroid(nodes: ZlfnNode[]): { x: number; y: number } {
  if (nodes.length === 0) return { x: 0, y: 0 }

  const sum = nodes.reduce(
    (acc, node) => ({
      x: acc.x + (node.x || 0),
      y: acc.y + (node.y || 0)
    }),
    { x: 0, y: 0 }
  )

  return {
    x: sum.x / nodes.length,
    y: sum.y / nodes.length
  }
}

/**
 * Saves current layout to history
 */
export function saveLayoutToHistory(
  nodes: ZlfnNode[],
  history: LayoutHistoryEntry[],
  maxHistorySize: number = 50
): LayoutHistoryEntry[] {
  const entry: LayoutHistoryEntry = {
    nodes: nodes.map(node => ({
      id: node.id,
      x: node.x || 0,
      y: node.y || 0,
      fx: node.fx,
      fy: node.fy
    })),
    timestamp: Date.now()
  }

  const newHistory = [entry, ...history.slice(0, maxHistorySize - 1)]
  return newHistory
}

/**
 * Restores layout from history entry
 */
export function restoreLayoutFromHistory(
  nodes: ZlfnNode[],
  historyEntry: LayoutHistoryEntry
): ZlfnNode[] {
  const positionMap = new Map(
    historyEntry.nodes.map(node => [node.id, node])
  )

  return nodes.map(node => {
    const savedPosition = positionMap.get(node.id)
    if (savedPosition) {
      return {
        ...node,
        x: savedPosition.x,
        y: savedPosition.y,
        fx: savedPosition.fx,
        fy: savedPosition.fy
      }
    }
    return node
  })
}

/**
 * Validates node and edge data
 */
export function validateGraphData(
  nodes: ZlfnNode[],
  edges: ZlfnEdge[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Check for duplicate node IDs
  const nodeIds = new Set<string>()
  nodes.forEach(node => {
    if (nodeIds.has(node.id)) {
      errors.push(`Duplicate node ID: ${node.id}`)
    }
    nodeIds.add(node.id)
  })

  // Check for invalid edge references
  edges.forEach((edge, index) => {
    const source = edge.from || edge.source
    const target = edge.to || edge.target
    
    if (typeof source === 'string' && !nodeIds.has(source)) {
      errors.push(`Edge ${index}: Invalid source node ID: ${source}`)
    }
    
    if (typeof target === 'string' && !nodeIds.has(target)) {
      errors.push(`Edge ${index}: Invalid target node ID: ${target}`)
    }
  })

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Generates a unique ID for new nodes/edges
 */
export function generateUniqueId(prefix: string = 'item'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Debounces a function call
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Throttles a function call
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * Clamps a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Linear interpolation between two values
 */
export function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor
}

/**
 * Converts screen coordinates to graph coordinates
 */
export function screenToGraph(
  screenX: number,
  screenY: number,
  transform: { x: number; y: number; k: number }
): { x: number; y: number } {
  return {
    x: (screenX - transform.x) / transform.k,
    y: (screenY - transform.y) / transform.k
  }
}

/**
 * Converts graph coordinates to screen coordinates
 */
export function graphToScreen(
  graphX: number,
  graphY: number,
  transform: { x: number; y: number; k: number }
): { x: number; y: number } {
  return {
    x: graphX * transform.k + transform.x,
    y: graphY * transform.k + transform.y
  }
}
