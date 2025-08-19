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

  AutoMode as AutoModeIcon
} from '@mui/icons-material'
import { useZLFNNotes } from '../../hooks/useZLFNNotes'
import type { ZLFNNode } from '../../types/zlfn'

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
  }, [node, open, notesHook])

  // Handle text changes
  const handleNoteChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value
    setLocalNote(newValue)
    setHasUnsavedChanges(newValue !== notesHook.getNoteContent(node?.id || ''))
  }

  // Save note
  const handleSave = async () => {
    if (!node) return
    
    const success = await notesHook.saveNote(node.id, localNote)
    if (success) {
      setHasUnsavedChanges(false)
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
    if (event.ctrlKey || event.metaKey) {
      if (event.key === 's') {
        event.preventDefault()
        handleSave()
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
        }
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
          
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
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
        <TextField
          multiline
          rows={8}
          fullWidth
          value={localNote}
          onChange={handleNoteChange}
          onKeyDown={handleKeyDown}
          placeholder={`Add your notes for node "${node.id}"...\n\nTip: Use Ctrl+S to save quickly`}
          variant="outlined"
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
