// Bayesian Reasoning Service for ZLFN
// Implements probabilistic logic and Bayesian inference for argument evaluation

export interface BayesianNode {
  id: string
  label: string
  type: 'premise' | 'conclusion' | 'intermediate'
  priorProbability: number
  posteriorProbability?: number
  evidence?: number
  confidence?: number
}

export interface BayesianEdge {
  id: string
  from: string
  to: string
  type: 'support' | 'attack' | 'conditional'
  strength: number
  conditionalProbability?: number
}

export interface BayesianNetwork {
  nodes: BayesianNode[]
  edges: BayesianEdge[]
  evidenceNodes: Set<string>
}

export interface BayesianInferenceResult {
  nodeId: string
  probability: number
  confidence: number
  evidencePath: string[]
  reasoning: string
}

export class BayesianReasoner {
  private network: BayesianNetwork
  private convergenceThreshold = 0.001
  private maxIterations = 100

  constructor(network: BayesianNetwork) {
    this.network = network
  }

  /**
   * Perform Bayesian inference on the network
   */
  performInference(): BayesianInferenceResult[] {
    // Initialize posterior probabilities with priors
    this.initializePosteriors()
    
    // Iterative belief propagation
    this.beliefPropagation()
    
    // Generate results for all nodes
    return this.network.nodes.map(node => ({
      nodeId: node.id,
      probability: node.posteriorProbability || node.priorProbability,
      confidence: node.confidence || 0.5,
      evidencePath: this.getEvidencePath(node.id),
      reasoning: this.generateReasoning(node.id)
    }))
  }

  /**
   * Initialize posterior probabilities
   */
  private initializePosteriors() {
    this.network.nodes.forEach(node => {
      if (node.evidence !== undefined) {
        // Evidence nodes have fixed probabilities
        node.posteriorProbability = node.evidence
        node.confidence = 1.0
      } else {
        // Start with prior probabilities
        node.posteriorProbability = node.priorProbability
        node.confidence = 0.5
      }
    })
  }

  /**
   * Belief propagation algorithm
   */
  private beliefPropagation() {
    let iteration = 0
    let converged = false

    while (!converged && iteration < this.maxIterations) {
      const oldProbabilities = new Map<string, number>()
      
      // Store old probabilities
      this.network.nodes.forEach(node => {
        oldProbabilities.set(node.id, node.posteriorProbability || node.priorProbability)
      })

      // Update each node's probability based on its parents
      this.network.nodes.forEach(node => {
        if (node.evidence === undefined) { // Don't update evidence nodes
          this.updateNodeProbability(node)
        }
      })

      // Check for convergence
      converged = this.checkConvergence(oldProbabilities)
      iteration++
    }
  }

  /**
   * Update a node's probability based on its parents
   */
  private updateNodeProbability(node: BayesianNode) {
    const parentEdges = this.network.edges.filter(edge => edge.to === node.id)
    
    if (parentEdges.length === 0) {
      // No parents, keep prior probability
      return
    }

    let supportProbability = 0
    let attackProbability = 0
    let totalWeight = 0

    parentEdges.forEach(edge => {
      const parentNode = this.network.nodes.find(n => n.id === edge.from)
      if (!parentNode) return

      const parentProb = parentNode.posteriorProbability || parentNode.priorProbability
      const edgeStrength = edge.strength

      if (edge.type === 'support') {
        supportProbability += parentProb * edgeStrength
      } else if (edge.type === 'attack') {
        attackProbability += parentProb * edgeStrength
      } else if (edge.type === 'conditional' && edge.conditionalProbability) {
        // P(child|parent) * P(parent)
        supportProbability += edge.conditionalProbability * parentProb * edgeStrength
      }

      totalWeight += edgeStrength
    })

    if (totalWeight > 0) {
      // Normalize by total weight
      supportProbability /= totalWeight
      attackProbability /= totalWeight

      // Combine support and attack
      const netSupport = supportProbability - attackProbability
      
      // Update probability using weighted combination with prior
      const priorWeight = 0.3 // Weight given to prior belief
      const evidenceWeight = 0.7 // Weight given to evidence
      
      node.posteriorProbability = 
        priorWeight * node.priorProbability + 
        evidenceWeight * Math.max(0, Math.min(1, node.priorProbability + netSupport))

      // Update confidence based on evidence strength
      node.confidence = Math.min(1, 0.5 + totalWeight * 0.3)
    }
  }

  /**
   * Check if the algorithm has converged
   */
  private checkConvergence(oldProbabilities: Map<string, number>): boolean {
    for (const node of this.network.nodes) {
      const oldProb = oldProbabilities.get(node.id) || 0
      const newProb = node.posteriorProbability || node.priorProbability
      
      if (Math.abs(newProb - oldProb) > this.convergenceThreshold) {
        return false
      }
    }
    return true
  }

  /**
   * Get the evidence path for a node
   */
  private getEvidencePath(nodeId: string): string[] {
    const path: string[] = []
    const visited = new Set<string>()
    
    const findEvidencePath = (currentId: string) => {
      if (visited.has(currentId)) return
      visited.add(currentId)
      
      const node = this.network.nodes.find(n => n.id === currentId)
      if (!node) return
      
      if (node.evidence !== undefined) {
        path.push(currentId)
        return
      }
      
      const parentEdges = this.network.edges.filter(edge => edge.to === currentId)
      parentEdges.forEach(edge => {
        findEvidencePath(edge.from)
      })
    }
    
    findEvidencePath(nodeId)
    return path
  }

  /**
   * Generate natural language reasoning for a node
   */
  private generateReasoning(nodeId: string): string {
    const node = this.network.nodes.find(n => n.id === nodeId)
    if (!node) return 'No reasoning available'

    const probability = node.posteriorProbability || node.priorProbability
    const confidence = node.confidence || 0.5
    
    let reasoning = `${node.label} has a ${(probability * 100).toFixed(1)}% probability`
    
    if (node.evidence !== undefined) {
      reasoning += ` (direct evidence)`
    } else {
      const parentEdges = this.network.edges.filter(edge => edge.to === nodeId)
      if (parentEdges.length > 0) {
        const supportCount = parentEdges.filter(e => e.type === 'support').length
        const attackCount = parentEdges.filter(e => e.type === 'attack').length
        
        if (supportCount > attackCount) {
          reasoning += ` based on ${supportCount} supporting argument${supportCount > 1 ? 's' : ''}`
        } else if (attackCount > supportCount) {
          reasoning += ` despite ${attackCount} attacking argument${attackCount > 1 ? 's' : ''}`
        } else {
          reasoning += ` with mixed evidence (${supportCount} support, ${attackCount} attack)`
        }
      }
    }
    
    reasoning += ` with ${(confidence * 100).toFixed(1)}% confidence`
    
    return reasoning
  }

  /**
   * Set evidence for a node
   */
  setEvidence(nodeId: string, probability: number) {
    const node = this.network.nodes.find(n => n.id === nodeId)
    if (node) {
      node.evidence = Math.max(0, Math.min(1, probability))
      node.posteriorProbability = node.evidence
      node.confidence = 1.0
      this.network.evidenceNodes.add(nodeId)
    }
  }

  /**
   * Remove evidence from a node
   */
  removeEvidence(nodeId: string) {
    const node = this.network.nodes.find(n => n.id === nodeId)
    if (node) {
      node.evidence = undefined
      node.posteriorProbability = node.priorProbability
      node.confidence = 0.5
      this.network.evidenceNodes.delete(nodeId)
    }
  }

  /**
   * Update edge strength
   */
  updateEdgeStrength(edgeId: string, strength: number) {
    const edge = this.network.edges.find(e => e.id === edgeId)
    if (edge) {
      edge.strength = Math.max(0, Math.min(1, strength))
    }
  }

  /**
   * Get most likely explanation (MAP)
   */
  getMostLikelyExplanation(): { nodes: string[], probability: number } {
    const explanation: string[] = []
    let totalProbability = 1

    // Find the most probable state for each node
    this.network.nodes.forEach(node => {
      const prob = node.posteriorProbability || node.priorProbability
      if (prob > 0.5) {
        explanation.push(node.id)
        totalProbability *= prob
      } else {
        totalProbability *= (1 - prob)
      }
    })

    return {
      nodes: explanation,
      probability: totalProbability
    }
  }

  /**
   * Perform sensitivity analysis
   */
  performSensitivityAnalysis(nodeId: string): { 
    node: string, 
    originalProbability: number,
    sensitivityScores: Array<{ evidence: string, impact: number }>
  } {
    const targetNode = this.network.nodes.find(n => n.id === nodeId)
    if (!targetNode) {
      throw new Error(`Node ${nodeId} not found`)
    }

    const originalProbability = targetNode.posteriorProbability || targetNode.priorProbability
    const sensitivityScores: Array<{ evidence: string, impact: number }> = []

    // Test impact of each potential evidence node
    this.network.nodes.forEach(evidenceNode => {
      if (evidenceNode.id === nodeId) return // Skip target node

      // Save original state
      const originalEvidence = evidenceNode.evidence
      const originalPosterior = evidenceNode.posteriorProbability

      // Set strong positive evidence
      this.setEvidence(evidenceNode.id, 0.9)
      this.performInference()
      const highImpact = (targetNode.posteriorProbability || 0) - originalProbability

      // Set strong negative evidence  
      this.setEvidence(evidenceNode.id, 0.1)
      this.performInference()
      const lowImpact = originalProbability - (targetNode.posteriorProbability || 0)

      // Restore original state
      if (originalEvidence !== undefined) {
        this.setEvidence(evidenceNode.id, originalEvidence)
      } else {
        this.removeEvidence(evidenceNode.id)
        evidenceNode.posteriorProbability = originalPosterior
      }

      // Calculate sensitivity score
      const maxImpact = Math.max(Math.abs(highImpact), Math.abs(lowImpact))
      sensitivityScores.push({
        evidence: evidenceNode.id,
        impact: maxImpact
      })
    })

    // Restore original inference state
    this.performInference()

    return {
      node: nodeId,
      originalProbability,
      sensitivityScores: sensitivityScores.sort((a, b) => b.impact - a.impact)
    }
  }
}

/**
 * Convert ZLFN graph to Bayesian network
 */
export function convertToZlfnToBayesian(
  nodes: any[], 
  edges: any[]
): BayesianNetwork {
  const bayesianNodes: BayesianNode[] = nodes.map(node => ({
    id: node.id,
    label: node.label || node.name || node.id,
    type: node.type === 'premise' ? 'premise' : 
          node.type === 'conclusion' ? 'conclusion' : 'intermediate',
    priorProbability: node.probability || 0.5,
    confidence: node.confidence || 0.5
  }))

  const bayesianEdges: BayesianEdge[] = edges.map(edge => ({
    id: edge.id || `${edge.from}-${edge.to}`,
    from: edge.from,
    to: edge.to,
    type: edge.type === 'attack' ? 'attack' : 'support',
    strength: edge.strength || 0.7,
    conditionalProbability: edge.conditionalProbability
  }))

  return {
    nodes: bayesianNodes,
    edges: bayesianEdges,
    evidenceNodes: new Set()
  }
}

/**
 * Create a Bayesian reasoner from ZLFN data
 */
export function createBayesianReasoner(nodes: any[], edges: any[]): BayesianReasoner {
  const network = convertToZlfnToBayesian(nodes, edges)
  return new BayesianReasoner(network)
}
