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
      tooltipRef.current = document.createElement('div')
      tooltipRef.current.style.position = 'absolute'
      tooltipRef.current.style.pointerEvents = 'none'
      tooltipRef.current.style.zIndex = '9999'
      tooltipRef.current.style.visibility = 'hidden'
      document.body.appendChild(tooltipRef.current)
      
      tooltipRootRef.current = createRoot(tooltipRef.current)
    }

    return () => {
      if (tooltipRef.current) {
        document.body.removeChild(tooltipRef.current)
        tooltipRef.current = null
      }
      if (tooltipRootRef.current) {
        tooltipRootRef.current.unmount()
        tooltipRootRef.current = null
      }
    }
  }, [])

  // Add note indicators to nodes
  const addNoteIndicators = useCallback(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    
    // Remove existing note indicators
    svg.selectAll('.note-indicator').remove()

    // Add note indicators for each node
    nodes.forEach(node => {
      const nodeElement = svg.select(`#node-${node.id}`)
      if (nodeElement.empty()) return

      const nodeData = nodeElement.datum() as any
      if (!nodeData || typeof nodeData.x !== 'number' || typeof nodeData.y !== 'number') return

      const hasNoteValue = hasNote(node.id)
      
      // Create note indicator group
      const indicator = svg.append('g')
        .attr('class', 'note-indicator')
        .attr('data-node-id', node.id)
        .attr('transform', `translate(${nodeData.x}, ${nodeData.y})`)
        .style('cursor', 'pointer')

      // Note icon background
      indicator.append('circle')
        .attr('cx', 25)
        .attr('cy', -25)
        .attr('r', 8)
        .attr('fill', hasNoteValue ? '#ffc107' : 'rgba(255, 255, 255, 0.1)')
        .attr('stroke', hasNoteValue ? '#ff8f00' : 'rgba(255, 255, 255, 0.3)')
        .attr('stroke-width', 1.5)
        .style('filter', hasNoteValue ? 'drop-shadow(0 0 4px rgba(255, 193, 7, 0.6))' : 'none')

      // Note icon
      indicator.append('text')
        .attr('x', 25)
        .attr('y', -21)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Material Icons')
        .attr('font-size', '10px')
        .attr('fill', hasNoteValue ? '#000' : '#666')
        .text('📝')

      // Add interaction handlers
      indicator
        .on('mouseenter', function(event) {
          showTooltip(event, node)
        })
        .on('mouseleave', function() {
          hideTooltip()
        })
        .on('click', function(event) {
          event.stopPropagation()
          onNoteEdit(node)
          hideTooltip()
        })

      // Store indicator position for updates
      noteIndicatorsRef.current.push({
        nodeId: node.id,
        x: nodeData.x + 25,
        y: nodeData.y - 25,
        hasNote: hasNoteValue
      })
    })
  }, [svgRef, nodes, hasNote, onNoteEdit])

  // Update note indicator positions
  const updateNoteIndicators = useCallback(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    
    nodes.forEach(node => {
      const nodeElement = svg.select(`#node-${node.id}`)
      const indicator = svg.select(`.note-indicator[data-node-id="${node.id}"]`)
      
      if (!nodeElement.empty() && !indicator.empty()) {
        const nodeData = nodeElement.datum() as any
        if (nodeData && typeof nodeData.x === 'number' && typeof nodeData.y === 'number') {
          indicator.attr('transform', `translate(${nodeData.x}, ${nodeData.y})`)
          
          // Update stored position
          const storedIndicator = noteIndicatorsRef.current.find(i => i.nodeId === node.id)
          if (storedIndicator) {
            storedIndicator.x = nodeData.x + 25
            storedIndicator.y = nodeData.y - 25
          }
        }
      }
    })
  }, [svgRef, nodes])

  // Update note indicator appearance when notes change
  const updateNoteIndicator = useCallback((nodeId: string, hasNoteValue: boolean) => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    const indicator = svg.select(`.note-indicator[data-node-id="${nodeId}"]`)
    
    if (!indicator.empty()) {
      // Update circle appearance
      indicator.select('circle')
        .attr('fill', hasNoteValue ? '#ffc107' : 'rgba(255, 255, 255, 0.1)')
        .attr('stroke', hasNoteValue ? '#ff8f00' : 'rgba(255, 255, 255, 0.3)')
        .style('filter', hasNoteValue ? 'drop-shadow(0 0 4px rgba(255, 193, 7, 0.6))' : 'none')

      // Update icon color
      indicator.select('text')
        .attr('fill', hasNoteValue ? '#000' : '#666')

      // Update stored state
      const storedIndicator = noteIndicatorsRef.current.find(i => i.nodeId === nodeId)
      if (storedIndicator) {
        storedIndicator.hasNote = hasNoteValue
      }
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
