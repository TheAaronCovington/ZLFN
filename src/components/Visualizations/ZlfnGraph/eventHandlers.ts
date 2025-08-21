/**
 * Event Handlers for ZlfnGraph
 * Handles mouse, keyboard, drag, and zoom interactions
 */

import * as d3 from 'd3'
import type { ZlfnNode, ZlfnEdge, GraphRefs, GraphCallbacks, InteractionConfig } from './types'

export interface EventHandlerConfig {
  refs: GraphRefs
  callbacks: GraphCallbacks
  config: InteractionConfig
  state: {
    selectedNodeId: string | null
    setSelectedNodeId: (id: string | null) => void
    setTooltip: (tooltip: { x: number; y: number; html: string } | null) => void
    setPinnedIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void
    setSelectedEdgeIndex: (index: number | null) => void
  }
  storageKey?: string
}

/**
 * Sets up drag behavior for nodes
 */
export function createDragBehavior(
  config: EventHandlerConfig,
  _nodes: ZlfnNode[]
): d3.DragBehavior<SVGGElement, any, any> {
  const { refs, callbacks, state, storageKey } = config

  return d3.drag<SVGGElement, any>()
    .on('start', function(event, d) {
      if (!event.active && refs.simulation.current) {
        refs.simulation.current.alphaTarget(0.3).restart()
      }
      
      d.fx = d.x
      d.fy = d.y
      
      // Clear tooltip on drag start
      state.setTooltip(null)
      
      // Update selection
      state.setSelectedNodeId(d.id)
      if (storageKey) {
        try {
          localStorage.setItem(`xv_selected_${storageKey}`, d.id)
        } catch {}
      }
    })
    .on('drag', function(event, d) {
      d.fx = event.x
      d.fy = event.y
    })
    .on('end', function(event, d) {
      if (!event.active && refs.simulation.current) {
        refs.simulation.current.alphaTarget(0)
      }
      
      // Keep node pinned if it was dragged significantly
      const dragDistance = Math.sqrt(
        Math.pow(event.x - d.x, 2) + Math.pow(event.y - d.y, 2)
      )
      
      if (dragDistance > 10) {
        // Pin the node
        state.setPinnedIds(prev => new Set(prev).add(d.id))
        
        // Save pinned state
        if (storageKey) {
          try {
            state.setPinnedIds(prev => {
              const newPinned = new Set(prev).add(d.id)
              localStorage.setItem(
                `xv_pins_layout_${storageKey}`, 
                JSON.stringify(Array.from(newPinned))
              )
              return newPinned
            })
          } catch {}
        }
        
        callbacks.onInfo?.(`Pinned ${d.name || d.symbol || d.id}`, 'info')
      } else {
        // Release pin if not dragged far
        d.fx = null
        d.fy = null
      }
    })
}

/**
 * Sets up zoom behavior for the SVG
 */
export function createZoomBehavior(
  config: EventHandlerConfig
): d3.ZoomBehavior<SVGSVGElement, unknown> {
  const { refs } = config

  return d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 4])
    .on('zoom', function(event) {
      if (refs.g.current) {
        refs.g.current.setAttribute('transform', event.transform.toString())
      }
      
      // Update transform reference
      if (refs.transform.current) {
        refs.transform.current = event.transform
      }
      
      // Update minimap if present
      updateMinimap(config, event.transform)
    })
}

/**
 * Sets up mouse event handlers for nodes
 */
export function setupNodeMouseEvents(
  nodeSelection: d3.Selection<SVGGElement, any, any, any>,
  config: EventHandlerConfig
) {
  const { callbacks, state } = config

  nodeSelection
    .on('mouseenter', function(event, d) {
      // Show tooltip
      const tooltip = createNodeTooltip(d)
      
      state.setTooltip({
        x: event.pageX + 10,
        y: event.pageY - 10,
        html: tooltip
      })
      
      // Highlight connected edges
      highlightConnectedElements(d, true)
    })
    .on('mouseleave', function(_event, d) {
      // Hide tooltip
      state.setTooltip(null)
      
      // Remove highlights
      highlightConnectedElements(d, false)
    })
    .on('click', function(event, d) {
      event.stopPropagation()
      
      // Handle different click types
      if (event.ctrlKey || event.metaKey) {
        // Ctrl+click: toggle pin
        toggleNodePin(d, config)
      } else if (event.shiftKey) {
        // Shift+click: open truth table if available
        if (d.symbol && callbacks.onOpenTruthTable) {
          callbacks.onOpenTruthTable(d.symbol)
        }
      } else {
        // Regular click: select node
        selectNode(d, config)
      }
    })
    .on('dblclick', function(event, d) {
      event.stopPropagation()
      
      // Double-click: center on node
      centerOnNode(d, config)
    })
}

/**
 * Sets up mouse event handlers for edges
 */
export function setupEdgeMouseEvents(
  edgeSelection: d3.Selection<SVGPathElement, any, any, any>,
  config: EventHandlerConfig,
  edges: ZlfnEdge[]
) {
  const { callbacks, state } = config

  edgeSelection
    .on('mouseenter', function(event, d) {
      const tooltip = createEdgeTooltip(d)
      
      state.setTooltip({
        x: event.pageX + 10,
        y: event.pageY - 10,
        html: tooltip
      })
    })
    .on('mouseleave', function() {
      state.setTooltip(null)
    })
    .on('click', function(event, d) {
      event.stopPropagation()
      
      const edgeIndex = edges.findIndex(e => e === d)
      state.setSelectedEdgeIndex(edgeIndex)
      
      if (callbacks.onEdgeSelect) {
        callbacks.onEdgeSelect(d)
      }
    })
}

/**
 * Creates tooltip content for a node
 */
function createNodeTooltip(node: any): string {
  const parts: string[] = []
  
  if (node.name) parts.push(`<strong>${node.name}</strong>`)
  if (node.symbol && node.symbol !== node.name) parts.push(`Symbol: ${node.symbol}`)
  if (node.translation) parts.push(`Translation: ${node.translation}`)
  if (node.type) parts.push(`Type: ${node.type}`)
  if (node.argumentId) parts.push(`Argument: ${node.argumentId}`)
  
  return parts.join('<br>')
}

/**
 * Creates tooltip content for an edge
 */
function createEdgeTooltip(edge: any): string {
  const parts: string[] = []
  
  const source = typeof edge.source === 'object' ? edge.source.id : edge.source || edge.from
  const target = typeof edge.target === 'object' ? edge.target.id : edge.target || edge.to
  
  parts.push(`<strong>${source} → ${target}</strong>`)
  
  if (edge.rule) parts.push(`Rule: ${edge.rule}`)
  if (edge.weight !== undefined) parts.push(`Weight: ${edge.weight}`)
  if (edge.type) parts.push(`Type: ${edge.type}`)
  
  return parts.join('<br>')
}

/**
 * Highlights elements connected to a node
 */
function highlightConnectedElements(node: any, highlight: boolean) {
  const opacity = highlight ? 0.3 : 1
  
  // Dim all other elements
  d3.selectAll('.node')
    .filter((d: any) => d.id !== node.id)
    .style('opacity', opacity)
    
  d3.selectAll('.edge')
    .filter((d: any) => {
      const source = typeof d.source === 'object' ? d.source.id : d.source || d.from
      const target = typeof d.target === 'object' ? d.target.id : d.target || d.to
      return source !== node.id && target !== node.id
    })
    .style('opacity', opacity)
}

/**
 * Toggles pin state for a node
 */
function toggleNodePin(node: any, config: EventHandlerConfig) {
  const { state, callbacks, storageKey } = config
  
  state.setPinnedIds(prev => {
    const newSet = new Set(prev)
    if (newSet.has(node.id)) {
      newSet.delete(node.id)
      node.fx = null
      node.fy = null
      callbacks.onInfo?.(`Unpinned ${node.name || node.symbol || node.id}`, 'info')
    } else {
      newSet.add(node.id)
      node.fx = node.x
      node.fy = node.y
      callbacks.onInfo?.(`Pinned ${node.name || node.symbol || node.id}`, 'info')
    }
    
    // Save to localStorage
    if (storageKey) {
      try {
        localStorage.setItem(
          `xv_pins_layout_${storageKey}`,
          JSON.stringify(Array.from(newSet))
        )
      } catch {}
    }
    
    return newSet
  })
}

/**
 * Selects a node and updates UI state
 */
function selectNode(node: any, config: EventHandlerConfig) {
  const { state, callbacks, storageKey } = config
  
  state.setSelectedNodeId(node.id)
  
  if (storageKey) {
    try {
      localStorage.setItem(`xv_selected_${storageKey}`, node.id)
    } catch {}
  }
  
  callbacks.onInfo?.(`Selected ${node.name || node.symbol || node.id}`, 'info')
}

/**
 * Centers the view on a specific node
 */
function centerOnNode(node: any, config: EventHandlerConfig) {
  const { refs, callbacks } = config
  
  if (!refs.svg.current || !refs.zoom.current) return
  
  const transform = d3.zoomTransform(refs.svg.current)
  const k = transform.k
  const centerX = refs.svg.current.clientWidth / 2
  const centerY = refs.svg.current.clientHeight / 2
  
  const newTransform = d3.zoomIdentity
    .translate(centerX - node.x * k, centerY - node.y * k)
    .scale(k)
  
  d3.select(refs.svg.current)
    .transition()
    .duration(750)
    .call(refs.zoom.current.transform, newTransform)
  
  callbacks.onInfo?.(`Centered on ${node.name || node.symbol || node.id}`, 'success')
}

/**
 * Updates minimap display
 */
function updateMinimap(config: EventHandlerConfig, transform: d3.ZoomTransform) {
  const { refs } = config
  
  if (!refs.miniMap.current) return
  
  // Update minimap viewport indicator
  const minimap = d3.select(refs.miniMap.current)
  const viewport = minimap.select('.minimap-viewport')
  
  if (!viewport.empty()) {
    const scale = 0.1 // Minimap scale factor
    const x = -transform.x * scale / transform.k
    const y = -transform.y * scale / transform.k
    const width = (refs.svg.current?.clientWidth || 800) * scale / transform.k
    const height = (refs.svg.current?.clientHeight || 600) * scale / transform.k
    
    viewport
      .attr('x', x)
      .attr('y', y)
      .attr('width', width)
      .attr('height', height)
  }
}

/**
 * Sets up canvas click handler for deselection
 */
export function setupCanvasClickHandler(config: EventHandlerConfig) {
  const { refs, state, storageKey } = config
  
  if (refs.svg.current) {
    d3.select(refs.svg.current).on('click', function(event) {
      // Only deselect if clicking on empty space
      if (event.target === this || event.target === refs.g.current) {
        state.setSelectedNodeId(null)
        state.setSelectedEdgeIndex(null)
        
        if (storageKey) {
          try {
            localStorage.removeItem(`xv_selected_${storageKey}`)
          } catch {}
        }
      }
    })
  }
}
