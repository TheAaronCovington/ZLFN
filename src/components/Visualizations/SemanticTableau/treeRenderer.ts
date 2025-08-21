/**
 * Tree Rendering for SemanticTableau
 * Handles D3 tree layout and SVG rendering for tableau visualization
 */

import * as d3 from 'd3'
import type { TableauNode } from './tableauLogic'
import { getRuleName, isAlpha, isBeta, isImplication, isBiconditional, isQuantifier, isDoubleNeg } from './tableauLogic'

export interface TreeRenderConfig {
  width: number
  height: number
  layoutMode: 'tree' | 'hierarchy'
  nodeSize: [number, number]
  linkDistance: number
}

export interface TreeCallbacks {
  onNodeClick?: (node: TableauNode, event: MouseEvent) => void
  onNodeDoubleClick?: (node: TableauNode, event: MouseEvent) => void
  onNodeMouseEnter?: (node: TableauNode, event: MouseEvent) => void
  onNodeMouseLeave?: (node: TableauNode, event: MouseEvent) => void
}

/**
 * Renders the tableau tree using D3
 */
export function renderTableauTree(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  root: TableauNode,
  config: TreeRenderConfig,
  callbacks?: TreeCallbacks
): void {
  // Clear previous content
  svg.selectAll('*').remove()

  // Set up SVG dimensions
  svg.attr('width', config.width).attr('height', config.height)

  // Create main group
  const g = svg.append('g').attr('class', 'tableau-tree')

  // Create tree layout
  const treeLayout = d3.tree<TableauNode>()
    .size([config.width - 100, config.height - 100])
    .nodeSize(config.nodeSize)

  // Convert tableau to d3 hierarchy
  const hierarchy = d3.hierarchy(root, d => d.children)
  
  // Apply layout
  const treeData = treeLayout(hierarchy)

  // Center the tree
  const nodes = treeData.descendants()
  const links = treeData.links()

  // Calculate bounds for centering
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  
  nodes.forEach(d => {
    minX = Math.min(minX, d.x)
    maxX = Math.max(maxX, d.x)
    minY = Math.min(minY, d.y)
    maxY = Math.max(maxY, d.y)
  })

  const treeWidth = maxX - minX
  const offsetX = (config.width - treeWidth) / 2 - minX
  const offsetY = 50 - minY

  g.attr('transform', `translate(${offsetX}, ${offsetY})`)

  // Render links
  renderLinks(g, links)
  
  // Render nodes
  renderNodes(g, nodes, callbacks)
  
  // Render rule badges
  renderRuleBadges(g, nodes)
}

/**
 * Renders tree links (edges between nodes)
 */
function renderLinks(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  links: d3.HierarchyLink<TableauNode>[]
): void {
  g.selectAll<SVGPathElement, any>('.link')
    .data(links)
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('d', d => {
      const source = d.source
      const target = d.target
      
      const sourceY = source.y || 0
      const targetY = target.y || 0
      return `M${source.x},${sourceY}
              C${source.x},${(sourceY + targetY) / 2}
               ${target.x},${(sourceY + targetY) / 2}
               ${target.x},${targetY}`
    })
    .attr('fill', 'none')
    .attr('stroke-width', 2)
    .attr('stroke', (d) => getLinkColor(d.source.data, d.target.data))
    .attr('stroke-dasharray', (d) => getLinkDashArray(d.source.data, d.target.data))
}

/**
 * Renders tree nodes
 */
function renderNodes(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  nodes: d3.HierarchyPointNode<TableauNode>[],
  callbacks?: TreeCallbacks
): void {
  const nodeSelection = g.selectAll<SVGGElement, any>('.node')
    .data(nodes)
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.x}, ${d.y})`)
    .attr('id', d => `tableau-node-${d.data.id}`)

  // Add node circles
  nodeSelection
    .append('circle')
    .attr('r', 20)
    .attr('fill', d => getNodeColor(d.data))
    .attr('stroke', d => getNodeStrokeColor(d.data))
    .attr('stroke-width', 2)
    .style('cursor', 'pointer')

  // Add node labels
  nodeSelection
    .append('text')
    .attr('dy', '0.35em')
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', '500')
    .style('fill', '#fff')
    .style('pointer-events', 'none')
    .text(d => truncateLabel(d.data.label, 8))

  // Add tooltips
  nodeSelection
    .append('title')
    .text(d => createNodeTooltip(d.data))

  // Add event handlers
  if (callbacks) {
    nodeSelection
      .on('click', function(event, d) {
        event.stopPropagation()
        callbacks.onNodeClick?.(d.data, event)
      })
      .on('dblclick', function(event, d) {
        event.stopPropagation()
        callbacks.onNodeDoubleClick?.(d.data, event)
      })
      .on('mouseenter', function(event, d) {
        callbacks.onNodeMouseEnter?.(d.data, event)
      })
      .on('mouseleave', function(event, d) {
        callbacks.onNodeMouseLeave?.(d.data, event)
      })
  }
}

/**
 * Renders rule badges next to nodes
 */
function renderRuleBadges(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  nodes: d3.HierarchyPointNode<TableauNode>[]
): void {
  const badgeSelection = g.selectAll<SVGGElement, any>('.rule-badge')
    .data(nodes.filter(d => d.parent)) // Only show badges for non-root nodes
    .enter()
    .append('g')
    .attr('class', 'rule-badge')
    .attr('transform', d => `translate(${d.x + 25}, ${d.y - 25})`)

  // Add badge circle
  badgeSelection
    .append('circle')
    .attr('r', 12)
    .attr('fill', d => getRuleBadgeColor(d.data))
    .attr('stroke', '#fff')
    .attr('stroke-width', 1)

  // Add badge text
  badgeSelection
    .append('text')
    .attr('dy', '0.35em')
    .attr('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('font-weight', 'bold')
    .style('fill', '#fff')
    .text(d => getRuleBadgeText(d.data))

  // Add badge tooltips
  badgeSelection
    .append('title')
    .text(d => getRuleName(d.data))
}

/**
 * Gets the color for a tree link based on rule type
 */
function getLinkColor(source: TableauNode, _target: TableauNode): string {
  if (!source.ast) return '#666'
  
  if (isAlpha(source.ast)) return '#2196f3' // Blue for alpha rules
  if (isBeta(source.ast)) return '#ff9800' // Orange for beta rules
  if (isImplication(source.ast)) return '#9c27b0' // Purple for implication
  if (isBiconditional(source.ast)) return '#e91e63' // Pink for biconditional
  if (isQuantifier(source.ast)) return '#673ab7' // Deep purple for quantifiers
  if (isDoubleNeg(source.ast)) return '#4caf50' // Green for double negation
  
  return '#666' // Default gray
}

/**
 * Gets the dash array for a tree link based on rule type
 */
function getLinkDashArray(source: TableauNode, _target: TableauNode): string | null {
  if (!source.ast) return null
  
  if (isBeta(source.ast)) return '5,5' // Dashed for beta rules
  if (isQuantifier(source.ast)) return '2,3' // Dotted for quantifiers
  if (isDoubleNeg(source.ast)) return '1,2' // Fine dots for double negation
  
  return null // Solid line for alpha rules and others
}

/**
 * Gets the color for a node based on its type
 */
function getNodeColor(node: TableauNode): string {
  switch (node.type) {
    case 'root': return '#1976d2' // Blue
    case 'closed': return '#d32f2f' // Red
    case 'open': return '#388e3c' // Green
    case 'intermediate': return '#f57c00' // Orange
    default: return '#757575' // Gray
  }
}

/**
 * Gets the stroke color for a node
 */
function getNodeStrokeColor(node: TableauNode): string {
  return node.type === 'root' ? '#ffd700' : '#333'
}

/**
 * Gets the color for a rule badge
 */
function getRuleBadgeColor(node: TableauNode): string {
  if (!node.ast) return '#666'
  
  if (isAlpha(node.ast)) return '#2196f3'
  if (isBeta(node.ast)) return '#ff9800'
  if (isImplication(node.ast)) return '#9c27b0'
  if (isBiconditional(node.ast)) return '#e91e63'
  if (isQuantifier(node.ast)) return '#673ab7'
  if (isDoubleNeg(node.ast)) return '#4caf50'
  
  return '#666'
}

/**
 * Gets the text for a rule badge
 */
function getRuleBadgeText(node: TableauNode): string {
  if (!node.ast) return '?'
  
  if (isAlpha(node.ast)) return 'α'
  if (isBeta(node.ast)) return 'β'
  if (isImplication(node.ast)) return '→'
  if (isBiconditional(node.ast)) return '↔'
  if (isQuantifier(node.ast)) return node.ast.label === '∀' ? '∀' : '∃'
  if (isDoubleNeg(node.ast)) return '¬¬'
  
  return '?'
}

/**
 * Creates tooltip content for a node
 */
function createNodeTooltip(node: TableauNode): string {
  const parts: string[] = []
  
  parts.push(`Formula: ${node.label}`)
  parts.push(`Type: ${node.type}`)
  
  if (node.ast) {
    parts.push(`Rule: ${getRuleName(node)}`)
  }
  
  if (node.depth !== undefined) {
    parts.push(`Depth: ${node.depth}`)
  }
  
  return parts.join('\n')
}

/**
 * Truncates a label to fit in the node
 */
function truncateLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) return label
  return label.substring(0, maxLength - 1) + '…'
}

/**
 * Highlights a path from root to a specific node
 */
export function highlightPath(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  targetNodeId: string
): void {
  // Reset all highlights
  svg.selectAll('.node circle').style('stroke-width', 2)
  svg.selectAll('.link').style('stroke-width', 2).style('opacity', 0.7)
  
  // Find the target node and trace back to root
  const targetNode = svg.select(`#tableau-node-${targetNodeId}`)
  if (targetNode.empty()) return
  
  // Highlight the path (this would need more complex logic to trace the actual path)
  targetNode.select('circle')
    .style('stroke', '#ffd700')
    .style('stroke-width', 4)
}

/**
 * Fits the tree to the viewport
 */
export function fitTreeToViewport(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  config: TreeRenderConfig
): void {
  const g = svg.select('.tableau-tree')
  if (g.empty()) return
  
  try {
    const bounds = (g.node() as SVGGElement).getBBox()
    const fullWidth = config.width
    const fullHeight = config.height
    const width = bounds.width
    const height = bounds.height
    
    if (width === 0 || height === 0) return
    
    const midX = bounds.x + width / 2
    const midY = bounds.y + height / 2
    const scale = Math.min(fullWidth / width, fullHeight / height) * 0.9
    
    const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY]
    
    g.transition()
      .duration(750)
      .attr('transform', `translate(${translate[0]}, ${translate[1]}) scale(${scale})`)
  } catch (error) {
    console.warn('Error fitting tree to viewport:', error)
  }
}

/**
 * Centers the tree in the viewport
 */
export function centerTree(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  config: TreeRenderConfig
): void {
  const g = svg.select('.tableau-tree')
  if (g.empty()) return
  
  try {
    const bounds = (g.node() as SVGGElement).getBBox()
    const centerX = config.width / 2
    const centerY = config.height / 2
    const boundsX = bounds.x + bounds.width / 2
    const boundsY = bounds.y + bounds.height / 2
    
    g.transition()
      .duration(500)
      .attr('transform', `translate(${centerX - boundsX}, ${centerY - boundsY})`)
  } catch (error) {
    console.warn('Error centering tree:', error)
  }
}
