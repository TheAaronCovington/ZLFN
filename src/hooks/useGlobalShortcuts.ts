/**
 * Global Shortcuts Hook
 * Consolidates keyboard shortcut handling across components
 * Provides context-aware shortcut management with proper input/dialog detection
 */

import { useEffect, useCallback, useRef } from 'react'

export interface ShortcutBinding {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  action: (event: KeyboardEvent) => void
  description: string
  enabled?: boolean
  preventDefault?: boolean
}

export interface ShortcutOptions {
  disableInInputs?: boolean
  disableInDialogs?: boolean
  debugLogging?: boolean
  componentName?: string
}

export interface ShortcutContext {
  isInInput: boolean
  isInDialog: boolean
  activeElement: HTMLElement | null
  tagName: string | null
  role: string | null
  isEditable: boolean
}

/**
 * Detects the current context for keyboard shortcuts
 * Extracted from ZlfnGraph.tsx context detection logic
 */
function getShortcutContext(event: KeyboardEvent): ShortcutContext {
  const active = (document.activeElement as HTMLElement | null) || (event.target as HTMLElement | null)
  
  if (!active) {
    return {
      isInInput: false,
      isInDialog: false,
      activeElement: null,
      tagName: null,
      role: null,
      isEditable: false
    }
  }

  const tagName = active.tagName
  const role = active.getAttribute?.('role')
  const isEditable = (active as any).isContentEditable || role === 'textbox'
  
  // Check if we're in a dialog (matches ZlfnGraph.tsx pattern)
  const inDialog = !!active.closest('[role="dialog"], .MuiDialog-root, .MuiModal-root, .MuiPopover-root, [data-notes-dialog="true"]')
  
  // Check if we're in an input field
  const isInInput = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || isEditable

  return {
    isInInput,
    isInDialog: inDialog,
    activeElement: active,
    tagName,
    role,
    isEditable
  }
}

/**
 * Checks if a key combination matches a binding
 */
function matchesBinding(event: KeyboardEvent, binding: ShortcutBinding): boolean {
  const keyMatches = event.key.toLowerCase() === binding.key.toLowerCase()
  const ctrlMatches = !!binding.ctrlKey === !!event.ctrlKey
  const metaMatches = !!binding.metaKey === !!event.metaKey
  const shiftMatches = !!binding.shiftKey === !!event.shiftKey
  
  return keyMatches && ctrlMatches && metaMatches && shiftMatches
}

export function useGlobalShortcuts(
  bindings: ShortcutBinding[],
  options: ShortcutOptions = {}
) {
  const {
    disableInInputs = true,
    disableInDialogs = true,
    debugLogging = false,
    componentName = 'Unknown'
  } = options

  const bindingsRef = useRef<ShortcutBinding[]>([])
  const optionsRef = useRef<ShortcutOptions>({})

  // Update refs when props change
  bindingsRef.current = bindings
  optionsRef.current = options

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const currentBindings = bindingsRef.current
    const currentOptions = optionsRef.current
    
    // Get context information
    const context = getShortcutContext(event)
    
    // Debug logging (matches ZlfnGraph.tsx pattern)
    if (debugLogging || currentOptions.debugLogging) {
      try {
        console.debug(`[${componentName}-KEY]`, {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          tag: context.tagName,
          inDialog: context.isInDialog,
          isEditable: context.isEditable,
          activeId: context.activeElement?.id || null
        })
      } catch {}
    }

    // Skip if in input and option is enabled
    if (disableInInputs && context.isInInput) {
      if (debugLogging || currentOptions.debugLogging) {
        try {
          console.debug(`[${componentName}-KEY] skip due to input/editable`)
        } catch {}
      }
      return
    }

    // Skip if in dialog and option is enabled
    if (disableInDialogs && context.isInDialog) {
      if (debugLogging || currentOptions.debugLogging) {
        try {
          console.debug(`[${componentName}-KEY] skip due to dialog`)
        } catch {}
      }
      return
    }

    // Check each binding
    for (const binding of currentBindings) {
      if (binding.enabled === false) continue
      
      if (matchesBinding(event, binding)) {
        if (binding.preventDefault !== false) {
          event.preventDefault()
        }
        
        if (debugLogging || currentOptions.debugLogging) {
          try {
            console.debug(`[${componentName}-KEY] executing binding:`, binding.description)
          } catch {}
        }
        
        binding.action(event)
        break // Only execute first matching binding
      }
    }
  }, [componentName, disableInInputs, disableInDialogs])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Return utility functions for dynamic management
  const registerShortcut = useCallback((binding: ShortcutBinding) => {
    bindingsRef.current = [...bindingsRef.current, binding]
  }, [])

  const unregisterShortcut = useCallback((key: string) => {
    bindingsRef.current = bindingsRef.current.filter(b => b.key !== key)
  }, [])

  const getActiveShortcuts = useCallback((): ShortcutBinding[] => {
    return bindingsRef.current.filter(b => b.enabled !== false)
  }, [])

  const updateBinding = useCallback((key: string, updates: Partial<ShortcutBinding>) => {
    bindingsRef.current = bindingsRef.current.map(binding => 
      binding.key === key ? { ...binding, ...updates } : binding
    )
  }, [])

  return {
    registerShortcut,
    unregisterShortcut,
    getActiveShortcuts,
    updateBinding,
    context: getShortcutContext
  }
}

// Convenience function for creating common shortcut patterns
export function createShortcut(
  key: string,
  action: (event: KeyboardEvent) => void,
  description: string,
  modifiers: { ctrl?: boolean; meta?: boolean; shift?: boolean } = {}
): ShortcutBinding {
  return {
    key,
    action,
    description,
    ctrlKey: modifiers.ctrl,
    metaKey: modifiers.meta,
    shiftKey: modifiers.shift,
    enabled: true,
    preventDefault: true
  }
}

// Common shortcut patterns
export const commonShortcuts = {
  // Navigation
  fitToView: (action: () => void) => createShortcut('f', action, 'Fit to view'),
  center: (action: () => void) => createShortcut('c', action, 'Center view'),
  resetZoom: (action: () => void) => createShortcut('v', action, 'Reset zoom'),
  
  // Selection
  clearSelection: (action: () => void) => createShortcut('Escape', action, 'Clear selection'),
  selectNext: (action: () => void) => createShortcut('Tab', action, 'Select next'),
  selectPrevious: (action: () => void) => createShortcut('Tab', action, 'Select previous', { shift: true }),
  
  // File operations
  save: (action: () => void) => createShortcut('s', action, 'Save', { ctrl: true }),
  export: (action: () => void) => createShortcut('o', action, 'Export'),
  
  // Search
  search: (action: () => void) => createShortcut('f', action, 'Search', { ctrl: true }),
  
  // Help
  showHelp: (action: () => void) => createShortcut('?', action, 'Show help'),
  
  // Undo/Redo
  undo: (action: () => void) => createShortcut('z', action, 'Undo', { ctrl: true }),
  redo: (action: () => void) => createShortcut('y', action, 'Redo', { ctrl: true })
}
