/**
 * Argument Strength Propagation Logic
 * Calculates dynamic argument strengths based on relationships and evidence
 */

import type { ArgumentEdge, ArgumentData } from './types'

export interface StrengthCalculationResult {
  nodeStrengths: Map<string, number>
  propagationPaths: PropagationPath[]
  conflicts: ArgumentConflict[]
  overallCoherence: number
}

export interface PropagationPath {
  id: string
  path: string[] // Node IDs in propagation order
  strengthFlow: number[] // Strength at each step
  scheme: string
  confidence: number
}

export interface ArgumentConflict {
  id: string
  type: 'direct_attack' | 'circular_reasoning' | 'inconsistent_strength'
  involvedNodes: string[]
  severity: number // 0-100
  description: string
}

/**
 * Calculate argument strengths with propagation
 */
export function calculateArgumentStrengths(argumentData: ArgumentData): StrengthCalculationResult {
  const nodes = [argumentData.core, ...argumentData.components]
  const edges = argumentData.relationships
  
  // Initialize with base strengths
  const nodeStrengths = new Map<string, number>()
  nodes.forEach(node => {
    nodeStrengths.set(node.id, node.strength || 50)
  })

  // Build adjacency lists for propagation
  const supportEdges = new Map<string, ArgumentEdge[]>()
  const attackEdges = new Map<string, ArgumentEdge[]>()
  
  edges.forEach(edge => {
    if (!edge.to || !edge.from) return
    
    if (edge.relationshipType === 'support') {
      if (!supportEdges.has(edge.to)) supportEdges.set(edge.to, [])
      supportEdges.get(edge.to)!.push(edge)
    } else if (edge.relationshipType === 'attack' || edge.relationshipType === 'undercut') {
      if (!attackEdges.has(edge.to)) attackEdges.set(edge.to, [])
      attackEdges.get(edge.to)!.push(edge)
    }
  })

  // Iterative strength propagation
  const maxIterations = 10
  const convergenceThreshold = 0.1
  let iteration = 0
  let hasConverged = false

  const propagationPaths: PropagationPath[] = []

  while (iteration < maxIterations && !hasConverged) {
    // const previousStrengths = new Map(nodeStrengths) // Unused for now
    let maxChange = 0

    nodes.forEach(node => {
      const currentStrength = nodeStrengths.get(node.id) || 50
      let newStrength = node.strength || 50 // Base strength

      // Calculate support contribution
      const supporters = supportEdges.get(node.id) || []
      if (supporters.length > 0) {
        const supportContribution = supporters.reduce((sum, edge) => {
          const supporterStrength = nodeStrengths.get(edge.from!) || 50
          const edgeWeight = (edge.confidence || 70) / 100
          return sum + (supporterStrength * edgeWeight)
        }, 0) / supporters.length

        // Weighted combination of base strength and support
        newStrength = (newStrength * 0.4) + (supportContribution * 0.6)
      }

      // Calculate attack impact
      const attackers = attackEdges.get(node.id) || []
      if (attackers.length > 0) {
        const attackImpact = attackers.reduce((sum, edge) => {
          const attackerStrength = nodeStrengths.get(edge.from!) || 50
          const edgeWeight = (edge.confidence || 70) / 100
          const impactType = edge.relationshipType === 'undercut' ? 0.8 : 0.6 // Undercuts are more damaging
          return sum + (attackerStrength * edgeWeight * impactType)
        }, 0) / attackers.length

        // Reduce strength based on attacks
        newStrength = Math.max(0, newStrength - (attackImpact * 0.4))
      }

      // Ensure strength stays within bounds
      newStrength = Math.max(0, Math.min(100, newStrength))
      
      const change = Math.abs(newStrength - currentStrength)
      maxChange = Math.max(maxChange, change)
      
      nodeStrengths.set(node.id, newStrength)

      // Record propagation paths for significant changes
      if (change > 5 && (supporters.length > 0 || attackers.length > 0)) {
        const path = [node.id]
        const strengthFlow = [newStrength]
        
        // Add strongest supporter or attacker to path
        const allInfluencers = [...supporters, ...attackers]
        if (allInfluencers.length > 0) {
          const strongest = allInfluencers.reduce((max, edge) => {
            const strength = nodeStrengths.get(edge.from!) || 50
            const maxStrength = nodeStrengths.get(max.from!) || 50
            return strength > maxStrength ? edge : max
          })
          
          path.unshift(strongest.from!)
          strengthFlow.unshift(nodeStrengths.get(strongest.from!) || 50)
          
          propagationPaths.push({
            id: `prop-${iteration}-${node.id}`,
            path,
            strengthFlow,
            scheme: strongest.scheme || 'Unknown',
            confidence: strongest.confidence || 70
          })
        }
      }
    })

    hasConverged = maxChange < convergenceThreshold
    iteration++
  }

  // Detect conflicts
  const conflicts = detectArgumentConflicts(argumentData, nodeStrengths)

  // Calculate overall coherence
  const overallCoherence = calculateOverallCoherence(argumentData, nodeStrengths, conflicts)

  return {
    nodeStrengths,
    propagationPaths,
    conflicts,
    overallCoherence
  }
}

/**
 * Detect conflicts in the argument structure
 */
function detectArgumentConflicts(
  argumentData: ArgumentData,
  nodeStrengths: Map<string, number>
): ArgumentConflict[] {
  const conflicts: ArgumentConflict[] = []
  const nodes = [argumentData.core, ...argumentData.components]
  const edges = argumentData.relationships

  // 1. Direct attack conflicts (strong nodes attacking each other)
  edges.forEach(edge => {
    if (edge.relationshipType === 'attack' && edge.from && edge.to) {
      const attackerStrength = nodeStrengths.get(edge.from) || 50
      const targetStrength = nodeStrengths.get(edge.to) || 50
      
      // Check if both nodes are strong (potential conflict)
      if (attackerStrength > 70 && targetStrength > 70) {
        conflicts.push({
          id: `conflict-attack-${edge.from}-${edge.to}`,
          type: 'direct_attack',
          involvedNodes: [edge.from, edge.to],
          severity: Math.min(attackerStrength, targetStrength),
          description: `Strong argument ${edge.from} attacks equally strong argument ${edge.to}`
        })
      }
    }
  })

  // 2. Circular reasoning detection
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  
  function detectCycles(nodeId: string, path: string[]): void {
    if (recursionStack.has(nodeId)) {
      // Found a cycle
      const cycleStart = path.indexOf(nodeId)
      const cycle = path.slice(cycleStart)
      
      conflicts.push({
        id: `conflict-circular-${cycle.join('-')}`,
        type: 'circular_reasoning',
        involvedNodes: cycle,
        severity: 60,
        description: `Circular reasoning detected: ${cycle.join(' → ')}`
      })
      return
    }
    
    if (visited.has(nodeId)) return
    
    visited.add(nodeId)
    recursionStack.add(nodeId)
    
    // Follow support edges
    edges.forEach(edge => {
      if (edge.from === nodeId && edge.relationshipType === 'support' && edge.to) {
        detectCycles(edge.to, [...path, nodeId])
      }
    })
    
    recursionStack.delete(nodeId)
  }
  
  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      detectCycles(node.id, [])
    }
  })

  // 3. Inconsistent strength conflicts
  edges.forEach(edge => {
    if (edge.relationshipType === 'support' && edge.from && edge.to) {
      const supporterStrength = nodeStrengths.get(edge.from) || 50
      const supportedStrength = nodeStrengths.get(edge.to) || 50
      
      // Supporter should generally be stronger than or equal to supported
      if (supporterStrength < supportedStrength - 20) {
        conflicts.push({
          id: `conflict-strength-${edge.from}-${edge.to}`,
          type: 'inconsistent_strength',
          involvedNodes: [edge.from, edge.to],
          severity: supportedStrength - supporterStrength,
          description: `Weak supporter (${Math.round(supporterStrength)}%) supports stronger argument (${Math.round(supportedStrength)}%)`
        })
      }
    }
  })

  return conflicts.sort((a, b) => b.severity - a.severity)
}

/**
 * Calculate overall argument coherence
 */
function calculateOverallCoherence(
  argumentData: ArgumentData,
  nodeStrengths: Map<string, number>,
  conflicts: ArgumentConflict[]
): number {
  // const nodes = [argumentData.core, ...argumentData.components] // Unused in this function
  const edges = argumentData.relationships

  // Base coherence from average node strength
  const avgStrength = Array.from(nodeStrengths.values()).reduce((sum, s) => sum + s, 0) / nodeStrengths.size

  // Penalty for conflicts
  const conflictPenalty = conflicts.reduce((sum, conflict) => {
    const weight = conflict.type === 'circular_reasoning' ? 2 : 1
    return sum + (conflict.severity * weight)
  }, 0) / Math.max(conflicts.length, 1)

  // Bonus for consistent relationships
  let consistencyBonus = 0
  let relationshipCount = 0

  edges.forEach(edge => {
    if (edge.from && edge.to) {
      const fromStrength = nodeStrengths.get(edge.from) || 50
      const toStrength = nodeStrengths.get(edge.to) || 50
      
      if (edge.relationshipType === 'support') {
        // Support relationships should flow from stronger to weaker or equal
        if (fromStrength >= toStrength - 10) {
          consistencyBonus += 10
        }
      } else if (edge.relationshipType === 'attack') {
        // Attack relationships should weaken the target
        // const expectedWeakening = (fromStrength * (edge.confidence || 70)) / 100 * 0.3 // Unused for now
        const actualStrength = toStrength
        const baseStrength = argumentData.components.find(n => n.id === edge.to)?.strength || 50
        
        if (actualStrength < baseStrength) {
          consistencyBonus += 5
        }
      }
      
      relationshipCount++
    }
  })

  consistencyBonus = relationshipCount > 0 ? consistencyBonus / relationshipCount : 0

  // Calculate final coherence score
  let coherence = avgStrength + consistencyBonus - (conflictPenalty * 0.5)
  coherence = Math.max(0, Math.min(100, coherence))

  return Math.round(coherence)
}

/**
 * Get strength-based node styling
 */
export function getStrengthBasedStyling(strength: number): {
  fillOpacity: number
  strokeWidth: number
  glowIntensity: number
} {
  const normalizedStrength = strength / 100

  return {
    fillOpacity: 0.6 + (normalizedStrength * 0.4), // 0.6 to 1.0
    strokeWidth: 2 + (normalizedStrength * 2), // 2 to 4
    glowIntensity: normalizedStrength * 0.3 // 0 to 0.3
  }
}

/**
 * Generate strength propagation animation data
 */
export function generatePropagationAnimation(
  path: PropagationPath,
  nodePositions: Map<string, { x: number; y: number }>
): {
  keyframes: Array<{ x: number; y: number; strength: number; timestamp: number }>
  duration: number
} {
  const keyframes: Array<{ x: number; y: number; strength: number; timestamp: number }> = []
  const duration = 2000 // 2 seconds
  const stepDuration = duration / (path.path.length - 1)

  path.path.forEach((nodeId, index) => {
    const position = nodePositions.get(nodeId)
    if (position) {
      keyframes.push({
        x: position.x,
        y: position.y,
        strength: path.strengthFlow[index] || 50,
        timestamp: index * stepDuration
      })
    }
  })

  return { keyframes, duration }
}
