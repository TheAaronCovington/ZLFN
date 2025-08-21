/**
 * D3 Simulation Logic for ZlfnGraph
 * Handles force simulation, layout algorithms, and node positioning
 */

import * as d3 from 'd3'
import type { ZlfnNode, ZlfnEdge } from './types'

export interface SimulationConfig {
  width: number
  height: number
  hierarchyMode: boolean
  showClusters: boolean
  frozen: boolean
}

export interface SimulationCallbacks {
  onTick?: () => void
  onEnd?: () => void
}

/**
 * Creates and configures the D3 force simulation
 */
export function createSimulation(
  nodes: ZlfnNode[],
  edges: ZlfnEdge[],
  config: SimulationConfig,
  callbacks?: SimulationCallbacks
): d3.Simulation<any, any> {
  const { width, height, hierarchyMode, showClusters, frozen } = config
  
  // Create simulation
  const simulation = d3.forceSimulation(nodes as any[])
    .alphaDecay(0.02)
    .velocityDecay(0.3)
    .on('tick', () => {
      callbacks?.onTick?.()
    })
    .on('end', () => {
      callbacks?.onEnd?.()
    })

  // Configure forces based on mode
  if (hierarchyMode) {
    configureHierarchicalForces(simulation, nodes, edges, width, height)
  } else {
    configureForceDirectedLayout(simulation, nodes, edges, width, height, showClusters)
  }

  // Freeze simulation if requested
  if (frozen) {
    simulation.alpha(0).restart()
  }

  return simulation
}

/**
 * Configures forces for hierarchical layout mode
 */
function configureHierarchicalForces(
  simulation: d3.Simulation<any, any>,
  nodes: ZlfnNode[],
  edges: ZlfnEdge[],
  width: number,
  height: number
) {
  // Remove existing forces
  simulation
    .force('link', null)
    .force('charge', null)
    .force('center', null)
    .force('collision', null)

  // Set up hierarchical positioning
  const levelMap = calculateNodeLevels(nodes, edges)
  const maxLevel = Math.max(...Object.values(levelMap))
  
  // Position nodes by level
  nodes.forEach((node: any) => {
    const level = levelMap[node.id] || 0
    const levelNodes = nodes.filter(n => levelMap[n.id] === level)
    const nodeIndex = levelNodes.findIndex(n => n.id === node.id)
    
    // Distribute nodes horizontally within their level
    const levelWidth = width * 0.8
    const startX = (width - levelWidth) / 2
    const spacing = levelNodes.length > 1 ? levelWidth / (levelNodes.length - 1) : 0
    
    node.fx = startX + (nodeIndex * spacing)
    node.fy = (height / (maxLevel + 1)) * (level + 1)
  })

  // Add gentle forces to prevent overlap
  simulation
    .force('collision', d3.forceCollide().radius(30).strength(0.5))
    .force('y', d3.forceY().y((d: any) => d.fy).strength(0.1))
}

/**
 * Configures forces for standard force-directed layout
 */
function configureForceDirectedLayout(
  simulation: d3.Simulation<any, any>,
  nodes: ZlfnNode[],
  edges: ZlfnEdge[],
  width: number,
  height: number,
  showClusters: boolean
) {
  // Link force
  const linkForce = d3.forceLink(edges as any[])
    .id((d: any) => d.id)
    .distance((d: any) => {
      const weight = d.weight || 50
      return Math.max(30, 150 - weight)
    })
    .strength(0.3)

  // Charge force (repulsion)
  const chargeForce = d3.forceManyBody()
    .strength((d: any) => {
      const baseStrength = -300
      const typeMultiplier = getNodeTypeMultiplier(d.type)
      return baseStrength * typeMultiplier
    })

  // Center force
  const centerForce = d3.forceCenter(width / 2, height / 2)

  // Collision force
  const collisionForce = d3.forceCollide()
    .radius((d: any) => getNodeRadius(d) + 5)
    .strength(0.7)

  // Apply forces
  simulation
    .force('link', linkForce)
    .force('charge', chargeForce)
    .force('center', centerForce)
    .force('collision', collisionForce)

  // Add clustering forces if enabled
  if (showClusters) {
    addClusteringForces(simulation, nodes, width, height)
  }

  // Add zone-based positioning
  addZoneForces(simulation, nodes, width, height)
}

/**
 * Calculates node levels for hierarchical layout
 */
function calculateNodeLevels(nodes: ZlfnNode[], edges: ZlfnEdge[]): Record<string, number> {
  const levelMap: Record<string, number> = {}
  const visited = new Set<string>()
  
  // Find root nodes (nodes with no incoming edges)
  const incomingCount: Record<string, number> = {}
  nodes.forEach(node => {
    incomingCount[node.id] = 0
  })
  
  edges.forEach(edge => {
    const target = edge.to || edge.target
    if (typeof target === 'string' && incomingCount[target] !== undefined) {
      incomingCount[target]++
    }
  })
  
  const rootNodes = nodes.filter(node => incomingCount[node.id] === 0)
  
  // BFS to assign levels
  const queue: Array<{ nodeId: string; level: number }> = []
  rootNodes.forEach(node => {
    queue.push({ nodeId: node.id, level: 0 })
    levelMap[node.id] = 0
  })
  
  while (queue.length > 0) {
    const { nodeId, level } = queue.shift()!
    
    if (visited.has(nodeId)) continue
    visited.add(nodeId)
    
    // Find children
    edges.forEach(edge => {
      const source = edge.from || edge.source
      const target = edge.to || edge.target
      
      if (source === nodeId && typeof target === 'string' && !visited.has(target)) {
        const newLevel = level + 1
        if (levelMap[target] === undefined || levelMap[target] > newLevel) {
          levelMap[target] = newLevel
          queue.push({ nodeId: target, level: newLevel })
        }
      }
    })
  }
  
  return levelMap
}

/**
 * Gets node type multiplier for charge force
 */
function getNodeTypeMultiplier(type?: string): number {
  switch (type) {
    case 'core': return 1.5
    case 'premise': return 1.2
    case 'conclusion': return 1.2
    case 'term': return 1.0
    case 'fallacy': return 0.8
    default: return 1.0
  }
}

/**
 * Gets node radius for collision detection
 */
function getNodeRadius(node: any): number {
  if (node.size) {
    if ('radius' in node.size) {
      return node.size.radius
    }
    return Math.max(node.size.width, node.size.height) / 2
  }
  return 20 // default radius
}

/**
 * Adds clustering forces to group related nodes
 */
function addClusteringForces(
  simulation: d3.Simulation<any, any>,
  nodes: ZlfnNode[],
  width: number,
  height: number
) {
  // Group nodes by type
  const clusters: Record<string, { x: number; y: number }> = {
    premise: { x: width * 0.2, y: height * 0.3 },
    term: { x: width * 0.5, y: height * 0.5 },
    conclusion: { x: width * 0.8, y: height * 0.3 },
    fallacy: { x: width * 0.8, y: height * 0.7 },
    core: { x: width * 0.5, y: height * 0.2 }
  }

  // Add clustering force
  simulation.force('cluster', (alpha: number) => {
    nodes.forEach((node: any) => {
      const cluster = clusters[node.type || 'term']
      if (cluster) {
        const dx = cluster.x - node.x
        const dy = cluster.y - node.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (distance > 0) {
          const strength = alpha * 0.1
          node.vx += dx * strength
          node.vy += dy * strength
        }
      }
    })
  })
}

/**
 * Adds zone-based positioning forces
 */
function addZoneForces(
  simulation: d3.Simulation<any, any>,
  nodes: ZlfnNode[],
  width: number,
  height: number
) {
  // Default zone positions
  const zonePositions: Record<string, { x: number; y: number }> = {
    arguments: { x: width * 0.1, y: height * 0.2 },
    premises: { x: width * 0.3, y: height * 0.4 },
    terms: { x: width * 0.5, y: height * 0.5 },
    conclusions: { x: width * 0.7, y: height * 0.4 },
    fallacies: { x: width * 0.9, y: height * 0.3 },
    informal: { x: width * 0.3, y: height * 0.7 },
    temporal: { x: width * 0.7, y: height * 0.7 }
  }

  simulation.force('zone', (alpha: number) => {
    nodes.forEach((node: any) => {
      const zoneId = node.zoneId || node.type
      const zonePos = zonePositions[zoneId]
      
      if (zonePos) {
        const dx = zonePos.x - node.x
        const dy = zonePos.y - node.y
        const strength = alpha * 0.05
        
        node.vx += dx * strength
        node.vy += dy * strength
      }
    })
  })
}

/**
 * Updates simulation configuration
 */
export function updateSimulation(
  simulation: d3.Simulation<any, any>,
  nodes: ZlfnNode[],
  edges: ZlfnEdge[],
  config: SimulationConfig
) {
  // Update nodes and links
  simulation.nodes(nodes as any[])
  
  const linkForce = simulation.force('link') as d3.ForceLink<any, any>
  if (linkForce) {
    linkForce.links(edges as any[])
  }

  // Reconfigure forces if mode changed
  if (config.hierarchyMode) {
    configureHierarchicalForces(simulation, nodes, edges, config.width, config.height)
  } else {
    configureForceDirectedLayout(simulation, nodes, edges, config.width, config.height, config.showClusters)
  }

  // Handle frozen state
  if (config.frozen) {
    simulation.alpha(0)
  } else {
    simulation.alpha(0.3).restart()
  }
}

/**
 * Stops and cleans up simulation
 */
export function destroySimulation(simulation: d3.Simulation<any, any> | null) {
  if (simulation) {
    simulation.stop()
  }
}
