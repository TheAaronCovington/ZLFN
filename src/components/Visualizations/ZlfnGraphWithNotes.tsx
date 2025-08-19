/**
 * ZLFN Graph with Notes Integration
 * Wrapper component that adds notes functionality to the existing ZlfnGraph
 */

import React, { useState, useCallback, useEffect } from 'react'
import { Box, Fab, Tooltip, Chip } from '@mui/material'
import { Note as NoteIcon, Notes as NotesIcon } from '@mui/icons-material'
import { ZlfnGraph, type ZlfnGraphProps } from './ZlfnGraph'
import { NotesDialog } from '../Notes/NotesDialog'
import { useZLFNNotes } from '../../hooks/useZLFNNotes'
import { useD3Notes } from '../../hooks/useD3Notes'
import { ZLFNProvider } from '../../context/ZLFNContext'
import type { ZLFNNode } from '../../types/zlfn'

interface ZlfnGraphWithNotesProps extends ZlfnGraphProps {
  objectId?: string
  showNotesIndicators?: boolean
  onNotesToggle?: (enabled: boolean) => void
}

export function ZlfnGraphWithNotes({
  objectId = 'default-graph',
  showNotesIndicators = true,
  onNotesToggle,
  ...graphProps
}: ZlfnGraphWithNotesProps) {
  const [selectedNode, setSelectedNode] = useState<ZLFNNode | null>(null)
  const [notesDialogOpen, setNotesDialogOpen] = useState(false)
  const [notesEnabled, setNotesEnabled] = useState(showNotesIndicators)
  const [_nodeNoteStates, setNodeNoteStates] = useState<Record<string, boolean>>({})

  // Notes hook for managing note data
  const notesHook = useZLFNNotes({
    objectId,
    autoSave: true,
    autoSaveDelay: 2000,
    onError: (error) => console.error('Notes error:', error),
    onSuccess: (message) => console.log('Notes success:', message)
  })

  // D3 notes integration hook
  const d3NotesHook = useD3Notes({
    svgRef: React.createRef(), // This will be passed to ZlfnGraph
    nodes: graphProps.nodes,
    objectId,
    onNoteEdit: handleNoteEdit,
    getNoteContent: notesHook.getNoteContent,
    hasNote: notesHook.hasNote
  })

  // Handle note editing
  function handleNoteEdit(node: ZLFNNode) {
    setSelectedNode(node)
    setNotesDialogOpen(true)
  }

  // Handle note changes
  const handleNoteChange = useCallback((nodeId: string, hasNote: boolean) => {
    setNodeNoteStates(prev => ({ ...prev, [nodeId]: hasNote }))
    d3NotesHook.updateNoteIndicator(nodeId, hasNote)
  }, [d3NotesHook])

  // Toggle notes indicators
  const handleNotesToggle = useCallback(() => {
    const newEnabled = !notesEnabled
    setNotesEnabled(newEnabled)
    onNotesToggle?.(newEnabled)
    
    if (newEnabled) {
      // Add indicators after a short delay to ensure DOM is ready
      setTimeout(() => {
        d3NotesHook.addNoteIndicators()
      }, 100)
    } else {
      d3NotesHook.removeNoteIndicators()
    }
  }, [notesEnabled, onNotesToggle, d3NotesHook])

  // Update note states when nodes change
  useEffect(() => {
    const newStates: Record<string, boolean> = {}
    graphProps.nodes.forEach(node => {
      newStates[node.id] = notesHook.hasNote(node.id)
    })
    setNodeNoteStates(newStates)
  }, [graphProps.nodes, notesHook])

  // Add note indicators when enabled and nodes are ready
  useEffect(() => {
    if (notesEnabled && graphProps.nodes.length > 0) {
      // Delay to ensure D3 has rendered the nodes
      const timer = setTimeout(() => {
        d3NotesHook.addNoteIndicators()
      }, 500)
      
      return () => clearTimeout(timer)
    }
  }, [notesEnabled, graphProps.nodes, d3NotesHook])

  // Get note statistics
  const noteStats = d3NotesHook.getNoteStats()

  return (
    <ZLFNProvider>
      <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* Main Graph Component */}
        <ZlfnGraph {...graphProps} />

        {/* Notes Controls */}
        <Box sx={{ 
          position: 'absolute', 
          top: 16, 
          right: 16, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 1,
          zIndex: 1000
        }}>
          {/* Notes Statistics */}
          {notesEnabled && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Chip
                icon={<NotesIcon />}
                label={`${noteStats.nodesWithNotes}/${noteStats.totalNodes} notes`}
                size="small"
                sx={{
                  bgcolor: 'rgba(255, 193, 7, 0.2)',
                  color: '#ffc107',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 193, 7, 0.3)'
                }}
              />
              {noteStats.notesPercentage > 0 && (
                <Chip
                  label={`${noteStats.notesPercentage}% coverage`}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(0, 230, 118, 0.2)',
                    color: '#00e676',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(0, 230, 118, 0.3)',
                    fontSize: '0.7rem'
                  }}
                />
              )}
            </Box>
          )}

          {/* Notes Toggle Button */}
          <Tooltip title={notesEnabled ? "Hide Notes" : "Show Notes"}>
            <Fab
              size="small"
              onClick={handleNotesToggle}
              sx={{
                bgcolor: notesEnabled ? 'rgba(255, 193, 7, 0.9)' : 'rgba(255, 255, 255, 0.1)',
                color: notesEnabled ? '#000' : '#ffc107',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 193, 7, 0.3)',
                '&:hover': {
                  bgcolor: notesEnabled ? '#ffc107' : 'rgba(255, 193, 7, 0.2)',
                  transform: 'scale(1.05)'
                },
                transition: 'all 0.2s ease-in-out'
              }}
            >
              <NoteIcon />
            </Fab>
          </Tooltip>
        </Box>

        {/* Notes Dialog */}
        <NotesDialog
          open={notesDialogOpen}
          onClose={() => {
            setNotesDialogOpen(false)
            setSelectedNode(null)
          }}
          node={selectedNode}
          objectId={objectId}
          onNoteChange={handleNoteChange}
        />

        {/* Instructions Overlay */}
        {notesEnabled && noteStats.nodesWithNotes === 0 && (
          <Box sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            p: 2,
            bgcolor: 'rgba(64, 196, 255, 0.1)',
            border: '1px solid rgba(64, 196, 255, 0.3)',
            borderRadius: 2,
            backdropFilter: 'blur(10px)',
            maxWidth: 300
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <NoteIcon sx={{ color: '#40c4ff', fontSize: 18 }} />
              <Box sx={{ color: '#40c4ff', fontWeight: 600, fontSize: '0.9rem' }}>
                Notes Feature Active
              </Box>
            </Box>
            <Box sx={{ color: '#b0bec5', fontSize: '0.8rem', lineHeight: 1.4 }}>
              Look for the 📝 icons next to nodes. Click them to add notes and enhance your analysis.
            </Box>
          </Box>
        )}
      </Box>
    </ZLFNProvider>
  )
}

export default ZlfnGraphWithNotes
