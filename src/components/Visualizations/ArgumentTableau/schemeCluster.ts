/**
 * Argument Scheme Clustering Logic
 * Groups edges by argumentation schemes and provides visual clustering
 */

import * as d3 from 'd3'
import type { ArgumentEdge, ArgumentData, SchemeCluster } from './types'

/**
 * Predefined scheme colors for consistent visualization
 */
const SCHEME_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
  '#BB8FCE', // Lavender
  '#85C1E9'  // Sky Blue
]

/**
 * Group edges by their argumentation schemes
 */
export function groupEdgesByScheme(argumentData: ArgumentData): SchemeCluster[] {
  const schemeGroups = new Map<string, ArgumentEdge[]>()
  
  // Group edges by scheme
  argumentData.relationships.forEach(edge => {
    const scheme = edge.scheme || 'Unknown Scheme'
    if (!schemeGroups.has(scheme)) {
      schemeGroups.set(scheme, [])
    }
    schemeGroups.get(scheme)!.push(edge)
  })

  // Convert to SchemeCluster array with colors and priorities
  const clusters: SchemeCluster[] = []
  let colorIndex = 0

  schemeGroups.forEach((edges, scheme) => {
    const avgConfidence = edges.reduce((sum, edge) => sum + edge.confidence, 0) / edges.length
    
    clusters.push({
      scheme,
      edges,
      priority: avgConfidence, // Higher confidence = higher priority
      label: `${scheme} (${edges.length})`,
      color: SCHEME_COLORS[colorIndex % SCHEME_COLORS.length]
    })
    
    colorIndex++
  })

  // Sort by priority (confidence) descending
  return clusters.sort((a, b) => b.priority - a.priority)
}

/**
 * Apply scheme clustering to edges for visual grouping
 */
export function applySchemeClustering(
  argumentData: ArgumentData,
  enableClustering: boolean = true
): ArgumentData {
  if (!enableClustering) {
    // Remove clustering
    const updatedRelationships = argumentData.relationships.map(edge => ({
      ...edge,
      clustered: false,
      clusterLabel: undefined
    }))
    
    return {
      ...argumentData,
      relationships: updatedRelationships
    }
  }

  const clusters = groupEdgesByScheme(argumentData)
  const schemeToCluster = new Map<string, SchemeCluster>()
  
  clusters.forEach(cluster => {
    schemeToCluster.set(cluster.scheme, cluster)
  })

  // Apply clustering information to edges
  const updatedRelationships = argumentData.relationships.map(edge => {
    const cluster = schemeToCluster.get(edge.scheme || 'Unknown Scheme')
    
    return {
      ...edge,
      clustered: true,
      clusterLabel: cluster?.label || edge.scheme
    }
  })

  return {
    ...argumentData,
    relationships: updatedRelationships
  }
}

/**
 * Render scheme cluster legend
 */
export function renderSchemeClusterLegend(
  container: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  clusters: SchemeCluster[],
  onClusterClick?: (cluster: SchemeCluster) => void
): void {
  // Clear existing legend
  container.selectAll('*').remove()

  if (clusters.length === 0) return

  // Create legend container
  const legend = container
    .append('div')
    .style('background', 'var(--ai-bg-secondary)')
    .style('border', '1px solid rgba(64,196,255,0.3)')
    .style('border-radius', '8px')
    .style('padding', '12px')
    .style('margin', '8px 0')

  legend.append('div')
    .style('font-weight', '600')
    .style('margin-bottom', '8px')
    .style('color', 'var(--ai-text-primary)')
    .text('Argumentation Schemes')

  // Create cluster items
  const clusterItems = legend.selectAll('.cluster-item')
    .data(clusters)
    .enter()
    .append('div')
    .attr('class', 'cluster-item')
    .style('display', 'flex')
    .style('align-items', 'center')
    .style('margin', '4px 0')
    .style('padding', '6px')
    .style('border-radius', '4px')
    .style('cursor', onClusterClick ? 'pointer' : 'default')
    .style('transition', 'background-color 0.2s')
    .on('mouseenter', function() {
      if (onClusterClick) {
        d3.select(this).style('background', 'rgba(64,196,255,0.1)')
      }
    })
    .on('mouseleave', function() {
      d3.select(this).style('background', 'transparent')
    })
    .on('click', function(_event, d) {
      if (onClusterClick) {
        onClusterClick(d)
      }
    })

  // Color indicator
  clusterItems.append('div')
    .style('width', '12px')
    .style('height', '12px')
    .style('border-radius', '50%')
    .style('margin-right', '8px')
    .style('flex-shrink', '0')
    .style('background', d => d.color || '#666')
    .style('border', '1px solid rgba(0,0,0,0.2)')

  // Scheme label
  clusterItems.append('div')
    .style('flex', '1')
    .style('font-size', '12px')
    .style('color', 'var(--ai-text-primary)')
    .text(d => d.label)

  // Priority indicator
  clusterItems.append('div')
    .style('font-size', '10px')
    .style('color', 'var(--ai-text-secondary)')
    .style('margin-left', '8px')
    .text(d => `${Math.round(d.priority)}%`)
}

/**
 * Calculate scheme cluster layout positions for better edge routing
 */
export function calculateClusterLayout(
  clusters: SchemeCluster[],
  nodes: any[],
  width: number,
  height: number
): Map<string, { x: number; y: number; radius: number }> {
  const clusterPositions = new Map<string, { x: number; y: number; radius: number }>()

  if (clusters.length === 0) return clusterPositions

  // Create node position lookup
  const nodePositions = new Map<string, { x: number; y: number }>()
  nodes.forEach(node => {
    nodePositions.set(node.id || node.data?.id, { 
      x: node.x || node.data?.x || 0, 
      y: node.y || node.data?.y || 0 
    })
  })

  clusters.forEach((cluster) => {
    // Calculate centroid of nodes involved in this scheme
    const involvedNodes = new Set<string>()
    cluster.edges.forEach(edge => {
      if (edge.from) involvedNodes.add(edge.from)
      if (edge.to) involvedNodes.add(edge.to)
    })

    let centerX = 0, centerY = 0, count = 0
    involvedNodes.forEach(nodeId => {
      const pos = nodePositions.get(nodeId)
      if (pos) {
        centerX += pos.x
        centerY += pos.y
        count++
      }
    })

    if (count > 0) {
      centerX /= count
      centerY /= count
    } else {
      // Fallback positioning
      centerX = width / 2
      centerY = height / 2
    }

    // Calculate radius based on number of edges and spread
    const baseRadius = 50
    const edgeCount = cluster.edges.length
    const radius = baseRadius + (edgeCount * 10)

    clusterPositions.set(cluster.scheme, {
      x: centerX,
      y: centerY,
      radius: Math.min(radius, 150) // Cap maximum radius
    })
  })

  return clusterPositions
}

/**
 * Render scheme cluster backgrounds in SVG with zoom-aware scaling and fade effects
 */
export function renderSchemeClusterBackgrounds(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  clusters: SchemeCluster[],
  clusterPositions: Map<string, { x: number; y: number; radius: number }>,
  showClusters: boolean = true,
  zoomScale: number = 1
): void {
  if (!showClusters) {
    container.selectAll('.scheme-cluster-bg').remove()
    container.selectAll('.scheme-cluster-label').remove()
    return
  }

  const clusterData = clusters.map(cluster => ({
    ...cluster,
    position: clusterPositions.get(cluster.scheme)
  })).filter(d => d.position)

  // Calculate zoom-adjusted properties
  const getZoomAdjustedRadius = (baseRadius: number) => {
    // Scale radius inversely with zoom to maintain visual consistency
    return baseRadius / Math.sqrt(zoomScale)
  }

  const getZoomAdjustedOpacity = (baseOpacity: number) => {
    // Fade out clusters at high zoom levels to reduce visual clutter
    if (zoomScale > 2) {
      return baseOpacity * (3 - zoomScale) / 1 // Fade from zoom 2 to 3
    }
    return baseOpacity
  }

  const getZoomAdjustedStrokeWidth = (baseWidth: number) => {
    // Maintain consistent stroke width across zoom levels
    return baseWidth / zoomScale
  }

  // Render cluster background circles
  const clusterBgs = container.selectAll('.scheme-cluster-bg')
    .data(clusterData, (d: any) => d.scheme)

  clusterBgs.exit()
    .transition()
    .duration(300)
    .attr('r', 0)
    .style('opacity', 0)
    .remove()

  const clusterEnter = clusterBgs.enter()
    .append('circle')
    .attr('class', 'scheme-cluster-bg')
    .attr('r', 0)
    .style('opacity', 0)

  const clusterMerge = clusterEnter.merge(clusterBgs as any)

  clusterMerge
    .transition()
    .duration(300)
    .ease(d3.easeBackOut)
    .attr('cx', d => d.position!.x)
    .attr('cy', d => d.position!.y)
    .attr('r', d => getZoomAdjustedRadius(d.position!.radius))
    .attr('fill', d => d.color || '#666')
    .attr('fill-opacity', () => getZoomAdjustedOpacity(0.08))
    .attr('stroke', d => d.color || '#666')
    .attr('stroke-width', getZoomAdjustedStrokeWidth(2))
    .attr('stroke-opacity', () => getZoomAdjustedOpacity(0.25))
    .attr('stroke-dasharray', `${5 / zoomScale},${5 / zoomScale}`)
    .style('opacity', 1)
    .style('pointer-events', 'none')

  // Add hover effects for cluster circles
  clusterMerge
    .on('mouseenter', function() {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('fill-opacity', getZoomAdjustedOpacity(0.15))
        .attr('stroke-opacity', getZoomAdjustedOpacity(0.4))
        .attr('stroke-width', getZoomAdjustedStrokeWidth(3))
    })
    .on('mouseleave', function() {
      d3.select(this)
        .transition()
        .duration(300)
        .attr('fill-opacity', getZoomAdjustedOpacity(0.08))
        .attr('stroke-opacity', getZoomAdjustedOpacity(0.25))
        .attr('stroke-width', getZoomAdjustedStrokeWidth(2))
    })

  // Add cluster labels with zoom-aware sizing
  const clusterLabels = container.selectAll('.scheme-cluster-label')
    .data(clusterData, (d: any) => d.scheme)

  clusterLabels.exit()
    .transition()
    .duration(300)
    .style('opacity', 0)
    .remove()

  const labelEnter = clusterLabels.enter()
    .append('text')
    .attr('class', 'scheme-cluster-label')
    .style('opacity', 0)

  const labelMerge = labelEnter.merge(clusterLabels as any)

  // Calculate label visibility based on zoom level
  const labelVisible = zoomScale >= 0.5 && zoomScale <= 2.5
  const labelOpacity = labelVisible ? getZoomAdjustedOpacity(0.8) : 0

  labelMerge
    .transition()
    .duration(300)
    .attr('x', d => d.position!.x)
    .attr('y', d => d.position!.y - getZoomAdjustedRadius(d.position!.radius) - (10 / zoomScale))
    .attr('text-anchor', 'middle')
    .style('font-size', `${Math.max(9, 11 / zoomScale)}px`)
    .style('font-weight', '600')
    .style('fill', d => d.color || '#666')
    .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.7)')
    .style('pointer-events', 'none')
    .style('opacity', labelOpacity)
    .text(d => d.scheme)

  // Add pulsing animation for high-priority clusters
  clusterMerge
    .filter((d: any) => d.priority > 80) // High confidence clusters
    .style('animation', `cluster-pulse 2s ease-in-out infinite`)

  // Add CSS animation if not already present
  if (!document.querySelector('#cluster-animations')) {
    const style = document.createElement('style')
    style.id = 'cluster-animations'
    style.textContent = `
      @keyframes cluster-pulse {
        0%, 100% { 
          stroke-opacity: 0.25;
          fill-opacity: 0.08;
        }
        50% { 
          stroke-opacity: 0.4;
          fill-opacity: 0.15;
        }
      }
    `
    document.head.appendChild(style)
  }
}

/**
 * Enhanced edge rendering with scheme clustering
 */
export function renderClusteredEdges(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  edges: ArgumentEdge[],
  nodePositions: Map<string, { x: number; y: number }>,
  clusters: SchemeCluster[],
  showClustering: boolean = true
): void {
  const schemeToColor = new Map<string, string>()
  clusters.forEach(cluster => {
    schemeToColor.set(cluster.scheme, cluster.color || '#666')
  })

  const edgeSelection = g.selectAll('.clustered-edge')
    .data(edges, (d: any) => d.id || `${d.from}-${d.to}`)

  edgeSelection.exit().remove()

  const edgeEnter = edgeSelection.enter()
    .append('path')
    .attr('class', 'clustered-edge')

  const edgeMerge = edgeEnter.merge(edgeSelection as any)

  edgeMerge
    .attr('d', d => {
      const sourcePos = d.from ? nodePositions.get(d.from) : null
      const targetPos = d.to ? nodePositions.get(d.to) : null
      
      if (!sourcePos || !targetPos) return ''

      // Create curved path
      const dx = targetPos.x - sourcePos.x
      const dy = targetPos.y - sourcePos.y
      const dr = Math.sqrt(dx * dx + dy * dy) * 0.5

      return `M${sourcePos.x},${sourcePos.y}A${dr},${dr} 0 0,1 ${targetPos.x},${targetPos.y}`
    })
    .attr('fill', 'none')
    .attr('stroke', d => {
      if (showClustering && d.scheme) {
        return schemeToColor.get(d.scheme) || '#666'
      }
      // Default colors based on relationship type
      switch (d.relationshipType) {
        case 'support': return '#4CAF50'
        case 'attack': return '#F44336'
        case 'undercut': return '#FF9800'
        default: return '#666'
      }
    })
    .attr('stroke-width', d => showClustering && d.clustered ? 3 : 2)
    .attr('stroke-opacity', d => showClustering && d.clustered ? 0.8 : 0.6)
    .attr('stroke-dasharray', d => {
      if (d.relationshipType === 'attack') return '5,5'
      if (d.relationshipType === 'undercut') return '2,3'
      return 'none'
    })

  // Add scheme labels on edges if clustering is enabled
  if (showClustering) {
    const edgeLabels = g.selectAll('.edge-scheme-label')
      .data(edges.filter(d => d.clustered && d.clusterLabel), (d: any) => `${d.id || `${d.from}-${d.to}`}-label`)

    edgeLabels.exit().remove()

    const labelEnter = edgeLabels.enter()
      .append('text')
      .attr('class', 'edge-scheme-label')

    const labelMerge = labelEnter.merge(edgeLabels as any)

    labelMerge
      .attr('x', d => {
        const sourcePos = d.from ? nodePositions.get(d.from) : null
        const targetPos = d.to ? nodePositions.get(d.to) : null
        return sourcePos && targetPos ? (sourcePos.x + targetPos.x) / 2 : 0
      })
      .attr('y', d => {
        const sourcePos = d.from ? nodePositions.get(d.from) : null
        const targetPos = d.to ? nodePositions.get(d.to) : null
        return sourcePos && targetPos ? (sourcePos.y + targetPos.y) / 2 - 5 : 0
      })
      .attr('text-anchor', 'middle')
      .style('font-size', '9px')
      .style('font-weight', '500')
      .style('fill', d => schemeToColor.get(d.scheme || '') || '#666')
      .style('pointer-events', 'none')
      .text(d => d.scheme || '')
  } else {
    g.selectAll('.edge-scheme-label').remove()
  }
}
