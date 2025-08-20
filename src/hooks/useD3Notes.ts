/**
 * D3 Notes Integration Hook
 * Manages notes integration with D3.js graph visualization
 */

import { useCallback, useRef, useEffect } from 'react'
import * as d3 from 'd3'
import { createRoot } from 'react-dom/client'
import { NotesTooltip } from '../components/Notes/NotesTooltip'


interface UseD3NotesOptions {
  svgRef: React.RefObject<SVGSVGElement | null>
  nodes: any[] // Use any[] to be compatible with existing ZlfnNode type
  objectId: string
  onNoteEdit: (node: any) => void
  getNoteContent: (nodeId: string) => string
  hasNote: (nodeId: string) => boolean
}

interface NoteIndicator {
  nodeId: string
  x: number
  y: number
  hasNote: boolean
}

export function useD3Notes({
  svgRef,
  nodes,
  objectId: _objectId,
  onNoteEdit,
  getNoteContent,
  hasNote
}: UseD3NotesOptions) {
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const tooltipRootRef = useRef<any>(null)
  const noteIndicatorsRef = useRef<NoteIndicator[]>([])

  // Create tooltip container
  useEffect(() => {
    if (!tooltipRef.current) {
      const el = document.createElement('div')
      el.style.position = 'absolute'
      el.style.pointerEvents = 'none'
      el.style.zIndex = '9999'
      el.style.visibility = 'hidden'
      document.body.appendChild(el)
      tooltipRef.current = el
      // defer root creation until next microtask to avoid concurrent unmount warnings
      Promise.resolve().then(() => {
        if (tooltipRef.current && !tooltipRootRef.current) {
          tooltipRootRef.current = createRoot(tooltipRef.current)
        }
      })
    }

    return () => {
      // unmount root first, then detach element to avoid "synchronously unmount" warnings
      if (tooltipRootRef.current) {
        tooltipRootRef.current.unmount()
        tooltipRootRef.current = null
      }
      if (tooltipRef.current) {
        document.body.removeChild(tooltipRef.current)
        tooltipRef.current = null
      }
    }
  }, [])

  // Add note indicators to nodes
  const addNoteIndicators = useCallback(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    
    // Remove existing note indicators
    svg.selectAll('.note-indicator').remove()

    // Add note indicators for each node (attached to the node group so they inherit node transforms)
    nodes.forEach(node => {
      const nodeElement = svg.select(`#node-${node.id}`)
      if (nodeElement.empty()) return

      const nodeData = nodeElement.datum() as any
      if (!nodeData) return

      const hasNoteValue = hasNote(node.id)

      // Compute offset based on node size (circle vs rect)
      const computeOffset = (nd: any): [number, number] => {
        const padding = 6
        if (nd?.size && typeof nd.size === 'object') {
          if ('radius' in nd.size) {
            const r = Number(nd.size.radius || 16)
            return [r + padding, -r - padding]
          }
          const w = Number(nd.size.width || 100)
          const h = Number(nd.size.height || 30)
          return [w / 2 + padding, -h / 2 - padding]
        }
        // Fallback
        return [24, -24]
      }
      const [offX, offY] = computeOffset(nodeData)
      
      // Append indicator within the node group, similar to facet icons
      const indicator = nodeElement
        .append('g')
        .attr('class', 'note-indicator')
        .attr('data-node-id', node.id)
        .attr('transform', `translate(${offX},${offY})`)
        .style('cursor', 'pointer')

      // Note icon background
      indicator.append('circle')
        .attr('r', 6)
        .attr('fill', hasNoteValue ? '#ffc107' : 'rgba(255, 255, 255, 0.1)')
        .attr('stroke', hasNoteValue ? '#ff8f00' : 'rgba(255, 255, 255, 0.3)')
        .attr('stroke-width', 1.5)
        .style('filter', hasNoteValue ? 'drop-shadow(0 0 4px rgba(255, 193, 7, 0.6))' : 'none')

      // Note icon
      indicator.append('text')
        .attr('y', 2.5)
        .attr('text-anchor', 'middle')
        .attr('font-size', '8px')
        .attr('fill', hasNoteValue ? '#000' : '#666')
        .text('📝')

      // Add interaction handlers
      indicator
        .on('mouseenter', function(event) {
          showTooltip(event as any, node)
        })
        .on('mouseleave', function() {
          hideTooltip()
        })
        .on('click', function(event) {
          event.stopPropagation()
          onNoteEdit(node)
          hideTooltip()
        })

      // Store indicator position for updates (not strictly necessary when attached to node group)
      noteIndicatorsRef.current.push({
        nodeId: node.id,
        x: (nodeData.x ?? 0) + offX,
        y: (nodeData.y ?? 0) + offY,
        hasNote: hasNoteValue
      })
    })
  }, [svgRef, nodes, hasNote, onNoteEdit])

  // Update note indicator positions: since attached to node group with local transform, recompute offset to adapt to different sizes
  const updateNoteIndicators = useCallback(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    nodes.forEach(node => {
      const nodeElement = svg.select(`#node-${node.id}`)
      const indicator = nodeElement.select<SVGGElement>(`.note-indicator[data-node-id="${node.id}"]`)
      if (indicator.empty()) return
      const nd: any = nodeElement.datum() || {}
      const padding = 6
      let offX = 24, offY = -24
      if (nd?.size && typeof nd.size === 'object') {
        if ('radius' in nd.size) {
          const r = Number(nd.size.radius || 16)
          offX = r + padding
          offY = -r - padding
        } else {
          const w = Number(nd.size.width || 100)
          const h = Number(nd.size.height || 30)
          offX = w / 2 + padding
          offY = -h / 2 - padding
        }
      }
      indicator.attr('transform', `translate(${offX},${offY})`)
    })
  }, [svgRef, nodes])

  // Update note indicator appearance when notes change
  const updateNoteIndicator = useCallback((nodeId: string, hasNoteValue: boolean) => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    const indicator = svg.select(`.note-indicator[data-node-id="${nodeId}"]`)
    
    if (!indicator.empty()) {
      indicator.select('circle')
        .attr('fill', hasNoteValue ? '#ffc107' : 'rgba(255, 255, 255, 0.1)')
        .attr('stroke', hasNoteValue ? '#ff8f00' : 'rgba(255, 255, 255, 0.3)')
        .style('filter', hasNoteValue ? 'drop-shadow(0 0 4px rgba(255, 193, 7, 0.6))' : 'none')
      indicator.select('text').attr('fill', hasNoteValue ? '#000' : '#666')
      const storedIndicator = noteIndicatorsRef.current.find(i => i.nodeId === nodeId)
      if (storedIndicator) storedIndicator.hasNote = hasNoteValue
    }
  }, [svgRef])

  // Show tooltip
  const showTooltip = useCallback((event: MouseEvent, node: any) => {
    if (!tooltipRef.current || !tooltipRootRef.current) return

    const noteContent = getNoteContent(node.id)
    const hasNoteValue = hasNote(node.id)

    tooltipRootRef.current.render(
      NotesTooltip({
        nodeId: node.id,
        nodeName: node.name || '',
        noteContent,
        hasNote: hasNoteValue,
        onEdit: () => {
          onNoteEdit(node)
          hideTooltip()
        }
      })
    )

    const tooltip = tooltipRef.current
    tooltip.style.visibility = 'visible'
    tooltip.style.left = `${event.pageX + 10}px`
    tooltip.style.top = `${event.pageY - 10}px`
    tooltip.style.pointerEvents = 'auto'
  }, [getNoteContent, hasNote, onNoteEdit])

  // Hide tooltip
  const hideTooltip = useCallback(() => {
    if (tooltipRef.current) {
      tooltipRef.current.style.visibility = 'hidden'
      tooltipRef.current.style.pointerEvents = 'none'
    }
  }, [])

  // Remove all note indicators
  const removeNoteIndicators = useCallback(() => {
    if (!svgRef.current) return
    
    const svg = d3.select(svgRef.current)
    svg.selectAll('.note-indicator').remove()
    noteIndicatorsRef.current = []
  }, [svgRef])

  // Get note statistics
  const getNoteStats = useCallback(() => {
    const totalNodes = nodes.length
    const nodesWithNotes = nodes.filter(node => hasNote(node.id)).length
    const notesPercentage = totalNodes > 0 ? Math.round((nodesWithNotes / totalNodes) * 100) : 0

    return {
      totalNodes,
      nodesWithNotes,
      notesPercentage
    }
  }, [nodes, hasNote])

  return {
    addNoteIndicators,
    updateNoteIndicators,
    updateNoteIndicator,
    removeNoteIndicators,
    showTooltip,
    hideTooltip,
    getNoteStats
  }
}

export default useD3Notes
