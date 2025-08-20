/**
 * Enhanced ZLFN Context
 * Global state management for ZLFN objects, notes, and collaboration
 */

import React from 'react'
import type { 
  ZLFNObject,
  ZLFNStructure,
  ImportResult,
  CollaborationState,
  ZLFNVersion
} from '../types/zlfn'
import { api } from '../services/zlfnAPI'

// Action Types
type ZLFNAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SUCCESS'; payload: string | null }
  | { type: 'SET_CURRENT_OBJECT'; payload: ZLFNObject | null }
  | { type: 'UPDATE_OBJECT'; payload: Partial<ZLFNObject> }
  | { type: 'SET_OBJECTS_LIST'; payload: ZLFNObject[] }
  | { type: 'SET_SELECTED_NODES'; payload: string[] }
  | { type: 'SET_VIEW_MODE'; payload: 'graph' | 'ast' | 'both' }
  | { type: 'SET_EDIT_MODE'; payload: boolean }
  | { type: 'SET_SHOW_NOTES'; payload: boolean }
  | { type: 'SET_SHOW_VERSION_HISTORY'; payload: boolean }
  | { type: 'SET_COLLABORATION_STATE'; payload: Partial<CollaborationState> }
  | { type: 'ADD_PENDING_CHANGE'; payload: any }
  | { type: 'REMOVE_PENDING_CHANGE'; payload: string }
  | { type: 'UPDATE_USER_PRESENCE'; payload: { userId: string; isEditing: boolean } }

// State Interface
interface ZLFNState {
  // Core Data
  currentObject: ZLFNObject | null
  objectsList: ZLFNObject[]
  
  // UI State
  isLoading: boolean
  error: string | null
  success: string | null
  
  // View State
  selectedNodes: string[]
  viewMode: 'graph' | 'ast' | 'both'
  editMode: boolean
  showNotes: boolean
  showVersionHistory: boolean
  
  // Collaboration
  collaboration: CollaborationState
}

// Initial State
const initialState: ZLFNState = {
  currentObject: null,
  objectsList: [],
  isLoading: false,
  error: null,
  success: null,
  selectedNodes: [],
  viewMode: 'graph',
  editMode: false,
  showNotes: true,
  showVersionHistory: false,
  collaboration: {
    isCollaborating: false,
    activeUsers: [],
    editLocks: {},
    userPresence: {},
  },
}

// Reducer
function zlfnReducer(state: ZLFNState, action: ZLFNAction): ZLFNState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false }
    
    case 'SET_SUCCESS':
      return { ...state, success: action.payload }
    
    case 'SET_CURRENT_OBJECT':
      return { ...state, currentObject: action.payload, isLoading: false }
    
    case 'UPDATE_OBJECT':
      if (!state.currentObject) return state
      return {
        ...state,
        currentObject: { ...state.currentObject, ...action.payload }
      }
    
    case 'SET_OBJECTS_LIST':
      return { ...state, objectsList: action.payload }
    
    case 'SET_SELECTED_NODES':
      return { ...state, selectedNodes: action.payload }
    
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload }
    
    case 'SET_EDIT_MODE':
      return { ...state, editMode: action.payload }
    
    case 'SET_SHOW_NOTES':
      return { ...state, showNotes: action.payload }
    
    case 'SET_SHOW_VERSION_HISTORY':
      return { ...state, showVersionHistory: action.payload }
    
    case 'SET_COLLABORATION_STATE':
      return {
        ...state,
        collaboration: { ...state.collaboration, ...action.payload }
      }
    
    // remove pending change handling; not part of imported CollaborationState
    
    case 'UPDATE_USER_PRESENCE':
      return {
        ...state,
        collaboration: {
          ...state.collaboration,
          userPresence: {
            ...state.collaboration.userPresence,
            [action.payload.userId]: {
              lastSeen: Date.now(),
              isEditing: action.payload.isEditing,
            },
          },
        },
      }
    
    default:
      return state
  }
}

// Context Interface
interface ZLFNContextValue {
  state: ZLFNState
  createObject: (markdownContent: string, initialJson?: ZLFNStructure) => Promise<ZLFNObject | null>
  loadObject: (id: string) => Promise<void>
  updateMarkdown: (markdown: string) => Promise<void>
  updateJSON: (zflnJson: ZLFNStructure, options?: any) => Promise<any | null>
  importFile: (file: File) => Promise<ImportResult | null>
  exportObject: (format: 'json' | 'markdown') => Promise<void>
  getVersionHistory: () => Promise<ZLFNVersion[] | null>
  revertToVersion: (versionId: string) => Promise<ZLFNObject | null>
  setViewMode: (mode: 'graph' | 'ast' | 'both') => void
  setEditMode: (enabled: boolean) => void
  toggleNotes: () => void
  toggleVersionHistory: () => void
  clearError: () => void
  clearSuccess: () => void
  showError: (message: string) => void
  showSuccess: (message: string) => void
  updatePresence: (editingNode?: string) => void
}

// Create Context
const ZLFNContext = React.createContext<ZLFNContextValue | undefined>(undefined)

// Provider Props
interface ZLFNProviderProps {
  children: React.ReactNode
  userId?: string
  enableCollaboration?: boolean
}

// Provider Component
export function ZLFNProvider({ 
  children, 
  userId: _userId = 'default-user',
  enableCollaboration: _enableCollaboration = false 
}: ZLFNProviderProps) {
  const [state, dispatch] = React.useReducer(zlfnReducer, initialState)

  // Auto-clear messages after delay
  React.useEffect(() => {
    if (state.error) {
      const timer = setTimeout(() => dispatch({ type: 'SET_ERROR', payload: null }), 5000)
      return () => clearTimeout(timer)
    }
  }, [state.error])

  React.useEffect(() => {
    if (state.success) {
      const timer = setTimeout(() => dispatch({ type: 'SET_SUCCESS', payload: null }), 3000)
      return () => clearTimeout(timer)
    }
  }, [state.success])

  // Object Operations
  const loadObject = React.useCallback(async (id: string) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const response = await api.getObject(id)
      if (response.success && response.data) {
        dispatch({ type: 'SET_CURRENT_OBJECT', payload: response.data })
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.error || 'Failed to load object' })
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' })
    }
  }, [])

  const createObject = React.useCallback(async (markdownContent: string, initialJson?: ZLFNStructure): Promise<ZLFNObject | null> => {
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const response = await api.createObject(markdownContent, initialJson)
      if (response.success && response.data) {
        dispatch({ type: 'SET_CURRENT_OBJECT', payload: response.data })
        dispatch({ type: 'SET_SUCCESS', payload: 'Object created successfully' })
        return response.data
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.error || 'Failed to create object' })
        return null
      }
    } catch (error) {
              dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' })
      return null
    }
  }, [])

  // Content Operations
  const updateMarkdown = React.useCallback(async (markdown: string) => {
    if (!state.currentObject) return
    
    try {
      const response = await api.updateMarkdown(state.currentObject.id, markdown)
      if (response.success && response.data) {
        dispatch({ type: 'SET_CURRENT_OBJECT', payload: response.data })
        dispatch({ type: 'SET_SUCCESS', payload: 'Markdown updated successfully' })
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.error || 'Failed to update markdown' })
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' })
    }
  }, [state.currentObject, state.collaboration.editLocks])

  const updateJSON = React.useCallback(async (zflnJson: ZLFNStructure, options?: any): Promise<any | null> => {
    if (!state.currentObject) return null
    
    try {
      const response = await api.updateJSON(state.currentObject.id, zflnJson, options)
      if (response.success && response.data) {
        // Reload the object to get updated state
        await loadObject(state.currentObject.id)
        
        if (response.data.warnings?.length) {
          dispatch({ type: 'SET_SUCCESS', payload: `JSON updated with ${response.data.warnings.length} warnings` })
        } else {
          dispatch({ type: 'SET_SUCCESS', payload: 'JSON updated successfully' })
        }
        
        return response.data
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.error || 'Failed to update JSON' })
        return null
      }
    } catch (error) {
              dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' })
      return null
    }
  }, [state.currentObject, loadObject, state.collaboration.editLocks])

  // File Operations
  const importFile = React.useCallback(async (file: File): Promise<ImportResult | null> => {
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const response = await api.uploadFile(file, state.currentObject?.id)
      if (response.success && response.data) {
        if (response.data.objectId) {
          await loadObject(response.data.objectId)
        }
        
        const message = `File imported successfully${response.data.mergedArguments ? ` (${response.data.mergedArguments} arguments)` : ''}`
        dispatch({ type: 'SET_SUCCESS', payload: message })
        
        return response.data
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.error || 'Failed to import file' })
        return null
      }
    } catch (error) {
              dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' })
      return null
    }
  }, [loadObject, state.currentObject])

  const exportObject = React.useCallback(async (format: 'json' | 'markdown' = 'json') => {
    if (!state.currentObject) return
    
    try {
      const response = await api.exportObject(state.currentObject.id, format)
      if (response.success && response.data) {
        const filename = `${state.currentObject.metadata.title || state.currentObject.id}.${format === 'markdown' ? 'md' : 'json'}`
        const contentType = format === 'markdown' ? 'text/markdown' : 'application/json'
        
        api.downloadFile(filename, response.data, contentType)
        dispatch({ type: 'SET_SUCCESS', payload: 'Export completed successfully' })
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.error || 'Failed to export object' })
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' })
    }
  }, [state.currentObject])

  // Version Control
  const getVersionHistory = React.useCallback(async (): Promise<ZLFNVersion[] | null> => {
    if (!state.currentObject) return null
    
    try {
      const response = await api.getVersionHistory(state.currentObject.id)
      if (response.success) {
        return response.data || []
      }
      return null
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' })
      return null
    }
  }, [state.currentObject])

  const revertToVersion = React.useCallback(async (versionId: string): Promise<ZLFNObject | null> => {
    if (!state.currentObject) return null
    try {
      // Our VersionHistory passes a string key as id; resolve timestamp from current version list
      let timestamp = versionId
      try {
        const list = await api.getVersionHistory(state.currentObject.id)
        if (list.success && Array.isArray(list.data)) {
          const idx = Number(versionId)
          if (!Number.isNaN(idx) && list.data[idx]?.timestamp) {
            timestamp = String(list.data[idx]?.timestamp)
          }
        }
      } catch {}
      const response = await api.revertToVersion(state.currentObject.id, timestamp)
      if (response.success && response.data) {
        dispatch({ type: 'SET_CURRENT_OBJECT', payload: response.data })
        dispatch({ type: 'SET_SUCCESS', payload: 'Successfully reverted to previous version' })
        return response.data
      }
      return null
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' })
      return null
    }
  }, [state.currentObject])

  // UI Actions
  const setViewMode = React.useCallback((mode: 'graph' | 'ast' | 'both') => {
    dispatch({ type: 'SET_VIEW_MODE', payload: mode })
  }, [])

  const setEditMode = React.useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_EDIT_MODE', payload: enabled })
  }, [])

  const toggleNotes = React.useCallback(() => {
    dispatch({ type: 'SET_SHOW_NOTES', payload: !state.showNotes })
  }, [state.showNotes])

  const toggleVersionHistory = React.useCallback(() => {
    dispatch({ type: 'SET_SHOW_VERSION_HISTORY', payload: !state.showVersionHistory })
  }, [state.showVersionHistory])

  // Utilities
  const clearError = React.useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null })
  }, [])

  const clearSuccess = React.useCallback(() => {
    dispatch({ type: 'SET_SUCCESS', payload: null })
  }, [])

  const showError = React.useCallback((message: string) => {
    dispatch({ type: 'SET_ERROR', payload: message })
  }, [])

  const showSuccess = React.useCallback((message: string) => {
    dispatch({ type: 'SET_SUCCESS', payload: message })
  }, [])

  // Implement updatePresence
  const updatePresence = React.useCallback((editingNode?: string) => {
    // Simulate sending presence update
    dispatch({
      type: 'UPDATE_USER_PRESENCE',
      payload: {
        userId: _userId, // Assuming _userId is available in the context
        isEditing: !!editingNode
      }
    })
  }, [_userId])

  // Context Value
  const contextValue: ZLFNContextValue = {
    state,
    loadObject,
    createObject,
    updateMarkdown,
    updateJSON,
    importFile,
    exportObject,
    getVersionHistory,
    revertToVersion,
    setViewMode,
    setEditMode,
    toggleNotes,
    toggleVersionHistory,
    clearError,
    clearSuccess,
    showError,
    showSuccess,
    updatePresence
  }

  return (
    <ZLFNContext.Provider value={contextValue}>
      {children}
    </ZLFNContext.Provider>
  )
}

// Hook to use ZLFN context
export function useZLFN() {
  const context = React.useContext(ZLFNContext)
  if (context === undefined) {
    throw new Error('useZLFN must be used within a ZLFNProvider')
  }
  return context
}

// Additional hooks for specific functionality
export function useZLFNObject() {
  const { state, loadObject } = useZLFN()
  return {
    object: state.currentObject,
    isLoading: state.isLoading,
    loadObject,
    // updateObject removed from public API
  }
}

export function useZLFNSelection() {
  const { state } = useZLFN()
  return {
    selectedNodes: state.selectedNodes,
    // Selection mutators removed from context for now
  }
}
