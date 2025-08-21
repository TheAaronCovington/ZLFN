/**
 * Shared Storage Service
 * Consolidates localStorage patterns across the application
 * Provides type-safe, error-handled storage operations
 */

export interface StorageService {
  // Basic operations
  getItem(key: string): string | null
  setItem(key: string, value: string): boolean
  removeItem(key: string): boolean
  
  // JSON operations
  getJSON<T>(key: string, defaultValue?: T): T | null
  setJSON<T>(key: string, value: T): boolean
  
  // Set operations (for LibrarySidebar)
  getSet(key: string): Set<string>
  setSet(key: string, set: Set<string>): boolean
  
  // Cross-tab events
  onStorageChange(key: string, callback: (newValue: string | null) => void): () => void
}

class StorageServiceImpl implements StorageService {
  private listeners = new Map<string, Set<(newValue: string | null) => void>>()
  private storageListener: ((e: StorageEvent) => void) | null = null

  constructor() {
    // Set up global storage event listener
    this.storageListener = (e: StorageEvent) => {
      if (e.key && this.listeners.has(e.key)) {
        const callbacks = this.listeners.get(e.key)!
        callbacks.forEach(callback => {
          try {
            callback(e.newValue)
          } catch (error) {
            console.warn(`[Storage] Error in storage change callback for key "${e.key}":`, error)
          }
        })
      }
    }
    
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.storageListener)
    }
  }

  /**
   * Get raw string value from localStorage
   */
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch (error) {
      console.warn(`[Storage] Failed to get item "${key}":`, error)
      return null
    }
  }

  /**
   * Set raw string value in localStorage
   */
  setItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value)
      return true
    } catch (error) {
      console.warn(`[Storage] Failed to set item "${key}":`, error)
      return false
    }
  }

  /**
   * Remove item from localStorage
   */
  removeItem(key: string): boolean {
    try {
      localStorage.removeItem(key)
      return true
    } catch (error) {
      console.warn(`[Storage] Failed to remove item "${key}":`, error)
      return false
    }
  }

  /**
   * Get JSON value from localStorage with optional default
   */
  getJSON<T>(key: string, defaultValue?: T): T | null {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) {
        return defaultValue ?? null
      }
      return JSON.parse(raw) as T
    } catch (error) {
      console.warn(`[Storage] Failed to get JSON item "${key}":`, error)
      return defaultValue ?? null
    }
  }

  /**
   * Set JSON value in localStorage
   */
  setJSON<T>(key: string, value: T): boolean {
    try {
      const serialized = JSON.stringify(value)
      localStorage.setItem(key, serialized)
      return true
    } catch (error) {
      console.warn(`[Storage] Failed to set JSON item "${key}":`, error)
      return false
    }
  }

  /**
   * Get Set<string> from localStorage (for LibrarySidebar compatibility)
   */
  getSet(key: string): Set<string> {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) {
        return new Set<string>()
      }
      const array = JSON.parse(raw) as string[]
      return new Set<string>(Array.isArray(array) ? array : [])
    } catch (error) {
      console.warn(`[Storage] Failed to get Set item "${key}":`, error)
      return new Set<string>()
    }
  }

  /**
   * Set Set<string> in localStorage (for LibrarySidebar compatibility)
   */
  setSet(key: string, set: Set<string>): boolean {
    try {
      const array = Array.from(set)
      const serialized = JSON.stringify(array)
      localStorage.setItem(key, serialized)
      return true
    } catch (error) {
      console.warn(`[Storage] Failed to set Set item "${key}":`, error)
      return false
    }
  }

  /**
   * Listen for changes to a specific storage key across tabs
   */
  onStorageChange(key: string, callback: (newValue: string | null) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set())
    }
    
    const callbacks = this.listeners.get(key)!
    callbacks.add(callback)
    
    // Return cleanup function
    return () => {
      callbacks.delete(callback)
      if (callbacks.size === 0) {
        this.listeners.delete(key)
      }
    }
  }

  /**
   * Cleanup method for testing or component unmounting
   */
  destroy(): void {
    if (this.storageListener && typeof window !== 'undefined') {
      window.removeEventListener('storage', this.storageListener)
    }
    this.listeners.clear()
  }
}

// Export singleton instance
export const storage = new StorageServiceImpl()

// Export class for testing
export { StorageServiceImpl }

// Convenience functions that match existing patterns
export const tryLocalStorage = {
  /**
   * Get item with try/catch (matches existing pattern in LogicVisualizer)
   */
  getItem: (key: string): string | null => storage.getItem(key),
  
  /**
   * Set item with try/catch (matches existing pattern in LogicVisualizer)
   */
  setItem: (key: string, value: string): void => {
    storage.setItem(key, value)
  },
  
  /**
   * Get JSON with try/catch and default (matches existing pattern)
   */
  getJSON: <T>(key: string, defaultValue: T): T => {
    const result = storage.getJSON<T>(key, defaultValue)
    return result ?? defaultValue
  },
  
  /**
   * Set JSON with try/catch (matches existing pattern)
   */
  setJSON: <T>(key: string, value: T): void => {
    storage.setJSON(key, value)
  }
}

// Legacy compatibility functions (for gradual migration)
export const loadSet = (key: string): Set<string> => storage.getSet(key)
export const saveSet = (key: string, set: Set<string>): void => {
  storage.setSet(key, set)
}
