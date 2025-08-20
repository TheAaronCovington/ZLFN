/**
 * ZLFN Notes Hook
 * React hook for managing notes functionality with tooltips and persistence
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../services/zlfnAPI'
import type { NotesState } from '../types/zlfn'

interface UseZLFNNotesOptions {
  objectId: string
  autoSave?: boolean
  autoSaveDelay?: number
  onError?: (error: string) => void
  onSuccess?: (message: string) => void
}

interface UseZLFNNotesReturn {
  // State
  notes: Record<string, string>
  selectedNoteId: string | null
  isEditing: boolean
  isDirty: boolean
  isLoading: boolean
  
  // Actions
  openNote: (nodeId: string) => void
  closeNote: () => void
  updateNote: (nodeId: string, content: string) => void
  saveNote: (nodeId: string, content?: string) => Promise<boolean>
  deleteNote: (nodeId: string) => Promise<boolean>
  undo: () => boolean
  redo: () => boolean
  
  // Utilities
  getNoteContent: (nodeId: string) => string
  hasNote: (nodeId: string) => boolean
  getNotesCount: () => number
  canUndo: () => boolean
  canRedo: () => boolean
  
  // Auto-save control
  enableAutoSave: () => void
  disableAutoSave: () => void
  
  // Bulk operations
  saveAllNotes: () => Promise<boolean>
  clearAllNotes: () => Promise<boolean>
}

export function useZLFNNotes(options: UseZLFNNotesOptions): UseZLFNNotesReturn {
  const {
    objectId,
    autoSave = true,
    autoSaveDelay = 2000,
    onError,
    onSuccess
  } = options

  // State
  const [notesState, setNotesState] = useState<NotesState>({
    notes: {},
    selectedNoteId: null,
    isEditing: false,
    isDirty: false
  })
  
  const [isLoading, setIsLoading] = useState(false)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(autoSave)
  
  // Refs for auto-save
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const pendingChangesRef = useRef<Map<string, string>>(new Map())
  // History ring per node
  const historyRef = useRef<Map<string, { entries: string[]; index: number }>>(new Map())

  // Load initial notes when objectId changes
  useEffect(() => {
    if (objectId) {
      loadNotes()
    }
  }, [objectId])

  // Auto-save effect
  useEffect(() => {
    if (autoSaveEnabled && notesState.isDirty) {
      // Clear existing timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }

      // Set new timeout
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveAllPendingChanges()
      }, autoSaveDelay)
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [notesState.isDirty, autoSaveEnabled, autoSaveDelay])

  // Load notes from API with localStorage fallback
  const loadNotes = useCallback(async () => {
    if (!objectId) return

    setIsLoading(true)
    try {
      const response = await api.getObject(objectId)
      if (response.success && response.data) {
        const incoming = response.data?.notes || {}
        setNotesState(prev => ({
          ...prev,
          notes: incoming
        }))
        // Mirror to localStorage to persist across reloads in mock mode
        try {
          localStorage.setItem(`zlfn_notes_${objectId}`, JSON.stringify(incoming))
        } catch {}
      } else {
        // Fallback to localStorage
        try {
          const raw = localStorage.getItem(`zlfn_notes_${objectId}`) || '{}'
          const notes = JSON.parse(raw)
          setNotesState(prev => ({ ...prev, notes }))
        } catch {
          onError?.(response.error || 'Failed to load notes')
        }
      }
    } catch (error) {
      try {
        const raw = localStorage.getItem(`zlfn_notes_${objectId}`) || '{}'
        const notes = JSON.parse(raw)
        setNotesState(prev => ({ ...prev, notes }))
      } catch {
        onError?.(error instanceof Error ? error.message : 'Failed to load notes')
      }
    } finally {
      setIsLoading(false)
    }
  }, [objectId, onError])

  // Open note for editing
  const openNote = useCallback((nodeId: string) => {
    setNotesState(prev => ({
      ...prev,
      selectedNoteId: nodeId,
      isEditing: true
    }))
    // Initialize history with current value for this node
    const current = notesState.notes[nodeId] || ''
    const h = historyRef.current.get(nodeId)
    if (!h) {
      historyRef.current.set(nodeId, { entries: [current], index: 0 })
    }
  }, [])

  // Close note editor
  const closeNote = useCallback(() => {
    setNotesState(prev => ({
      ...prev,
      selectedNoteId: null,
      isEditing: false
    }))
  }, [])

  // Update note content (local state only)
  const updateNote = useCallback((nodeId: string, content: string) => {
    setNotesState(prev => {
      const updated = {
        ...prev,
        notes: {
          ...prev.notes,
          [nodeId]: content
        },
        isDirty: true
      }
      return updated
    })

    // Track pending changes for auto-save
    pendingChangesRef.current.set(nodeId, content)

    // Record history (avoid duplicate consecutive entries)
    const h = historyRef.current.get(nodeId)
    const current = h?.entries[h.index] ?? ''
    if (!h) {
      historyRef.current.set(nodeId, { entries: [content], index: 0 })
    } else if (content !== current) {
      // Truncate forward history then push
      h.entries = h.entries.slice(0, h.index + 1)
      h.entries.push(content)
      // Limit history size per node
      if (h.entries.length > 100) h.entries.shift()
      h.index = h.entries.length - 1
      historyRef.current.set(nodeId, h)
    }
  }, [])

  // Save specific note to API with localStorage fallback
  const saveNote = useCallback(async (nodeId: string, content?: string): Promise<boolean> => {
    const noteContent = content ?? notesState.notes[nodeId] ?? ''
    
    try {
      const response = await api.saveNote(objectId, nodeId, noteContent)
      
      if (response.success) {
        // Remove from pending changes
        pendingChangesRef.current.delete(nodeId)
        
        // Update state to reflect save
        setNotesState(prev => ({
          ...prev,
          notes: { ...prev.notes, [nodeId]: noteContent },
          isDirty: pendingChangesRef.current.size > 0
        }))
        // Mirror to localStorage for tooltip and reload persistence
        try {
          const raw = localStorage.getItem(`zlfn_notes_${objectId}`) || '{}'
          const notes = JSON.parse(raw)
          notes[nodeId] = noteContent
          localStorage.setItem(`zlfn_notes_${objectId}`, JSON.stringify(notes))
        } catch {}
        
        onSuccess?.(`Note saved for node ${nodeId}`)
        return true
      } else {
        // Fallback to localStorage
        try {
          const raw = localStorage.getItem(`zlfn_notes_${objectId}`) || '{}'
          const notes = JSON.parse(raw)
          notes[nodeId] = noteContent
          localStorage.setItem(`zlfn_notes_${objectId}`, JSON.stringify(notes))
          onSuccess?.(`Note saved locally for node ${nodeId}`)
          return true
        } catch {
          onError?.(response.error || 'Failed to save note')
          return false
        }
      }
    } catch (error) {
      // Fallback to localStorage
      try {
        const raw = localStorage.getItem(`zlfn_notes_${objectId}`) || '{}'
        const notes = JSON.parse(raw)
        notes[nodeId] = noteContent
        localStorage.setItem(`zlfn_notes_${objectId}`, JSON.stringify(notes))
        onSuccess?.(`Note saved locally for node ${nodeId}`)
        return true
      } catch {
        onError?.(error instanceof Error ? error.message : 'Failed to save note')
        return false
      }
    }
  }, [objectId, notesState.notes, onError, onSuccess])

  // Delete note with localStorage fallback
  const deleteNote = useCallback(async (nodeId: string): Promise<boolean> => {
    try {
      const response = await api.deleteNote(objectId, nodeId)
      
      if (response.success) {
        setNotesState(prev => {
          const newNotes = { ...prev.notes }
          delete newNotes[nodeId]
          
          return {
            ...prev,
            notes: newNotes,
            selectedNoteId: prev.selectedNoteId === nodeId ? null : prev.selectedNoteId,
            isEditing: prev.selectedNoteId === nodeId ? false : prev.isEditing
          }
        })
        
        // Remove from pending changes
        pendingChangesRef.current.delete(nodeId)
        // Mirror deletion locally
        try {
          const raw = localStorage.getItem(`zlfn_notes_${objectId}`) || '{}'
          const notes = JSON.parse(raw)
          delete notes[nodeId]
          localStorage.setItem(`zlfn_notes_${objectId}`, JSON.stringify(notes))
        } catch {}
        
        onSuccess?.(`Note deleted for node ${nodeId}`)
        return true
      } else {
        // Fallback to localStorage
        try {
          const raw = localStorage.getItem(`zlfn_notes_${objectId}`) || '{}'
          const notes = JSON.parse(raw)
          delete notes[nodeId]
          localStorage.setItem(`zlfn_notes_${objectId}`, JSON.stringify(notes))
          onSuccess?.(`Note deleted locally for node ${nodeId}`)
          return true
        } catch {
          onError?.(response.error || 'Failed to delete note')
          return false
        }
      }
    } catch (error) {
      try {
        const raw = localStorage.getItem(`zlfn_notes_${objectId}`) || '{}'
        const notes = JSON.parse(raw)
        delete notes[nodeId]
        localStorage.setItem(`zlfn_notes_${objectId}`, JSON.stringify(notes))
        onSuccess?.(`Note deleted locally for node ${nodeId}`)
        return true
      } catch {
        onError?.(error instanceof Error ? error.message : 'Failed to delete note')
        return false
      }
    }
  }, [objectId, onError, onSuccess])

  // Undo/Redo operating on selected note id
  const undo = useCallback((): boolean => {
    const nodeId = notesState.selectedNoteId
    if (!nodeId) return false
    const h = historyRef.current.get(nodeId)
    if (!h || h.index <= 0) return false
    h.index -= 1
    const previous = h.entries[h.index] || ''
    historyRef.current.set(nodeId, h)
    setNotesState(prev => ({ ...prev, notes: { ...prev.notes, [nodeId]: previous }, isDirty: true }))
    pendingChangesRef.current.set(nodeId, previous)
    return true
  }, [notesState.selectedNoteId])

  const redo = useCallback((): boolean => {
    const nodeId = notesState.selectedNoteId
    if (!nodeId) return false
    const h = historyRef.current.get(nodeId)
    if (!h || h.index >= h.entries.length - 1) return false
    h.index += 1
    const next = h.entries[h.index] || ''
    historyRef.current.set(nodeId, h)
    setNotesState(prev => ({ ...prev, notes: { ...prev.notes, [nodeId]: next }, isDirty: true }))
    pendingChangesRef.current.set(nodeId, next)
    return true
  }, [notesState.selectedNoteId])

  // Save all pending changes
  const saveAllPendingChanges = useCallback(async () => {
    const pendingChanges = Array.from(pendingChangesRef.current.entries())
    
    if (pendingChanges.length === 0) return

    const results = await Promise.allSettled(
      pendingChanges.map(([nodeId, content]) => saveNote(nodeId, content))
    )

    const successful = results.filter(result => 
      result.status === 'fulfilled' && result.value
    ).length

    if (successful === pendingChanges.length) {
      setNotesState(prev => ({ ...prev, isDirty: false }))
      onSuccess?.(`Saved ${successful} notes`)
    } else {
      onError?.(`Failed to save ${pendingChanges.length - successful} notes`)
    }
  }, [saveNote, onError, onSuccess])

  // Get note content
  const getNoteContent = useCallback((nodeId: string): string => {
    return notesState.notes[nodeId] || ''
  }, [notesState.notes])

  // Check if node has note
  const hasNote = useCallback((nodeId: string): boolean => {
    return Boolean(notesState.notes[nodeId]?.trim())
  }, [notesState.notes])

  // Get total notes count
  const getNotesCount = useCallback((): number => {
    return Object.values(notesState.notes).filter(note => note.trim()).length
  }, [notesState.notes])

  const canUndo = useCallback(() => {
    const nodeId = notesState.selectedNoteId
    if (!nodeId) return false
    const h = historyRef.current.get(nodeId)
    return !!h && h.index > 0
  }, [notesState.selectedNoteId])

  const canRedo = useCallback(() => {
    const nodeId = notesState.selectedNoteId
    if (!nodeId) return false
    const h = historyRef.current.get(nodeId)
    return !!h && h.index < (h.entries.length - 1)
  }, [notesState.selectedNoteId])

  // Auto-save control
  const enableAutoSave = useCallback(() => {
    setAutoSaveEnabled(true)
  }, [])

  const disableAutoSave = useCallback(() => {
    setAutoSaveEnabled(false)
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }
  }, [])

  // Save all notes
  const saveAllNotes = useCallback(async (): Promise<boolean> => {
    await saveAllPendingChanges()
    return pendingChangesRef.current.size === 0
  }, [saveAllPendingChanges])

  // Clear all notes
  const clearAllNotes = useCallback(async (): Promise<boolean> => {
    const nodeIds = Object.keys(notesState.notes)
    
    const results = await Promise.allSettled(
      nodeIds.map(nodeId => deleteNote(nodeId))
    )

    const successful = results.filter(result => 
      result.status === 'fulfilled' && result.value
    ).length

    return successful === nodeIds.length
  }, [notesState.notes, deleteNote])

  return {
    // State
    notes: notesState.notes,
    selectedNoteId: notesState.selectedNoteId,
    isEditing: notesState.isEditing,
    isDirty: notesState.isDirty,
    isLoading,
    
    // Actions
    openNote,
    closeNote,
    updateNote,
    saveNote,
    deleteNote,
    undo,
    redo,
    
    // Utilities
    getNoteContent,
    hasNote,
    getNotesCount,
    canUndo,
    canRedo,
    
    // Auto-save control
    enableAutoSave,
    disableAutoSave,
    
    // Bulk operations
    saveAllNotes,
    clearAllNotes
  }
}

// Additional utility hook for note statistics
export function useNotesStatistics(notes: Record<string, string>) {
  return {
    totalNotes: Object.keys(notes).length,
    totalCharacters: Object.values(notes).reduce((sum, note) => sum + note.length, 0),
    averageLength: Object.values(notes).length > 0 
      ? Math.round(Object.values(notes).reduce((sum, note) => sum + note.length, 0) / Object.values(notes).length)
      : 0,
    nonEmptyNotes: Object.values(notes).filter(note => note.trim()).length,
    lastModified: new Date().toISOString() // In production, track actual last modified
  }
}
