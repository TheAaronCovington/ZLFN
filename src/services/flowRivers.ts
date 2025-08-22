// Flow Rivers - Animated argument flow visualization for ZLFN graphs
// Shows the logical flow of arguments through the graph with animated paths

import * as d3 from 'd3'

export interface FlowRiverNode {
  id: string
  x: number
  y: number
  type: string
  strength?: number
}

export interface FlowRiverEdge {
  id: string
  from: string
  to: string
  type: string
  strength?: number
}

export interface FlowRiverConfig {
  enabled: boolean
  animationSpeed: number
  particleCount: number
  particleSize: number
  showStrength: boolean
  colorScheme: 'default' | 'strength' | 'type'
  opacity: number
}

export interface FlowParticle {
  id: string
  edgeId: string
  progress: number
  speed: number
  size: number
  color: string
}

export class FlowRiversRenderer {
  private container: d3.Selection<SVGGElement, unknown, null, undefined>
  private config: FlowRiverConfig
  private nodes: FlowRiverNode[] = []
  private edges: FlowRiverEdge[] = []
  private particles: FlowParticle[] = []
  private animationId: number | null = null
  private pathCache: Map<string, SVGPathElement> = new Map()

  constructor(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    config: Partial<FlowRiverConfig> = {}
  ) {
    this.config = {
      enabled: true,
      animationSpeed: 1,
      particleCount: 3,
      particleSize: 4,
      showStrength: true,
      colorScheme: 'default',
      opacity: 0.7,
      ...config
    }

    // Create container for flow rivers
    this.container = svg.select('.flow-rivers-container')
    if (this.container.empty()) {
      this.container = svg.append('g')
        .attr('class', 'flow-rivers-container')
        .style('pointer-events', 'none')
    }
  }

  /**
   * Update the graph data and restart flow animation
   */
  updateGraph(nodes: FlowRiverNode[], edges: FlowRiverEdge[]) {
    this.nodes = nodes
    this.edges = edges
    this.pathCache.clear()
    
    if (this.config.enabled) {
      this.createFlowPaths()
      this.initializeParticles()
      this.startAnimation()
    }
  }

  /**
   * Create SVG paths for each edge
   */
  private createFlowPaths() {
    // Remove existing paths
    this.container.selectAll('.flow-path').remove()

    // Create curved paths for each edge
    const pathSelection = this.container.selectAll('.flow-path')
      .data(this.edges)
      .enter()
      .append('path')
      .attr('class', 'flow-path')
      .attr('id', d => `flow-path-${d.id}`)
      .attr('d', d => this.createCurvedPath(d))
      .style('fill', 'none')
      .style('stroke', 'none') // Paths are invisible, used only for particle movement
      .style('pointer-events', 'none')

    // Cache path elements for efficient particle movement
    pathSelection.each((d, i, nodes) => {
      this.pathCache.set(d.id, nodes[i] as SVGPathElement)
    })
  }

  /**
   * Create a curved path between two nodes
   */
  private createCurvedPath(edge: FlowRiverEdge): string {
    const fromNode = this.nodes.find(n => n.id === edge.from)
    const toNode = this.nodes.find(n => n.id === edge.to)
    
    if (!fromNode || !toNode) return ''

    const dx = toNode.x - fromNode.x
    const dy = toNode.y - fromNode.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    // Create curved path with control points
    const curvature = 0.3
    const controlOffset = distance * curvature
    
    // Calculate control points for smooth curve
    const midX = (fromNode.x + toNode.x) / 2
    const midY = (fromNode.y + toNode.y) / 2
    
    // Perpendicular offset for curve
    const perpX = -dy / distance * controlOffset
    const perpY = dx / distance * controlOffset
    
    const controlX = midX + perpX
    const controlY = midY + perpY

    return `M ${fromNode.x} ${fromNode.y} Q ${controlX} ${controlY} ${toNode.x} ${toNode.y}`
  }

  /**
   * Initialize particles for animation
   */
  private initializeParticles() {
    this.particles = []
    
    this.edges.forEach(edge => {
      for (let i = 0; i < this.config.particleCount; i++) {
        const particle: FlowParticle = {
          id: `${edge.id}-particle-${i}`,
          edgeId: edge.id,
          progress: i / this.config.particleCount, // Stagger particles
          speed: this.getParticleSpeed(edge),
          size: this.getParticleSize(edge),
          color: this.getParticleColor(edge)
        }
        this.particles.push(particle)
      }
    })

    // Create particle elements
    this.container.selectAll('.flow-particle').remove()
    this.container.selectAll('.flow-particle')
      .data(this.particles)
      .enter()
      .append('circle')
      .attr('class', 'flow-particle')
      .attr('r', d => d.size)
      .style('fill', d => d.color)
      .style('opacity', this.config.opacity)
      .style('filter', 'drop-shadow(0 0 3px rgba(0, 229, 255, 0.5))')
  }

  /**
   * Get particle speed based on edge properties
   */
  private getParticleSpeed(edge: FlowRiverEdge): number {
    const baseSpeed = 0.01 * this.config.animationSpeed
    
    if (this.config.showStrength && edge.strength !== undefined) {
      return baseSpeed * (0.5 + edge.strength) // Stronger edges = faster particles
    }
    
    return baseSpeed
  }

  /**
   * Get particle size based on edge properties
   */
  private getParticleSize(edge: FlowRiverEdge): number {
    const baseSize = this.config.particleSize
    
    if (this.config.showStrength && edge.strength !== undefined) {
      return baseSize * (0.7 + edge.strength * 0.6) // Stronger edges = larger particles
    }
    
    return baseSize
  }

  /**
   * Get particle color based on configuration and edge properties
   */
  private getParticleColor(edge: FlowRiverEdge): string {
    switch (this.config.colorScheme) {
      case 'strength':
        if (edge.strength !== undefined) {
          const intensity = Math.max(0.3, edge.strength)
          return `rgba(0, 229, 255, ${intensity})`
        }
        return 'var(--ai-cyan)'
        
      case 'type':
        switch (edge.type) {
          case 'implication': return 'var(--ai-cyan)'
          case 'biconditional': return 'var(--ai-purple)'
          case 'support': return 'var(--ai-green)'
          case 'attack': return 'var(--ai-red)'
          default: return 'var(--ai-blue)'
        }
        
      default:
        return 'var(--ai-cyan)'
    }
  }

  /**
   * Start the flow animation
   */
  startAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
    }

    const animate = () => {
      this.updateParticles()
      this.renderParticles()
      
      if (this.config.enabled) {
        this.animationId = requestAnimationFrame(animate)
      }
    }

    animate()
  }

  /**
   * Update particle positions
   */
  private updateParticles() {
    this.particles.forEach(particle => {
      particle.progress += particle.speed
      
      // Reset particle when it reaches the end
      if (particle.progress >= 1) {
        particle.progress = 0
      }
    })
  }

  /**
   * Render particles at their current positions
   */
  private renderParticles() {
    this.container.selectAll('.flow-particle')
      .data(this.particles)
      .attr('cx', d => {
        const path = this.pathCache.get(d.edgeId)
        if (!path) return 0
        
        const point = path.getPointAtLength(d.progress * path.getTotalLength())
        return point.x
      })
      .attr('cy', d => {
        const path = this.pathCache.get(d.edgeId)
        if (!path) return 0
        
        const point = path.getPointAtLength(d.progress * path.getTotalLength())
        return point.y
      })
  }

  /**
   * Stop the flow animation
   */
  stopAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FlowRiverConfig>) {
    this.config = { ...this.config, ...newConfig }
    
    if (this.config.enabled && this.nodes.length > 0) {
      this.initializeParticles()
      this.startAnimation()
    } else {
      this.stopAnimation()
      this.hide()
    }
  }

  /**
   * Show flow rivers
   */
  show() {
    this.container.style('display', null)
    if (this.nodes.length > 0) {
      this.startAnimation()
    }
  }

  /**
   * Hide flow rivers
   */
  hide() {
    this.container.style('display', 'none')
    this.stopAnimation()
  }

  /**
   * Toggle flow rivers visibility
   */
  toggle() {
    if (this.config.enabled) {
      this.hide()
      this.config.enabled = false
    } else {
      this.config.enabled = true
      this.show()
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopAnimation()
    this.container.remove()
    this.pathCache.clear()
  }

  /**
   * Highlight specific argument paths
   */
  highlightPath(nodeIds: string[], color = 'var(--ai-gold)') {
    // Find edges that connect the specified nodes
    const pathEdges = this.edges.filter(edge => 
      nodeIds.includes(edge.from) && nodeIds.includes(edge.to)
    )

    // Temporarily change particle colors for highlighted path
    this.particles.forEach(particle => {
      if (pathEdges.some(edge => edge.id === particle.edgeId)) {
        particle.color = color
        particle.size = particle.size * 1.5 // Make highlighted particles larger
      }
    })

    // Update particle rendering
    this.container.selectAll('.flow-particle')
      .data(this.particles)
      .style('fill', d => d.color)
      .attr('r', d => d.size)
  }

  /**
   * Clear path highlighting
   */
  clearHighlight() {
    // Reset all particle colors and sizes
    this.particles.forEach(particle => {
      const edge = this.edges.find(e => e.id === particle.edgeId)
      if (edge) {
        particle.color = this.getParticleColor(edge)
        particle.size = this.getParticleSize(edge)
      }
    })

    // Update particle rendering
    this.container.selectAll('.flow-particle')
      .data(this.particles)
      .style('fill', d => d.color)
      .attr('r', d => d.size)
  }
}

/**
 * Create and configure a Flow Rivers renderer
 */
export function createFlowRivers(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  config?: Partial<FlowRiverConfig>
): FlowRiversRenderer {
  return new FlowRiversRenderer(svg, config)
}

/**
 * Convert ZLFN graph data to Flow Rivers format
 */
export function convertToFlowRiverData(
  nodes: any[],
  edges: any[]
): { nodes: FlowRiverNode[], edges: FlowRiverEdge[] } {
  const flowNodes: FlowRiverNode[] = nodes.map(node => ({
    id: node.id,
    x: node.x || 0,
    y: node.y || 0,
    type: node.type || 'term',
    strength: node.strength || Math.random() // Use actual strength if available
  }))

  const flowEdges: FlowRiverEdge[] = edges.map(edge => ({
    id: edge.id || `${edge.from}-${edge.to}`,
    from: edge.from,
    to: edge.to,
    type: edge.type || 'implication',
    strength: edge.strength || Math.random() // Use actual strength if available
  }))

  return { nodes: flowNodes, edges: flowEdges }
}
