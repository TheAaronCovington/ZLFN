/**
 * ATN Tree Renderer - D3 Tree Layout for Argument Structure
 * Tree layout patterns for argument visualization
 */

import * as d3 from 'd3'
import type { 
  ArgumentNode, 
  ArgumentEdge, 
  ArgumentData, 
  ArgumentRenderConfig
} from './types'
import { ARGUMENT_COLORS } from './types'
import { createFacetIcons, type FacetClick } from '../../../vis/facets/icons'

export interface TreeRenderState {
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>
  g: d3.Selection<SVGGElement, unknown, null, undefined>
  zoom: d3.ZoomBehavior<SVGSVGElement, unknown>
  width: number
  height: number
}

export interface TreeNodeDatum extends d3.HierarchyPointNode<ArgumentNode> {
  node: ArgumentNode
}

export interface TreeLinkDatum {
  source: TreeNodeDatum
  target: TreeNodeDatum
  edge: ArgumentEdge
}

/**
 * Initialize the SVG container and zoom behavior
 */
export function initializeTreeSVG(
  container: HTMLElement,
  config: ArgumentRenderConfig,
  onZoomChange?: (scale: number) => void
): TreeRenderState {
  // Clear existing content
  d3.select(container).selectAll('*').remove()

  const svg = d3.select(container)
    .append('svg')
    .attr('width', config.width)
    .attr('height', config.height)
    .style('background', 'var(--ai-bg-primary)')

  const g = svg.append('g')

  // Safe tooltip: simple HTML tooltip div managed by D3
  try {
    d3.select(container)
      .append('div')
      .attr('class', 'atn-tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('background', 'rgba(20,20,28,0.95)')
      .style('border', '1px solid rgba(64,196,255,0.4)')
      .style('border-radius', '8px')
      .style('padding', '6px 8px')
      .style('color', 'var(--ai-text-primary)')
      .style('font-size', '12px')
      .style('display', 'none')
  } catch {}

  // Initialize zoom behavior with strength/conflict overlay updates
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      g.attr('transform', event.transform)
      
      // Update overlay visibility based on zoom level for better performance
      const scale = event.transform.k
      updateOverlayVisibility(g, scale)
      
      // Notify zoom scale change for scheme cluster updates
      onZoomChange?.(scale)
    })

  svg.call(zoom)

  // Add definitions for markers and patterns
  const defs = svg.append('defs')

  // Create glow filter for hover effects
  const glowFilter = defs.append('filter')
    .attr('id', 'atn-glow')
    .attr('x', '-50%')
    .attr('y', '-50%')
    .attr('width', '200%')
    .attr('height', '200%')
  
  glowFilter.append('feGaussianBlur')
    .attr('stdDeviation', '3')
    .attr('result', 'coloredBlur')
  
  const feMerge = glowFilter.append('feMerge')
  feMerge.append('feMergeNode').attr('in', 'coloredBlur')
  feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

  // Create gradient definitions for modern node styling
  const gradientConfigs = [
    { id: 'claim-gradient', colors: ['#4f46e5', '#7c3aed'] },
    { id: 'premise-gradient', colors: ['#059669', '#0d9488'] },
    { id: 'evidence-gradient', colors: ['#dc2626', '#ea580c'] },
    { id: 'warrant-gradient', colors: ['#7c2d12', '#a16207'] },
    { id: 'backing-gradient', colors: ['#1e40af', '#1e3a8a'] },
    { id: 'rebuttal-gradient', colors: ['#be123c', '#9f1239'] }
  ]

  gradientConfigs.forEach(({ id, colors }) => {
    const gradient = defs.append('linearGradient')
      .attr('id', id)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '100%')
    
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', colors[0])
    
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', colors[1])
  })

  // Arrow markers for different relationship types
  const markerConfigs = [
    { id: 'support-arrow', color: config.edgeStyle.support.stroke },
    { id: 'attack-arrow', color: config.edgeStyle.attack.stroke },
    { id: 'undercut-arrow', color: config.edgeStyle.undercut.stroke }
  ]

  markerConfigs.forEach(({ id, color }) => {
    defs.append('marker')
      .attr('id', id)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', color)
  })

  return {
    svg,
    g,
    zoom,
    width: config.width,
    height: config.height
  }
}

/**
 * Convert argument data to D3 hierarchy
 */
export function buildArgumentHierarchy(argumentData: ArgumentData): d3.HierarchyNode<ArgumentNode> {
  // Create a tree structure with the core claim as root
  const root = argumentData.core

  // Build children based on relationships
  const childrenMap = new Map<string, ArgumentNode[]>()
  
  // Initialize with empty arrays
  const allNodes = [root, ...argumentData.components]
  allNodes.forEach(node => {
    childrenMap.set(node.id, [])
  })

  // Build parent-child relationships from support edges
  argumentData.relationships.forEach(edge => {
    if (edge.relationshipType === 'support' && edge.to && edge.from) {
      const children = childrenMap.get(edge.to) || []
      const sourceNode = allNodes.find(n => n.id === edge.from)
      if (sourceNode) {
        children.push(sourceNode)
        childrenMap.set(edge.to, children)
      }
    }
  })

  // Create hierarchy with children function
  const hierarchy = d3.hierarchy(root, (node: ArgumentNode) => {
    const children = childrenMap.get(node.id) || []
    return children.length > 0 ? children : null
  })

  return hierarchy
}

/**
 * Render tree layout
 */
export function renderTreeLayout(
  state: TreeRenderState,
  argumentData: ArgumentData,
  config: ArgumentRenderConfig,
  onNodeClick?: (node: ArgumentNode) => void,
  onEdgeClick?: (edge: ArgumentEdge) => void,
  onFacetClick?: FacetClick
): void {
  const { g, width, height } = state

  // Build hierarchy
  const hierarchy = buildArgumentHierarchy(argumentData)

  // Create tree layout
  const treeLayout = d3.tree<ArgumentNode>()
    .size([width - 100, height - 100])
    .separation((a, b) => {
      // Increase separation for different argument types
      const aType = a.data.argumentType
      const bType = b.data.argumentType
      return aType === bType ? 1 : 1.5
    })

  const treeData = treeLayout(hierarchy) as TreeNodeDatum

  // Get all nodes and links
  const nodes = treeData.descendants() as TreeNodeDatum[]
  const links = treeData.links() as Array<{ source: TreeNodeDatum; target: TreeNodeDatum }>

  // Create links with edge data
  const edgeLinks: TreeLinkDatum[] = links.map(link => {
    const edge = argumentData.relationships.find(e => 
      e.from === link.source.data.id && e.to === link.target.data.id
    )
    return {
      source: link.source,
      target: link.target,
      edge: edge || {
        id: `${link.source.data.id}-${link.target.data.id}`,
        from: link.source.data.id,
        to: link.target.data.id,
        relationshipType: 'support',
        scheme: 'Default Support',
        confidence: 70,
        weight: 70,
        rule: 'Tree Structure',
        type: 'implication',
        style: 'solid'
      }
    }
  })

  // Render links first (so they appear behind nodes)
  renderTreeLinks(g, edgeLinks, config, onEdgeClick)

  // Render nodes
  renderTreeNodes(g, nodes, config, onNodeClick, onFacetClick)

  // Add attack and undercut relationships as curved links
  renderNonHierarchicalEdges(g, argumentData, nodes, config, onEdgeClick)

  // Center the tree
  const bounds = g.node()?.getBBox()
  if (bounds) {
    const centerX = width / 2 - bounds.width / 2 - bounds.x
    const centerY = height / 2 - bounds.height / 2 - bounds.y
    g.attr('transform', `translate(${centerX}, ${centerY})`)
  }
}

/**
 * Render tree links (support relationships in hierarchy)
 */
function renderTreeLinks(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  links: TreeLinkDatum[],
  _config: ArgumentRenderConfig,
  onEdgeClick?: (edge: ArgumentEdge) => void
): void {
  const linkSelection = g.selectAll<SVGPathElement, TreeLinkDatum>('.tree-link')
    .data(links, d => `${d.source.data.id}-${d.target.data.id}`)

  linkSelection.exit().remove()

  const linkEnter = linkSelection.enter()
    .append('path')
    .attr('class', 'tree-link')

  const linkMerge = linkEnter.merge(linkSelection)

  linkMerge
    .attr('d', d => {
      // Create smooth curved path
      const sourceX = d.source.x || 0
      const sourceY = d.source.y || 0
      const targetX = d.target.x || 0
      const targetY = d.target.y || 0

      return `M${sourceX},${sourceY}C${sourceX},${(sourceY + targetY) / 2} ${targetX},${(sourceY + targetY) / 2} ${targetX},${targetY}`
    })
    .attr('fill', 'none')
    .attr('stroke', _config.edgeStyle.support.stroke)
    .attr('stroke-width', _config.edgeStyle.support.strokeWidth)
    .attr('stroke-dasharray', _config.edgeStyle.support.strokeDasharray || 'none')
    .attr('marker-end', 'url(#support-arrow)')
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      event.stopPropagation()
      onEdgeClick?.(d.edge)
    })

  // Simple HTML tooltip handlers
  const container = (g.node() as SVGGElement).ownerSVGElement?.parentElement as HTMLElement | undefined
  const tip = container ? d3.select(container).select<HTMLDivElement>('.atn-tooltip') : null
  if (tip) {
    linkMerge
      .on('mousemove', (event, d) => {
        const { pageX, pageY } = event as MouseEvent
        tip
          .style('left', `${pageX + 12}px`)
          .style('top', `${pageY + 12}px`)
          .style('display', 'block')
          .html(`${d.edge.scheme || 'Support'}<br/>Confidence: ${d.edge.confidence ?? 0}%`)
      })
      .on('mouseleave', () => {
        tip.style('display', 'none')
      })
  } else {
    // Fallback native title
    linkMerge.append('title').text(d => `${d.edge.scheme} (${d.edge.confidence}% confidence)`)
  }
}

/**
 * Render tree nodes
 */
function renderTreeNodes(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  nodes: TreeNodeDatum[],
  _config: ArgumentRenderConfig,
  onNodeClick?: (node: ArgumentNode) => void,
  onFacetClick?: FacetClick
): void {
  const nodeSelection = g.selectAll<SVGGElement, TreeNodeDatum>('.tree-node')
    .data(nodes, d => d.data.id)

  nodeSelection.exit().remove()

  const nodeEnter = nodeSelection.enter()
    .append('g')
    .attr('class', 'tree-node')

  const nodeMerge = nodeEnter.merge(nodeSelection)

  nodeMerge
    .attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`)
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      event.stopPropagation()
      onNodeClick?.(d.data)
    })

  // Add node shapes based on argument type with modern styling
  nodeEnter.each(function(d) {
    const node = d3.select(this)
    const argumentType = d.data.argumentType
    const color = ARGUMENT_COLORS[argumentType]
    const gradientId = `${argumentType}-gradient`

    // Store original dimensions for hover effects
    let originalDimensions: any = {}

    switch (argumentType) {
      case 'claim':
        // Rectangle for claims (prominent)
        const claimRect = node.append('rect')
          .attr('class', 'node-shape')
          .attr('x', -60)
          .attr('y', -20)
          .attr('width', 120)
          .attr('height', 40)
          .attr('rx', 8)
        
        originalDimensions = { width: 120, height: 40, x: -60, y: -20 }
        claimRect.datum({ ...d, originalDimensions })
        break

      case 'ground':
      case 'backing':
        // Rounded rectangles for evidence
        const evidenceRect = node.append('rect')
          .attr('class', 'node-shape')
          .attr('x', -50)
          .attr('y', -15)
          .attr('width', 100)
          .attr('height', 30)
          .attr('rx', 15)
        
        originalDimensions = { width: 100, height: 30, x: -50, y: -15 }
        evidenceRect.datum({ ...d, originalDimensions })
        break

      case 'warrant':
        // Diamond for warrants
        const warrantPath = node.append('path')
          .attr('class', 'node-shape')
          .attr('d', 'M-40,0 L0,-20 L40,0 L0,20 Z')
        
        originalDimensions = { path: 'M-40,0 L0,-20 L40,0 L0,20 Z' }
        warrantPath.datum({ ...d, originalDimensions })
        break

      case 'rebuttal':
        // Hexagon for rebuttals
        const rebuttalPath = node.append('path')
          .attr('class', 'node-shape')
          .attr('d', 'M-30,-15 L30,-15 L40,0 L30,15 L-30,15 L-40,0 Z')
        
        originalDimensions = { path: 'M-30,-15 L30,-15 L40,0 L30,15 L-30,15 L-40,0 Z' }
        rebuttalPath.datum({ ...d, originalDimensions })
        break

      case 'qualifier':
        // Circle for qualifiers
        const qualifierCircle = node.append('circle')
          .attr('class', 'node-shape')
          .attr('r', 20)
        
        originalDimensions = { radius: 20 }
        qualifierCircle.datum({ ...d, originalDimensions })
        break
    }

    // Style the shape with gradients and modern effects
    node.select('.node-shape')
      .attr('fill', `url(#${gradientId})`)
      .attr('stroke', d3.color(color)?.darker(1).toString() || color)
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(2px 2px 6px rgba(0,0,0,0.4))')
      .style('transition', 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)')
      .style('cursor', 'pointer')

    // Add text label with enhanced styling
    node.append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('fill', 'white')
      .style('font-size', '12px')
      .style('font-weight', '600')
      .style('pointer-events', 'none')
      .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.7)')
      .style('transition', 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)')
      .text(function(d: any) {
        const label = d.data.label || d.data.name || 'Untitled'
        return label.length > 15 ? label.substring(0, 15) + '...' : label
      })

    // Add strength indicator with enhanced styling
    if (d.data.strength !== undefined) {
      node.append('text')
        .attr('class', 'strength-indicator')
        .attr('text-anchor', 'middle')
        .attr('dy', '25')
        .style('fill', 'var(--ai-text-secondary)')
        .style('font-size', '10px')
        .style('font-weight', '500')
        .style('pointer-events', 'none')
        .style('text-shadow', '1px 1px 1px rgba(0,0,0,0.5)')
        .style('transition', 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)')
        .text(`${d.data.strength}%`)
    }

    // Add facet icons if callback is provided
    if (onFacetClick) {
      createFacetIcons(node, onFacetClick)
    }
  })

  // Add hover interactions with expansion and glow effects
  nodeMerge
    .on('mouseenter', function(_event, d: any) {
      const node = d3.select(this)
      const shape = node.select('.node-shape')
      const label = node.select('.node-label')
      const strengthIndicator = node.select('.strength-indicator')
      
      // Apply glow effect
      shape.style('filter', 'url(#atn-glow) drop-shadow(2px 2px 6px rgba(0,0,0,0.4))')
      
      // Expand based on shape type
      const shapeElement = shape.node() as SVGElement
      if (shapeElement?.tagName === 'rect') {
        const originalDims = d.originalDimensions
        if (originalDims) {
          const expandedWidth = originalDims.width * 1.1
          const expandedHeight = originalDims.height * 1.1
          const expandedX = -expandedWidth / 2
          const expandedY = -expandedHeight / 2
          
          shape
            .transition()
            .duration(200)
            .ease(d3.easeBackOut.overshoot(1.1))
            .attr('width', expandedWidth)
            .attr('height', expandedHeight)
            .attr('x', expandedX)
            .attr('y', expandedY)
        }
      } else if (shapeElement?.tagName === 'circle') {
        const originalRadius = d.originalDimensions?.radius || 20
        const expandedRadius = originalRadius * 1.15
        
        shape
          .transition()
          .duration(200)
          .ease(d3.easeBackOut.overshoot(1.1))
          .attr('r', expandedRadius)
      } else if (shapeElement?.tagName === 'path') {
        // Scale path shapes
        shape
          .transition()
          .duration(200)
          .ease(d3.easeBackOut.overshoot(1.1))
          .attr('transform', 'scale(1.1)')
      }
      
      // Enhance text
      label
        .transition()
        .duration(200)
        .style('font-weight', '700')
        .style('font-size', '13px')
        .style('text-shadow', '0 0 8px rgba(255, 255, 255, 0.8), 1px 1px 2px rgba(0,0,0,0.7)')
      
      strengthIndicator
        .transition()
        .duration(200)
        .style('font-weight', '600')
        .style('font-size', '11px')
        .style('fill', 'var(--ai-accent-primary)')
      
      // Raise node to front
      node.raise()
    })
    .on('mouseleave', function(_event, d: any) {
      const node = d3.select(this)
      const shape = node.select('.node-shape')
      const label = node.select('.node-label')
      const strengthIndicator = node.select('.strength-indicator')
      
      // Remove glow effect
      shape.style('filter', 'drop-shadow(2px 2px 6px rgba(0,0,0,0.4))')
      
      // Restore original size
      const shapeElement = shape.node() as SVGElement
      if (shapeElement?.tagName === 'rect') {
        const originalDims = d.originalDimensions
        if (originalDims) {
          shape
            .transition()
            .duration(300)
            .ease(d3.easeBackOut)
            .attr('width', originalDims.width)
            .attr('height', originalDims.height)
            .attr('x', originalDims.x)
            .attr('y', originalDims.y)
        }
      } else if (shapeElement?.tagName === 'circle') {
        const originalRadius = d.originalDimensions?.radius || 20
        
        shape
          .transition()
          .duration(300)
          .ease(d3.easeBackOut)
          .attr('r', originalRadius)
      } else if (shapeElement?.tagName === 'path') {
        // Restore path scale
        shape
          .transition()
          .duration(300)
          .ease(d3.easeBackOut)
          .attr('transform', 'scale(1)')
      }
      
      // Restore text
      label
        .transition()
        .duration(300)
        .style('font-weight', '600')
        .style('font-size', '12px')
        .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.7)')
      
      strengthIndicator
        .transition()
        .duration(300)
        .style('font-weight', '500')
        .style('font-size', '10px')
        .style('fill', 'var(--ai-text-secondary)')
    })

  // Update existing nodes
  nodeMerge.select('.node-shape')
    .transition()
    .duration(300)
    .attr('fill', d => `url(#${d.data.argumentType}-gradient)`)

  nodeMerge.select('.node-label')
    .text(function(d: any) {
      const label = d.data.label || d.data.name || 'Untitled'
      return label.length > 15 ? label.substring(0, 15) + '...' : label
    })

  nodeMerge.select('.strength-indicator')
    .text(d => d.data.strength ? `${d.data.strength}%` : '')
}

/**
 * Render non-hierarchical edges (attacks, undercuts) as curved paths
 */
function renderNonHierarchicalEdges(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  argumentData: ArgumentData,
  nodes: TreeNodeDatum[],
  config: ArgumentRenderConfig,
  onEdgeClick?: (edge: ArgumentEdge) => void
): void {
  // Get attack and undercut relationships
  const nonHierarchicalEdges = argumentData.relationships.filter(edge => 
    edge.relationshipType === 'attack' || edge.relationshipType === 'undercut'
  )

  // Create node position lookup
  const nodePositions = new Map<string, { x: number; y: number }>()
  nodes.forEach(node => {
    nodePositions.set(node.data.id, { x: node.x || 0, y: node.y || 0 })
  })

  const edgeSelection = g.selectAll<SVGPathElement, ArgumentEdge>('.non-hierarchical-edge')
    .data(nonHierarchicalEdges, d => d.id || `${d.from}-${d.to}`)

  edgeSelection.exit().remove()

  const edgeEnter = edgeSelection.enter()
    .append('path')
    .attr('class', 'non-hierarchical-edge')

  const edgeMerge = edgeEnter.merge(edgeSelection)

  edgeMerge
    .attr('d', d => {
      const sourcePos = d.from ? nodePositions.get(d.from) : null
      const targetPos = d.to ? nodePositions.get(d.to) : null
      
      if (!sourcePos || !targetPos) return ''

      // Create curved path that arcs around the tree
      const dx = targetPos.x - sourcePos.x
      const dy = targetPos.y - sourcePos.y
      const dr = Math.sqrt(dx * dx + dy * dy) * 1.5 // Curve factor

      return `M${sourcePos.x},${sourcePos.y}A${dr},${dr} 0 0,1 ${targetPos.x},${targetPos.y}`
    })
    .attr('fill', 'none')
    .attr('stroke', d => {
      return d.relationshipType === 'attack' 
        ? config.edgeStyle.attack.stroke 
        : config.edgeStyle.undercut.stroke
    })
    .attr('stroke-width', d => {
      return d.relationshipType === 'attack' 
        ? config.edgeStyle.attack.strokeWidth 
        : config.edgeStyle.undercut.strokeWidth
    })
    .attr('stroke-dasharray', d => {
      return d.relationshipType === 'attack' 
        ? config.edgeStyle.attack.strokeDasharray 
        : config.edgeStyle.undercut.strokeDasharray
    })
    .attr('marker-end', d => {
      return d.relationshipType === 'attack' 
        ? 'url(#attack-arrow)' 
        : 'url(#undercut-arrow)'
    })
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      event.stopPropagation()
      onEdgeClick?.(d)
    })

  // Add tooltips
  edgeMerge.append('title')
    .text(d => `${d.relationshipType.toUpperCase()}: ${d.scheme} (${d.confidence}% confidence)`)
}

/**
 * Render hierarchical layout (force-directed with constraints)
 */
export function renderHierarchicalLayout(
  state: TreeRenderState,
  argumentData: ArgumentData,
  config: ArgumentRenderConfig,
  onNodeClick?: (node: ArgumentNode) => void,
  onEdgeClick?: (edge: ArgumentEdge) => void,
  onFacetClick?: FacetClick
): void {
  const { g, width, height } = state

  // Clear existing content
  g.selectAll('*').remove()

  // Prepare nodes and edges for force simulation
  const allNodes = [argumentData.core, ...argumentData.components]
  const allEdges = argumentData.relationships

  // Create force simulation
  const simulation = d3.forceSimulation(allNodes as any)
    .force('link', d3.forceLink(allEdges as any)
      .id((d: any) => d.id)
      .distance(100)
      .strength(0.8)
    )
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(50))

  // Render links
  const linkSelection = g.selectAll<SVGLineElement, ArgumentEdge>('.hierarchical-link')
    .data(allEdges)
    .enter()
    .append('line')
    .attr('class', 'hierarchical-link')
    .attr('stroke', d => {
      switch (d.relationshipType) {
        case 'support': return config.edgeStyle.support.stroke
        case 'attack': return config.edgeStyle.attack.stroke
        case 'undercut': return config.edgeStyle.undercut.stroke
        default: return config.edgeStyle.support.stroke
      }
    })
    .attr('stroke-width', d => {
      switch (d.relationshipType) {
        case 'support': return config.edgeStyle.support.strokeWidth
        case 'attack': return config.edgeStyle.attack.strokeWidth
        case 'undercut': return config.edgeStyle.undercut.strokeWidth
        default: return config.edgeStyle.support.strokeWidth
      }
    })
    .attr('stroke-dasharray', d => {
      switch (d.relationshipType) {
        case 'support': return config.edgeStyle.support.strokeDasharray || 'none'
        case 'attack': return config.edgeStyle.attack.strokeDasharray
        case 'undercut': return config.edgeStyle.undercut.strokeDasharray
        default: return 'none'
      }
    })
    .attr('marker-end', d => `url(#${d.relationshipType}-arrow)`)
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      event.stopPropagation()
      onEdgeClick?.(d)
    })

  // Render nodes
  const nodeSelection = g.selectAll<SVGGElement, ArgumentNode>('.hierarchical-node')
    .data(allNodes)
    .enter()
    .append('g')
    .attr('class', 'hierarchical-node')
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      event.stopPropagation()
      onNodeClick?.(d)
    })
    .call(d3.drag<SVGGElement, ArgumentNode>()
      .on('start', (event, d: any) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d: any) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d: any) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })
    )

  // Add node shapes (reuse from tree renderer)
  nodeSelection.each(function(d) {
    const node = d3.select(this)
    const argumentType = d.argumentType
    const color = ARGUMENT_COLORS[argumentType]

    // Add appropriate shape based on argument type
    switch (argumentType) {
      case 'claim':
        node.append('rect')
          .attr('class', 'node-shape')
          .attr('x', -60).attr('y', -20)
          .attr('width', 120).attr('height', 40)
          .attr('rx', 8)
        break
      case 'ground':
      case 'backing':
        node.append('rect')
          .attr('class', 'node-shape')
          .attr('x', -50).attr('y', -15)
          .attr('width', 100).attr('height', 30)
          .attr('rx', 15)
        break
      case 'warrant':
        node.append('path')
          .attr('class', 'node-shape')
          .attr('d', 'M-40,0 L0,-20 L40,0 L0,20 Z')
        break
      case 'rebuttal':
        node.append('path')
          .attr('class', 'node-shape')
          .attr('d', 'M-30,-15 L30,-15 L40,0 L30,15 L-30,15 L-40,0 Z')
        break
      case 'qualifier':
        node.append('circle')
          .attr('class', 'node-shape')
          .attr('r', 20)
        break
    }

    node.select('.node-shape')
      .attr('fill', color)
      .attr('stroke', d3.color(color)?.darker(1).toString() || color)
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))')

    node.append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('fill', 'white')
      .style('font-size', '12px')
      .style('font-weight', '600')
      .style('pointer-events', 'none')
      .text(function(d: any) {
        const label = d.label || d.name || 'Untitled'
        return label.length > 15 ? label.substring(0, 15) + '...' : label
      })

    // Add facet icons if callback is provided
    if (onFacetClick) {
      createFacetIcons(node, onFacetClick)
    }
  })

  // Update positions on simulation tick
  simulation.on('tick', () => {
    linkSelection
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y)

    nodeSelection
      .attr('transform', (d: any) => `translate(${d.x}, ${d.y})`)
  })
}

/**
 * Update overlay visibility based on zoom level
 */
function updateOverlayVisibility(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  scale: number
): void {
  // Show/hide strength indicators based on zoom level
  g.selectAll('.strength-indicator')
    .style('opacity', scale > 0.5 ? 1 : 0)
    .style('display', scale > 0.3 ? 'block' : 'none')
  
  // Show/hide conflict overlays based on zoom level  
  g.selectAll('.conflict-overlay')
    .style('opacity', scale > 0.4 ? 0.8 : 0)
    .style('display', scale > 0.2 ? 'block' : 'none')
    
  // Show/hide scheme labels based on zoom level
  g.selectAll('.scheme-label')
    .style('opacity', scale > 0.7 ? 1 : 0)
    .style('display', scale > 0.5 ? 'block' : 'none')
    
  // Adjust node detail level
  g.selectAll('.node-detail')
    .style('opacity', scale > 0.8 ? 1 : 0)
    
  // Adjust text size based on zoom
  g.selectAll('.node-label')
    .style('font-size', `${Math.max(10, 12 * scale)}px`)
}
