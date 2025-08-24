/**
 * Rendering Logic for ZlfnGraph
 * Handles SVG rendering, visual updates, and D3 selections
 */

import * as d3 from 'd3'
import type { ZlfnNode, ZlfnEdge, ZlfnZone, RenderConfig, GraphRefs } from './types'
import { truncateText } from '../../../vis/utils/format'

export interface RenderCallbacks {
  onNodeUpdate?: (node: ZlfnNode) => void
}

/**
 * Renders nodes in the SVG
 */
export function renderNodes(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  nodes: ZlfnNode[],
  config: RenderConfig,
  _callbacks?: RenderCallbacks
): d3.Selection<SVGGElement, any, any, any> {
  
  const nodeSelection = g.selectAll<SVGGElement, any>('.node')
    .data(nodes, (d: any) => d.id)

  // Remove exiting nodes
  nodeSelection.exit().remove()

  // Create new node groups
  const nodeEnter = nodeSelection.enter()
    .append('g')
    .attr('class', 'node')
    .attr('id', (d: any) => `node-${d.id}`)

  // Add node shapes with hover animations
  nodeEnter.each(function(d: any) {
    const node = d3.select(this)
    
    // Add glow filter definition
    if (!g.select('defs').node()) {
      const defs = g.append('defs')
      
      // Create glow filter
      const glowFilter = defs.append('filter')
        .attr('id', 'glow')
        .attr('x', '-50%')
        .attr('y', '-50%')
        .attr('width', '200%')
        .attr('height', '200%')
      
      glowFilter.append('feGaussianBlur')
        .attr('stdDeviation', '4')
        .attr('result', 'coloredBlur')
      
      const feMerge = glowFilter.append('feMerge')
      feMerge.append('feMergeNode').attr('in', 'coloredBlur')
      feMerge.append('feMergeNode').attr('in', 'SourceGraphic')
      
      // Create pulse animation filter
      const pulseFilter = defs.append('filter')
        .attr('id', 'pulse')
        .attr('x', '-100%')
        .attr('y', '-100%')
        .attr('width', '300%')
        .attr('height', '300%')
      
      pulseFilter.append('feGaussianBlur')
        .attr('stdDeviation', '2')
        .attr('result', 'blur')
      
      pulseFilter.append('feColorMatrix')
        .attr('in', 'blur')
        .attr('type', 'matrix')
        .attr('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.5 0')
        .attr('result', 'glow')
      
      const pulseMerge = pulseFilter.append('feMerge')
      pulseMerge.append('feMergeNode').attr('in', 'glow')
      pulseMerge.append('feMergeNode').attr('in', 'SourceGraphic')
    }
    
    if (d.size && 'width' in d.size) {
      // Rectangle node with hover expansion
      const rect = node.append('rect')
        .attr('width', d.size.width)
        .attr('height', d.size.height)
        .attr('x', -d.size.width / 2)
        .attr('y', -d.size.height / 2)
        .attr('rx', 4)
        .attr('ry', 4)
        .style('transition', 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)')
        .style('cursor', 'pointer')
      
      // Store original dimensions
      rect.datum({ ...d, originalWidth: d.size.width, originalHeight: d.size.height })
    } else {
      // Circle node with hover expansion
      const radius = d.size?.radius || 20
      const circle = node.append('circle')
        .attr('r', radius)
        .style('transition', 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)')
        .style('cursor', 'pointer')
      
      // Store original radius
      circle.datum({ ...d, originalRadius: radius })
    }
    
    // Add node label with hover effects
    node.append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('font-size', '12px')
      .style('font-weight', '500')
      .style('pointer-events', 'none')
      .style('user-select', 'none')
      .style('transition', 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)')
  })

  // Merge enter and update selections
  const nodeUpdate = nodeEnter.merge(nodeSelection)

  // Update node positions
  nodeUpdate
    .attr('transform', (d: any) => `translate(${d.x || 0}, ${d.y || 0})`)

  // Update node appearance
  nodeUpdate.select('rect, circle')
    .attr('fill', (d: any) => d.color || getDefaultNodeColor(d.type))
    .attr('stroke', (d: any) => config.pinnedIds.has(d.id) ? '#ffd700' : '#333')
    .attr('stroke-width', (d: any) => config.pinnedIds.has(d.id) ? 3 : 1)
    .style('opacity', (_d: any) => {
      if (config.hideNonPath) {
        // Logic for path highlighting would go here
        return 1
      }
      return 1
    })

  // Update node labels with truncation to fit node width
  nodeUpdate.select('.node-label')
    .each(function(d: any) {
      const textEl = d3.select(this)
      const fullLabel = d.name || d.symbol || d.label || d.id
      const nodeWidth = d.size && 'width' in d.size
        ? d.size.width
        : d.size && 'radius' in d.size
          ? d.size.radius * 2
          : 40
      const maxChars = Math.max(1, Math.floor((nodeWidth - 10) / 7))
      const truncated = truncateText(fullLabel, maxChars)

      textEl
        .text(truncated)
        .attr('data-full-label', fullLabel)
        .attr('data-truncated-label', truncated)
        .select('title').remove()
      textEl.append('title').text(fullLabel)
    })
    .style('fill', (d: any) => getNodeTextColor(d.color))

  // Add hover interactions with expansion and glow effects
  nodeUpdate
    .on('mouseenter', function(_event, d: any) {
      const node = d3.select(this)
      const shape = node.select('rect, circle')
      const label = node.select('.node-label')
      const fullLabel = label.attr('data-full-label') || ''
      label.text(fullLabel)

      // Apply glow effect
      shape.style('filter', 'url(#glow)')

      const approxLabelWidth = fullLabel.length * 7 + 10

      // Expand node
      const shapeElement = shape.node() as SVGElement
      if (shapeElement?.tagName === 'rect') {
        const originalWidth = d.originalWidth || d.size?.width || 100
        const originalHeight = d.originalHeight || d.size?.height || 40
        const expandedWidth = Math.max(originalWidth * 1.15, approxLabelWidth)
        const expandedHeight = originalHeight * 1.15

        shape
          .transition()
          .duration(200)
          .ease(d3.easeBackOut.overshoot(1.2))
          .attr('width', expandedWidth)
          .attr('height', expandedHeight)
          .attr('x', -expandedWidth / 2)
          .attr('y', -expandedHeight / 2)
      } else if (shapeElement?.tagName === 'circle') {
        const originalRadius = d.originalRadius || d.size?.radius || 20
        const expandedRadius = Math.max(originalRadius * 1.2, approxLabelWidth / 2)

        shape
          .transition()
          .duration(200)
          .ease(d3.easeBackOut.overshoot(1.2))
          .attr('r', expandedRadius)
      }

      // Enhance label
      label
        .transition()
        .duration(200)
        .style('font-weight', '600')
        .style('font-size', '13px')
        .style('text-shadow', '0 0 8px rgba(100, 200, 255, 0.6)')

      // Raise node to front
      node.raise()
    })
    .on('mouseleave', function(_event, d: any) {
      const node = d3.select(this)
      const shape = node.select('rect, circle')
      const label = node.select('.node-label')
      
      // Remove glow effect
      shape.style('filter', null)
      
      // Restore original size
      const shapeElement = shape.node() as SVGElement
      if (shapeElement?.tagName === 'rect') {
        const originalWidth = d.originalWidth || d.size?.width || 100
        const originalHeight = d.originalHeight || d.size?.height || 40
        
        shape
          .transition()
          .duration(300)
          .ease(d3.easeBackOut)
          .attr('width', originalWidth)
          .attr('height', originalHeight)
          .attr('x', -originalWidth / 2)
          .attr('y', -originalHeight / 2)
      } else if (shapeElement?.tagName === 'circle') {
        const originalRadius = d.originalRadius || d.size?.radius || 20
        
        shape
          .transition()
          .duration(300)
          .ease(d3.easeBackOut)
          .attr('r', originalRadius)
      }
      
      // Restore label
      label
        .text(label.attr('data-truncated-label') || '')
        .transition()
        .duration(300)
        .style('font-weight', '500')
        .style('font-size', '12px')
        .style('text-shadow', 'none')
    })

  return nodeUpdate
}

/**
 * Renders edges in the SVG
 */
export function renderEdges(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  edges: ZlfnEdge[],
  config: RenderConfig
): d3.Selection<SVGPathElement, any, any, any> {
  
  // Filter edges based on rule filter
  const filteredEdges = config.ruleFilter 
    ? edges.filter(e => e.rule?.toLowerCase().includes(config.ruleFilter.toLowerCase()))
    : edges

  const edgeSelection = g.selectAll<SVGPathElement, any>('.edge')
    .data(filteredEdges, (d: any, i: number) => d.id || `edge-${i}`)

  // Remove exiting edges
  edgeSelection.exit().remove()

  // Create new edges
  const edgeEnter = edgeSelection.enter()
    .append('path')
    .attr('class', 'edge')
    .attr('fill', 'none')
    .attr('marker-end', 'url(#arrowhead)')

  // Merge enter and update selections
  const edgeUpdate = edgeEnter.merge(edgeSelection)

  // Update edge paths
  edgeUpdate
    .attr('d', (d: any) => {
      const source = typeof d.source === 'object' ? d.source : { x: 0, y: 0 }
      const target = typeof d.target === 'object' ? d.target : { x: 0, y: 0 }
      
      if (config.showRivers) {
        return createCurvedPath(source, target)
      } else {
        return createStraightPath(source, target)
      }
    })
    .attr('stroke', (d: any) => d.color || getDefaultEdgeColor(d.type))
    .attr('stroke-width', (d: any) => getEdgeWidth(d.weight))
    .attr('stroke-dasharray', (d: any) => getEdgeStrokePattern(d.style))
    .style('opacity', (_d: any, i: number) => {
      if (config.selectedEdgeIndex === i) return 1
      if (config.hideNonPath) {
        // Logic for path highlighting would go here
        return 0.3
      }
      return 0.7
    })

  // Add edge labels if enabled
  if (config.showEdgeLabels) {
    renderEdgeLabels(g, filteredEdges, config)
  } else {
    g.selectAll('.edge-label').remove()
  }

  return edgeUpdate
}

/**
 * Renders edge labels
 */
function renderEdgeLabels(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  edges: ZlfnEdge[],
  _config: RenderConfig
) {
  const labelSelection = g.selectAll<SVGTextElement, any>('.edge-label')
    .data(edges.filter(e => e.rule || e.label), (d: any, i: number) => `label-${d.id || i}`)

  labelSelection.exit().remove()

  const labelEnter = labelSelection.enter()
    .append('text')
    .attr('class', 'edge-label')
    .attr('text-anchor', 'middle')
    .attr('dy', '-5')
    .style('font-size', '10px')
    .style('fill', '#666')
    .style('pointer-events', 'none')

  const labelUpdate = labelEnter.merge(labelSelection)

  labelUpdate
    .attr('x', (d: any) => {
      const source = typeof d.source === 'object' ? d.source : { x: 0, y: 0 }
      const target = typeof d.target === 'object' ? d.target : { x: 0, y: 0 }
      return (source.x + target.x) / 2
    })
    .attr('y', (d: any) => {
      const source = typeof d.source === 'object' ? d.source : { x: 0, y: 0 }
      const target = typeof d.target === 'object' ? d.target : { x: 0, y: 0 }
      return (source.y + target.y) / 2
    })
    .text((d: any) => d.rule || d.label || '')
}

/**
 * Renders zones in the SVG
 */
export function renderZones(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  zones: ZlfnZone[],
  _config: RenderConfig
) {
  const visibleZones = zones.filter(z => z.visible !== false)

  const zoneSelection = g.selectAll<SVGRectElement, any>('rect.zone')
    .data(visibleZones, (d: any) => d.id)

  zoneSelection.exit().remove()

  const zoneEnter = zoneSelection.enter()
    .append('rect')
    .attr('class', 'zone')
    .style('pointer-events', 'none')

  const zoneUpdate = zoneEnter.merge(zoneSelection)

  zoneUpdate
    .attr('x', (d: any) => d.xRange[0])
    .attr('y', (d: any) => d.yRange[0])
    .attr('width', (d: any) => d.xRange[1] - d.xRange[0])
    .attr('height', (d: any) => d.yRange[1] - d.yRange[0])
    .attr('fill', (d: any) => d.color)
    .attr('fill-opacity', 0.1)
    .attr('stroke', (d: any) => d.color)
    .attr('stroke-opacity', 0.3)
    .attr('stroke-width', 1)
    .attr('rx', 8)
    .attr('ry', 8)

  // Add zone labels
  const zoneLabelSelection = g.selectAll<SVGTextElement, any>('.zone-label')
    .data(visibleZones, (d: any) => `${d.id}-label`)

  zoneLabelSelection.exit().remove()

  const zoneLabelEnter = zoneLabelSelection.enter()
    .append('text')
    .attr('class', 'zone-label')
    .style('pointer-events', 'none')
    .style('font-size', '14px')
    .style('font-weight', '600')

  const zoneLabelUpdate = zoneLabelEnter.merge(zoneLabelSelection)

  zoneLabelUpdate
    .attr('x', (d: any) => d.xRange[0] + 10)
    .attr('y', (d: any) => d.yRange[0] + 25)
    .attr('fill', (d: any) => d.color)
    .text((d: any) => d.name)
}

/**
 * Sets up SVG definitions (markers, gradients, etc.)
 */
export function setupSVGDefinitions(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) {
  const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs')

  // Arrow marker
  if (defs.select('#arrowhead').empty()) {
    const arrowMarker = defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')

    arrowMarker.append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#666')
  }

  // Glow filter for highlights
  if (defs.select('#glow').empty()) {
    const glowFilter = defs.append('filter')
      .attr('id', 'glow')
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
  }
}

/**
 * Creates a curved path between two points
 */
function createCurvedPath(source: { x: number; y: number }, target: { x: number; y: number }): string {
  const dx = target.x - source.x
  const dy = target.y - source.y
  const dr = Math.sqrt(dx * dx + dy * dy) * 0.3
  
  return `M${source.x},${source.y}A${dr},${dr} 0 0,1 ${target.x},${target.y}`
}

/**
 * Creates a straight path between two points
 */
function createStraightPath(source: { x: number; y: number }, target: { x: number; y: number }): string {
  return `M${source.x},${source.y}L${target.x},${target.y}`
}

/**
 * Gets default color for node type
 */
function getDefaultNodeColor(type?: string): string {
  switch (type) {
    case 'premise': return '#20B2AA'
    case 'conclusion': return '#9370DB'
    case 'term': return '#4169E1'
    case 'fallacy': return '#DC143C'
    case 'core': return '#FFD700'
    case 'informal': return '#ffb74d'
    case 'temporal': return '#64b5f6'
    default: return '#69b3a2'
  }
}

/**
 * Gets default color for edge type
 */
function getDefaultEdgeColor(type?: string): string {
  switch (type) {
    case 'implication': return '#4CAF50'
    case 'counterexample': return '#F44336'
    case 'bidirectional': return '#2196F3'
    case 'semantic': return '#9C27B0'
    default: return '#666'
  }
}

/**
 * Gets edge width based on weight
 */
function getEdgeWidth(weight?: number): number {
  if (weight === undefined) return 2
  return Math.max(1, Math.min(5, weight / 20))
}

/**
 * Gets stroke pattern for edge style
 */
function getEdgeStrokePattern(style?: string): string | null {
  switch (style) {
    case 'dashed': return '5,5'
    case 'dotted': return '2,2'
    default: return null
  }
}

/**
 * Gets appropriate text color for node background
 */
function getNodeTextColor(backgroundColor?: string): string {
  if (!backgroundColor) return '#000'
  
  // Simple brightness calculation
  const hex = backgroundColor.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  
  return brightness > 128 ? '#000' : '#fff'
}

/**
 * Updates the entire visualization
 */
export function updateVisualization(
  refs: GraphRefs,
  nodes: ZlfnNode[],
  edges: ZlfnEdge[],
  zones: ZlfnZone[],
  config: RenderConfig,
  callbacks?: RenderCallbacks
) {
  if (!refs.g.current) return

  const g = d3.select(refs.g.current)

  // Render zones first (background)
  renderZones(g, zones, config)
  
  // Render edges
  renderEdges(g, edges, config)
  
  // Render nodes (foreground)
  renderNodes(g, nodes, config, callbacks)
}
