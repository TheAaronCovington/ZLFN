/**
 * Notes Dialog Component
 * Modal dialog for editing node notes with auto-save and rich features
 */

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  LinearProgress
} from '@mui/material'
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  AutoMode as AutoModeIcon,
  Visibility as PreviewIcon,
  Edit as EditIcon
} from '@mui/icons-material'
import { useZLFNNotes } from '../../hooks/useZLFNNotes'
import type { ZLFNNode } from '../../types/zlfn'
import MarkdownPreview from '../MarkdownPreview/MarkdownPreview'

interface NotesDialogProps {
  open: boolean
  onClose: () => void
  node: ZLFNNode | null
  objectId: string
  onNoteChange?: (nodeId: string, hasNote: boolean) => void
}

export function NotesDialog({ 
  open, 
  onClose, 
  node, 
  objectId, 
  onNoteChange 
}: NotesDialogProps) {
  const [localNote, setLocalNote] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [useMarkdownPreview, setUseMarkdownPreview] = useState<boolean>(() => {
    try {
      return localStorage.getItem('xv_notes_markdown_preview') === '1'
    } catch {
      return false
    }
  })

  const notesHook = useZLFNNotes({
    objectId,
    autoSave: false, // Manual save for better UX in dialog
    onError: (error) => console.error('Notes error:', error),
    onSuccess: (message) => {
      console.log('Notes success:', message)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)
      setHasUnsavedChanges(false)
      onNoteChange?.(node?.id || '', localNote.trim().length > 0)
    }
  })

  // Load note when node changes
  useEffect(() => {
    if (node && open) {
      const noteContent = notesHook.getNoteContent(node.id)
      setLocalNote(noteContent)
      setHasUnsavedChanges(false)

    }
  }, [open, node?.id])

  // Global debug loggers while dialog is open
  useEffect(() => {
    if (!open) return
    // Removed excessive debug logging - no event listeners needed
  }, [open])

  // Persist markdown preview setting
  useEffect(() => {
    try {
      localStorage.setItem('xv_notes_markdown_preview', useMarkdownPreview ? '1' : '0')
    } catch {}
  }, [useMarkdownPreview])

  // Handle text changes (for regular TextField)
  const handleNoteChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value

    setLocalNote(newValue)
    setHasUnsavedChanges(newValue !== notesHook.getNoteContent(node?.id || ''))
  }

  // Handle text changes (for MarkdownPreview component)
  const handleMarkdownChange = (newValue: string) => {

    setLocalNote(newValue)
    setHasUnsavedChanges(newValue !== notesHook.getNoteContent(node?.id || ''))
  }

  // Toggle markdown preview mode
  const toggleMarkdownPreview = () => {
    setUseMarkdownPreview(!useMarkdownPreview)
  }

  // Save note
  const handleSave = async () => {
    if (!node) return
    
    const success = await notesHook.saveNote(node.id, localNote)
    if (success) {
      setHasUnsavedChanges(false)
      // Create a snapshot on successful note save for version history
      try {
        const { api } = await import('../../services/zlfnAPI')
        await api.createSnapshot(objectId, `Saved note for ${node.id}`, 'modified')
      } catch {}
      // Force local mirror so tooltip shows immediately
      try {
        const raw = localStorage.getItem(`zlfn_notes_${objectId}`) || '{}'
        const notes = JSON.parse(raw)
        notes[node.id] = localNote
        localStorage.setItem(`zlfn_notes_${objectId}`, JSON.stringify(notes))
      } catch {}
    }
  }

  // Delete note
  const handleDelete = async () => {
    if (!node) return
    
    const success = await notesHook.deleteNote(node.id)
    if (success) {
      setLocalNote('')
      setHasUnsavedChanges(false)
      onNoteChange?.(node.id, false)
    }
  }

  // Handle close with unsaved changes
  const handleClose = () => {
    if (hasUnsavedChanges) {
      const confirmClose = window.confirm('You have unsaved changes. Are you sure you want to close?')
      if (!confirmClose) return
    }
    
    setLocalNote('')
    setHasUnsavedChanges(false)
    onClose()
  }

  // Keyboard shortcuts
  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Never let graph-level listeners consume keys from the editor

    event.stopPropagation()
    if (event.ctrlKey || event.metaKey) {
      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        handleSave()
      } else if (event.key === 'z') {
        event.preventDefault()
        notesHook.undo()
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault()
        notesHook.redo()
      } else if (event.key === 'Enter') {
        event.preventDefault()
        handleSave()
      }
    }
  }

  if (!node) return null

  const hasExistingNote = notesHook.hasNote(node.id)
  const characterCount = localNote.length
  const wordCount = localNote.trim().split(/\s+/).filter(word => word.length > 0).length

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'rgba(30, 30, 30, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(64, 196, 255, 0.3)',
          borderRadius: 2
        },
        'data-notes-dialog': true as any
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        pb: 1,
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ color: '#40c4ff' }}>
            Notes for Node
          </Typography>
          <Chip 
            label={node.id} 
            size="small" 
            sx={{ 
              bgcolor: 'rgba(64, 196, 255, 0.2)', 
              color: '#40c4ff',
              fontFamily: 'monospace'
            }} 
          />
          {hasExistingNote && (
            <Chip 
              label="Has Note" 
              size="small" 
              color="success"
              sx={{ fontSize: '0.7rem' }}
            />
          )}
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {notesHook.isDirty && (
            <Tooltip title="Auto-save disabled in dialog">
              <AutoModeIcon sx={{ color: '#ffc107', fontSize: 20 }} />
            </Tooltip>
          )}

          <Tooltip title="Undo (Ctrl+Z)">
            <span>
              <IconButton size="small" onClick={() => notesHook.undo()} disabled={!notesHook.canUndo()}>
                <UndoIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo (Ctrl+Y)">
            <span>
              <IconButton size="small" onClick={() => notesHook.redo()} disabled={!notesHook.canRedo()}>
                <RedoIcon />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title={`${useMarkdownPreview ? 'Switch to plain text editor' : 'Enable markdown preview'}`}>
            <IconButton 
              onClick={toggleMarkdownPreview}
              size="small"
              sx={{ color: useMarkdownPreview ? '#40c4ff' : 'rgba(255,255,255,0.7)' }}
            >
              {useMarkdownPreview ? <EditIcon /> : <PreviewIcon />}
            </IconButton>
          </Tooltip>
          
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }} onKeyDown={(e)=>{ e.stopPropagation() }}>
        {/* Debug trap to assert focus is inside dialog */}
        <Box sx={{ display: 'none' }} data-notes-debug={JSON.stringify({
          activeTag: typeof document !== 'undefined' ? (document.activeElement as any)?.tagName : 'NA',
          activeId: typeof document !== 'undefined' ? (document.activeElement as any)?.id || null : null
        })} />
        {/* Node Information */}
        <Box sx={{ mb: 2, p: 2, bgcolor: 'rgba(64, 196, 255, 0.1)', borderRadius: 1 }}>
          <Typography variant="subtitle2" sx={{ color: '#40c4ff', mb: 1 }}>
            Node Information
          </Typography>
          <Typography variant="body2" sx={{ color: '#e0e0e0', mb: 0.5 }}>
            <strong>Name:</strong> {node.name || 'Unnamed'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#e0e0e0', mb: 0.5 }}>
            <strong>Type:</strong> {node.type}
          </Typography>
          {node.symbolic && (
            <Typography variant="body2" sx={{ color: '#e0e0e0', fontFamily: 'monospace' }}>
              <strong>Expression:</strong> {node.symbolic}
            </Typography>
          )}
        </Box>

        {/* Success Alert */}
        {showSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Note saved successfully!
          </Alert>
        )}

        {/* Note Editor */}
        {useMarkdownPreview ? (
          <MarkdownPreview
            value={localNote}
            onChange={handleMarkdownChange}
            placeholder={`Add your notes for node "${node.id}"...\n\nTip: Use Ctrl+S to save quickly\nMarkdown preview is enabled - you can use **bold**, *italic*, and other markdown syntax.`}
            height={300}
            showToolbar={true}
            enableSync={true}
            className="notes-markdown-editor"
          />
        ) : (
          <TextField
            id="notes-textarea"
            multiline
            rows={8}
            fullWidth
            autoFocus
            disabled={false}
            value={localNote}
            onChange={handleNoteChange}
            onKeyDown={handleKeyDown}
            onKeyUp={(e)=> { e.stopPropagation()}}
            onKeyPress={(e)=> { e.stopPropagation()}}
            placeholder={`Add your notes for node "${node.id}"...\n\nTip: Use Ctrl+S to save quickly\nClick the preview icon to enable markdown preview.`}
            variant="outlined"
            inputProps={{ readOnly: false, 'data-notes-input': '1', tabIndex: 0 }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(64, 196, 255, 0.5)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#40c4ff',
                },
              },
              '& .MuiInputBase-input': {
                color: '#e0e0e0',
                fontFamily: 'inherit',
                fontSize: '0.95rem',
                lineHeight: 1.6
              }
            }}
          />
        )}

        {/* Statistics */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mt: 1,
          pt: 1,
          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Typography variant="caption" sx={{ color: '#b0bec5' }}>
              {characterCount} characters
            </Typography>
            <Typography variant="caption" sx={{ color: '#b0bec5' }}>
              {wordCount} words
            </Typography>
          </Box>
          
          {hasUnsavedChanges && (
            <Chip 
              label="Unsaved Changes" 
              size="small" 
              color="warning"
              sx={{ fontSize: '0.7rem' }}
            />
          )}
        </Box>

        {/* Loading indicator */}
        {notesHook.isLoading && (
          <LinearProgress sx={{ mt: 1 }} />
        )}
      </DialogContent>

      <DialogActions sx={{ 
        px: 3, 
        pb: 2,
        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <Box sx={{ display: 'flex', gap: 1, width: '100%', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {hasExistingNote && (
              <Button
                onClick={handleDelete}
                startIcon={<DeleteIcon />}
                color="error"
                variant="outlined"
                size="small"
              >
                Delete Note
              </Button>
            )}
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              onClick={handleClose}
              variant="outlined"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              startIcon={<SaveIcon />}
              variant="contained"
              disabled={!hasUnsavedChanges || notesHook.isLoading}
              sx={{
                bgcolor: hasUnsavedChanges ? '#40c4ff' : undefined,
                '&:hover': {
                  bgcolor: hasUnsavedChanges ? '#1976d2' : undefined
                }
              }}
            >
              {notesHook.isLoading ? 'Saving...' : 'Save Note'}
            </Button>
          </Box>
        </Box>
      </DialogActions>
    </Dialog>
  )
}

export default NotesDialog
