/**
 * ATN Keyboard Shortcuts Handler
 * Provides comprehensive keyboard navigation and control for Argument Tableau Network
 */

import type { ATNLayoutMode } from './types'

export interface ATNKeyboardShortcuts {
  // Layout controls
  switchToTree: () => void
  switchToHierarchical: () => void
  switchToTable: () => void
  cycleLayouts: () => void
  
  // Analysis controls
  toggleStrengthAnalysis: () => void
  toggleSchemeClustering: () => void
  refreshAnalysis: () => void
  
  // Export shortcuts
  exportAsJSON: () => void
  exportAsMarkdown: () => void
  exportAsLaTeX: () => void
  exportAsCSV: () => void
  
  // Navigation
  selectNextNode: () => void
  selectPreviousNode: () => void
  selectCoreNode: () => void
  clearSelection: () => void
  
  // View controls
  fitToView: () => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  
  // Facet shortcuts
  openVennDiagram: () => void
  openTruthTable: () => void
  openTimeline: () => void
  openCounterarguments: () => void
  openRebuttal: () => void
  
  // Settings
  openSettings: () => void
  openExportMenu: () => void
  showHelp: () => void
}

export interface KeyboardShortcutConfig {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  description: string
  category: 'Layout' | 'Analysis' | 'Export' | 'Navigation' | 'View' | 'Facets' | 'Settings'
}

/**
 * Default keyboard shortcuts configuration for ATN
 */
export const ATN_KEYBOARD_SHORTCUTS: Record<string, KeyboardShortcutConfig> = {
  // Layout controls
  switchToTree: {
    key: '1',
    description: 'Switch to Tree layout',
    category: 'Layout'
  },
  switchToHierarchical: {
    key: '2', 
    description: 'Switch to Hierarchical layout',
    category: 'Layout'
  },
  switchToTable: {
    key: '3',
    description: 'Switch to Table layout', 
    category: 'Layout'
  },
  cycleLayouts: {
    key: 'Tab',
    description: 'Cycle through layouts',
    category: 'Layout'
  },
  
  // Analysis controls
  toggleStrengthAnalysis: {
    key: 's',
    description: 'Toggle strength analysis',
    category: 'Analysis'
  },
  toggleSchemeClustering: {
    key: 'c',
    description: 'Toggle scheme clustering',
    category: 'Analysis'
  },
  refreshAnalysis: {
    key: 'r',
    description: 'Refresh analysis',
    category: 'Analysis'
  },
  
  // Export shortcuts
  exportAsJSON: {
    key: 'j',
    ctrlKey: true,
    description: 'Export as JSON',
    category: 'Export'
  },
  exportAsMarkdown: {
    key: 'm',
    ctrlKey: true,
    description: 'Export as Markdown',
    category: 'Export'
  },
  exportAsLaTeX: {
    key: 'l',
    ctrlKey: true,
    description: 'Export as LaTeX',
    category: 'Export'
  },
  exportAsCSV: {
    key: 'e',
    ctrlKey: true,
    description: 'Export as CSV',
    category: 'Export'
  },
  
  // Navigation
  selectNextNode: {
    key: 'ArrowDown',
    description: 'Select next node',
    category: 'Navigation'
  },
  selectPreviousNode: {
    key: 'ArrowUp',
    description: 'Select previous node',
    category: 'Navigation'
  },
  selectCoreNode: {
    key: 'Home',
    description: 'Select core argument',
    category: 'Navigation'
  },
  clearSelection: {
    key: 'Escape',
    description: 'Clear selection',
    category: 'Navigation'
  },
  
  // View controls
  fitToView: {
    key: 'f',
    description: 'Fit to view',
    category: 'View'
  },
  zoomIn: {
    key: '=',
    description: 'Zoom in',
    category: 'View'
  },
  zoomOut: {
    key: '-',
    description: 'Zoom out',
    category: 'View'
  },
  resetZoom: {
    key: '0',
    description: 'Reset zoom',
    category: 'View'
  },
  
  // Facet shortcuts
  openVennDiagram: {
    key: 'v',
    description: 'Open Venn diagram for selected node',
    category: 'Facets'
  },
  openTruthTable: {
    key: 't',
    description: 'Open truth table for selected node',
    category: 'Facets'
  },
  openTimeline: {
    key: 'i',
    description: 'Open timeline for selected node',
    category: 'Facets'
  },
  openCounterarguments: {
    key: 'u',
    description: 'Open counterarguments for selected node',
    category: 'Facets'
  },
  openRebuttal: {
    key: 'b',
    description: 'Open rebuttal analysis for selected node',
    category: 'Facets'
  },
  
  // Settings
  openSettings: {
    key: ',',
    ctrlKey: true,
    description: 'Open settings',
    category: 'Settings'
  },
  openExportMenu: {
    key: 'e',
    shiftKey: true,
    description: 'Open export menu',
    category: 'Settings'
  },
  showHelp: {
    key: '?',
    shiftKey: true,
    description: 'Show keyboard shortcuts help',
    category: 'Settings'
  }
}

/**
 * Create keyboard event handler for ATN shortcuts
 */
export function createATNKeyboardHandler(
  shortcuts: ATNKeyboardShortcuts,
  isActive: boolean = true
): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent) => {
    if (!isActive) return
    
    // Check if we're in an input field or dialog
    const target = event.target as HTMLElement
    const isInInput = target.tagName === 'INPUT' || 
                     target.tagName === 'TEXTAREA' || 
                     target.tagName === 'SELECT' ||
                     target.isContentEditable ||
                     target.closest('[role="dialog"]') ||
                     target.closest('.MuiDialog-root') ||
                     target.closest('.MuiModal-root') ||
                     target.closest('.MuiPopover-root')
    
    if (isInInput) return
    
    const key = event.key
    const ctrlKey = event.ctrlKey || event.metaKey
    const shiftKey = event.shiftKey
    const altKey = event.altKey
    
    // Find matching shortcut
    for (const [action, config] of Object.entries(ATN_KEYBOARD_SHORTCUTS)) {
      if (config.key === key &&
          (config.ctrlKey || false) === ctrlKey &&
          (config.shiftKey || false) === shiftKey &&
          (config.altKey || false) === altKey) {
        
        event.preventDefault()
        event.stopPropagation()
        
        // Execute the corresponding action
        const handler = shortcuts[action as keyof ATNKeyboardShortcuts]
        if (handler && typeof handler === 'function') {
          handler()
        }
        
        break
      }
    }
  }
}

/**
 * Get layout mode from number key
 */
export function getLayoutModeFromKey(key: string): ATNLayoutMode | null {
  switch (key) {
    case '1': return 'tree'
    case '2': return 'hierarchical'
    case '3': return 'table'
    default: return null
  }
}

/**
 * Cycle to next layout mode
 */
export function getNextLayoutMode(current: ATNLayoutMode): ATNLayoutMode {
  switch (current) {
    case 'tree': return 'hierarchical'
    case 'hierarchical': return 'table'
    case 'table': return 'tree'
    default: return 'tree'
  }
}

/**
 * Format keyboard shortcut for display
 */
export function formatShortcut(config: KeyboardShortcutConfig): string {
  const parts: string[] = []
  
  if (config.ctrlKey) parts.push('Ctrl')
  if (config.shiftKey) parts.push('Shift')
  if (config.altKey) parts.push('Alt')
  
  // Format special keys
  let keyDisplay = config.key
  switch (config.key) {
    case 'ArrowUp': keyDisplay = '↑'; break
    case 'ArrowDown': keyDisplay = '↓'; break
    case 'ArrowLeft': keyDisplay = '←'; break
    case 'ArrowRight': keyDisplay = '→'; break
    case 'Escape': keyDisplay = 'Esc'; break
    case 'Home': keyDisplay = 'Home'; break
    case 'End': keyDisplay = 'End'; break
    case 'Tab': keyDisplay = 'Tab'; break
    case ' ': keyDisplay = 'Space'; break
  }
  
  parts.push(keyDisplay)
  
  return parts.join(' + ')
}

/**
 * Group shortcuts by category for help display
 */
export function groupShortcutsByCategory(): Record<string, Array<{action: string, config: KeyboardShortcutConfig}>> {
  const groups: Record<string, Array<{action: string, config: KeyboardShortcutConfig}>> = {}
  
  for (const [action, config] of Object.entries(ATN_KEYBOARD_SHORTCUTS)) {
    if (!groups[config.category]) {
      groups[config.category] = []
    }
    groups[config.category].push({ action, config })
  }
  
  return groups
}

/**
 * Check if a keyboard shortcut conflicts with browser defaults
 */
export function hasConflictWithBrowser(config: KeyboardShortcutConfig): boolean {
  const { key, ctrlKey, shiftKey, altKey } = config
  
  // Common browser shortcuts that we should avoid
  const browserShortcuts = [
    { key: 's', ctrlKey: true, shiftKey: false, altKey: false }, // Save
    { key: 'o', ctrlKey: true, shiftKey: false, altKey: false }, // Open
    { key: 'n', ctrlKey: true, shiftKey: false, altKey: false }, // New
    { key: 'w', ctrlKey: true, shiftKey: false, altKey: false }, // Close tab
    { key: 't', ctrlKey: true, shiftKey: false, altKey: false }, // New tab
    { key: 'r', ctrlKey: true, shiftKey: false, altKey: false }, // Reload
    { key: 'f', ctrlKey: true, shiftKey: false, altKey: false }, // Find
    { key: 'p', ctrlKey: true, shiftKey: false, altKey: false }, // Print
    { key: 'z', ctrlKey: true, shiftKey: false, altKey: false }, // Undo
    { key: 'y', ctrlKey: true, shiftKey: false, altKey: false }, // Redo
    { key: 'c', ctrlKey: true, shiftKey: false, altKey: false }, // Copy
    { key: 'v', ctrlKey: true, shiftKey: false, altKey: false }, // Paste
    { key: 'x', ctrlKey: true, shiftKey: false, altKey: false }, // Cut
    { key: 'a', ctrlKey: true, shiftKey: false, altKey: false }, // Select all
  ]
  
  return browserShortcuts.some(shortcut => 
    shortcut.key === key &&
    (shortcut.ctrlKey || false) === (ctrlKey || false) &&
    (shortcut.shiftKey || false) === (shiftKey || false) &&
    (shortcut.altKey || false) === (altKey || false)
  )
}
