/**
 * Enhanced ZLFN Context
 * Global state management for ZLFN objects, notes, and collaboration
 */

import { createContext, useContext, useReducer, useCallback, useEffect, type ReactNode } from 'react'
import type { 
  ZLFNObject, 
  ZLFNStructure, 
  ZLFNUIState,
  CollaborationState,
  ZLFNVersion,
  MergeOptions,
  ImportResult,
  MergeResult
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
  | { type: 'SET_VIEW_MODE'; payload: ZLFNUIState['viewMode'] }
  | { type: 'SET_EDIT_MODE'; payload: boolean }
  | { type: 'SET_SHOW_NOTES'; payload: boolean }
  | { type: 'SET_SHOW_VERSION_HISTORY'; payload: boolean }
  | { type: 'SET_COLLABORATION_STATE'; payload: Partial<CollaborationState> }
  | { type: 'ADD_PENDING_CHANGE'; payload: any }
  | { type: 'REMOVE_PENDING_CHANGE'; payload: string }

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
  viewMode: ZLFNUIState['viewMode']
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
    isConnected: false,
    activeUsers: [],
    editLocks: {},
    pendingChanges: []
  }
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
    
    case 'ADD_PENDING_CHANGE':
      return {
        ...state,
        collaboration: {
          ...state.collaboration,
          pendingChanges: [...state.collaboration.pendingChanges, action.payload]
        }
      }
    
    case 'REMOVE_PENDING_CHANGE':
      return {
        ...state,
        collaboration: {
          ...state.collaboration,
          pendingChanges: state.collaboration.pendingChanges.filter(
            change => change.id !== action.payload
          )
        }
      }
    
    default:
      return state
  }
}

// Context Interface
interface ZLFNContextValue {
  // State
  state: ZLFNState
  
  // Object Operations
  loadObject: (id: string) => Promise<void>
  createObject: (markdown?: string, zflnJson?: ZLFNStructure) => Promise<string | null>
  updateObject: (updates: Partial<ZLFNObject>) => Promise<void>
  deleteObject: (id: string) => Promise<boolean>
  
  // Content Operations
  updateMarkdown: (markdown: string, author?: string) => Promise<void>
  updateJSON: (zflnJson: ZLFNStructure, options?: MergeOptions) => Promise<MergeResult | null>
  
  // File Operations
  importFile: (file: File, existingObjectId?: string) => Promise<ImportResult | null>
  exportObject: (format?: 'json' | 'markdown' | 'full') => Promise<void>
  
  // Version Control
  getVersionHistory: () => Promise<ZLFNVersion[]>
  revertToVersion: (versionTimestamp: string) => Promise<void>
  
  // List and Search
  loadAllObjects: () => Promise<void>
  searchObjects: (query: string) => Promise<ZLFNObject[]>
  
  // UI Actions
  setSelectedNodes: (nodeIds: string[]) => void
  setViewMode: (mode: ZLFNUIState['viewMode']) => void
  setEditMode: (enabled: boolean) => void
  toggleNotes: () => void
  toggleVersionHistory: () => void
  
  // Utilities
  clearError: () => void
  clearSuccess: () => void
  showError: (message: string) => void
  showSuccess: (message: string) => void
}

// Create Context
const ZLFNContext = createContext<ZLFNContextValue | undefined>(undefined)

// Provider Props
interface ZLFNProviderProps {
  children: ReactNode
  userId?: string
  enableCollaboration?: boolean
}

// Provider Component
export function ZLFNProvider({ 
  children, 
  userId: _userId = 'default-user',
  enableCollaboration: _enableCollaboration = false 
}: ZLFNProviderProps) {
  const [state, dispatch] = useReducer(zlfnReducer, initialState)

  // Auto-clear messages after delay
  useEffect(() => {
    if (state.error) {
      const timer = setTimeout(() => dispatch({ type: 'SET_ERROR', payload: null }), 5000)
      return () => clearTimeout(timer)
    }
  }, [state.error])

  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(() => dispatch({ type: 'SET_SUCCESS', payload: null }), 3000)
      return () => clearTimeout(timer)
    }
  }, [state.success])

  // Object Operations
  const loadObject = useCallback(async (id: string) => {
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

  const createObject = useCallback(async (markdown?: string, zflnJson?: ZLFNStructure): Promise<string | null> => {
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const response = await api.createObject(markdown, zflnJson)
      if (response.success && response.data) {
        dispatch({ type: 'SET_CURRENT_OBJECT', payload: response.data })
        dispatch({ type: 'SET_SUCCESS', payload: 'Object created successfully' })
        return response.data.id
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.error || 'Failed to create object' })
        return null
      }
    } catch (error) {
              dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' })
      return null
    }
  }, [])

  const updateObject = useCallback(async (updates: Partial<ZLFNObject>) => {
    if (!state.currentObject) return
    
    try {
      const response = await api.updateObject(state.currentObject.id, updates)
      if (response.success && response.data) {
        dispatch({ type: 'SET_CURRENT_OBJECT', payload: response.data })
        dispatch({ type: 'SET_SUCCESS', payload: 'Object updated successfully' })
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.error || 'Failed to update object' })
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' })
    }
  }, [state.currentObject])

  const deleteObject = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await api.deleteObject(id)
      if (response.success) {
        if (state.currentObject?.id === id) {
          dispatch({ type: 'SET_CURRENT_OBJECT', payload: null })
        }
        dispatch({ type: 'SET_SUCCESS', payload: 'Object deleted successfully' })
        return true
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.error || 'Failed to delete object' })
        return false
      }
    } catch (error) {
              dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' })
      return false
    }
  }, [state.currentObject])

  // Content Operations
  const updateMarkdown = useCallback(async (markdown: string, author?: string) => {
    if (!state.currentObject) return
    
    try {
      const response = await api.updateMarkdown(state.currentObject.id, markdown, author)
      if (response.success && response.data) {
        dispatch({ type: 'SET_CURRENT_OBJECT', payload: response.data })
        dispatch({ type: 'SET_SUCCESS', payload: 'Markdown updated successfully' })
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.error || 'Failed to update markdown' })
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' })
    }
  }, [state.currentObject])

  const updateJSON = useCallback(async (zflnJson: ZLFNStructure, options?: MergeOptions): Promise<MergeResult | null> => {
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
  }, [state.currentObject, loadObject])

  // File Operations
  const importFile = useCallback(async (file: File, existingObjectId?: string): Promise<ImportResult | null> => {
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const response = await api.uploadFile(file, existingObjectId)
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
  }, [loadObject])

  const exportObject = useCallback(async (format: 'json' | 'markdown' | 'full' = 'full') => {
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
  const getVersionHistory = useCallback(async (): Promise<ZLFNVersion[]> => {
    if (!state.currentObject) return []
    
    try {
      const response = await api.getVersionHistory(state.currentObject.id)
      if (response.success && response.data) {
        return response.data
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.error || 'Failed to load version history' })
        return []
      }
    } catch (error) {
              dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' })
      return []
    }
  }, [state.currentObject])

  const revertToVersion = useCallback(async (versionTimestamp: string) => {
    if (!state.currentObject) return
    
    try {
      const response = await api.revertToVersion(state.currentObject.id, versionTimestamp)
      if (response.success && response.data) {
        dispatch({ type: 'SET_CURRENT_OBJECT', payload: response.data })
        dispatch({ type: 'SET_SUCCESS', payload: 'Successfully reverted to previous version' })
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.error || 'Failed to revert to version' })
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' })
    }
  }, [state.currentObject])

  // List and Search
  const loadAllObjects = useCallback(async () => {
    try {
      const response = await api.getAllObjects()
      if (response.success && response.data) {
        dispatch({ type: 'SET_OBJECTS_LIST', payload: response.data })
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.error || 'Failed to load objects' })
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' })
    }
  }, [])

  const searchObjects = useCallback(async (query: string): Promise<ZLFNObject[]> => {
    try {
      const response = await api.searchObjects(query)
      if (response.success && response.data) {
        return response.data
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.error || 'Search failed' })
        return []
      }
    } catch (error) {
              dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' })
      return []
    }
  }, [])

  // UI Actions
  const setSelectedNodes = useCallback((nodeIds: string[]) => {
    dispatch({ type: 'SET_SELECTED_NODES', payload: nodeIds })
  }, [])

  const setViewMode = useCallback((mode: ZLFNUIState['viewMode']) => {
    dispatch({ type: 'SET_VIEW_MODE', payload: mode })
  }, [])

  const setEditMode = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_EDIT_MODE', payload: enabled })
  }, [])

  const toggleNotes = useCallback(() => {
    dispatch({ type: 'SET_SHOW_NOTES', payload: !state.showNotes })
  }, [state.showNotes])

  const toggleVersionHistory = useCallback(() => {
    dispatch({ type: 'SET_SHOW_VERSION_HISTORY', payload: !state.showVersionHistory })
  }, [state.showVersionHistory])

  // Utilities
  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null })
  }, [])

  const clearSuccess = useCallback(() => {
    dispatch({ type: 'SET_SUCCESS', payload: null })
  }, [])

  const showError = useCallback((message: string) => {
    dispatch({ type: 'SET_ERROR', payload: message })
  }, [])

  const showSuccess = useCallback((message: string) => {
    dispatch({ type: 'SET_SUCCESS', payload: message })
  }, [])

  // Context Value
  const contextValue: ZLFNContextValue = {
    state,
    loadObject,
    createObject,
    updateObject,
    deleteObject,
    updateMarkdown,
    updateJSON,
    importFile,
    exportObject,
    getVersionHistory,
    revertToVersion,
    loadAllObjects,
    searchObjects,
    setSelectedNodes,
    setViewMode,
    setEditMode,
    toggleNotes,
    toggleVersionHistory,
    clearError,
    clearSuccess,
    showError,
    showSuccess
  }

  return (
    <ZLFNContext.Provider value={contextValue}>
      {children}
    </ZLFNContext.Provider>
  )
}

// Hook to use ZLFN context
export function useZLFN() {
  const context = useContext(ZLFNContext)
  if (context === undefined) {
    throw new Error('useZLFN must be used within a ZLFNProvider')
  }
  return context
}

// Additional hooks for specific functionality
export function useZLFNObject() {
  const { state, loadObject, updateObject } = useZLFN()
  return {
    object: state.currentObject,
    isLoading: state.isLoading,
    loadObject,
    updateObject
  }
}

export function useZLFNSelection() {
  const { state, setSelectedNodes } = useZLFN()
  return {
    selectedNodes: state.selectedNodes,
    setSelectedNodes,
    clearSelection: () => setSelectedNodes([]),
    toggleNode: (nodeId: string) => {
      const current = state.selectedNodes
      if (current.includes(nodeId)) {
        setSelectedNodes(current.filter(id => id !== nodeId))
      } else {
        setSelectedNodes([...current, nodeId])
      }
    }
  }
}
