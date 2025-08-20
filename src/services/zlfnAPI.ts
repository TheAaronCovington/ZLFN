/**
 * ZLFN API Service
 * Mock API implementation for ZLFN object operations
 * This will be replaced with actual backend calls in production
 */

import type { 
  ZLFNObject, 
  ZLFNStructure, 
  ZLFNVersion, 
  ImportResult, 
  MergeResult, 
  APIResponse,
  MergeOptions
} from '../types/zlfn'
import { zlfnObjectManager } from './zlfnObjectManager'

class ZLFNAPIService {
  private baseURL = '/api' // Will be configurable for production

  // Object Management APIs
  async getObject(id: string): Promise<APIResponse<ZLFNObject>> {
    try {
      // For demos, ensure the object exists so routes like "sample-object-1" work out of the box
      const object = await zlfnObjectManager.getObject(id) || await zlfnObjectManager.ensureObject(id)
      
      if (!object) {
        return {
          success: false,
          error: 'Object not found',
          metadata: this.createMetadata()
        }
      }

      return {
        success: true,
        data: object,
        metadata: this.createMetadata()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: this.createMetadata()
      }
    }
  }

  async createObject(markdown?: string, zflnJson?: ZLFNStructure): Promise<APIResponse<ZLFNObject>> {
    try {
      const object = await zlfnObjectManager.createObject(markdown, zflnJson)
      
      return {
        success: true,
        data: object,
        metadata: this.createMetadata()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: this.createMetadata()
      }
    }
  }

  async updateObject(id: string, updates: Partial<ZLFNObject>): Promise<APIResponse<ZLFNObject>> {
    try {
      const object = await zlfnObjectManager.updateObject(id, updates)
      
      if (!object) {
        return {
          success: false,
          error: 'Object not found or update failed',
          metadata: this.createMetadata()
        }
      }

      return {
        success: true,
        data: object,
        metadata: this.createMetadata()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: this.createMetadata()
      }
    }
  }

  async deleteObject(id: string): Promise<APIResponse<boolean>> {
    try {
      const success = await zlfnObjectManager.deleteObject(id)
      
      return {
        success,
        data: success,
        error: success ? undefined : 'Object not found or deletion failed',
        metadata: this.createMetadata()
      }
    } catch (error) {
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: this.createMetadata()
      }
    }
  }

  // Markdown Operations
  async updateMarkdown(id: string, markdown: string, author?: string): Promise<APIResponse<ZLFNObject>> {
    try {
      const object = await zlfnObjectManager.updateMarkdown(id, markdown, author)
      
      if (!object) {
        return {
          success: false,
          error: 'Object not found',
          metadata: this.createMetadata()
        }
      }

      return {
        success: true,
        data: object,
        metadata: this.createMetadata()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: this.createMetadata()
      }
    }
  }

  // JSON Operations
  async updateJSON(
    id: string, 
    zflnJson: ZLFNStructure, 
    options?: MergeOptions
  ): Promise<APIResponse<MergeResult>> {
    try {
      const result = await zlfnObjectManager.updateJSON(id, zflnJson, options)
      
      return {
        success: result.success,
        data: result,
        warnings: result.warnings,
        metadata: this.createMetadata()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: this.createMetadata()
      }
    }
  }

  // File Import Operations
  async uploadFile(file: File, existingObjectId?: string): Promise<APIResponse<ImportResult>> {
    try {
      const result = await zlfnObjectManager.importFromFile(file, existingObjectId)
      
      return {
        success: result.success,
        data: result,
        warnings: result.warnings,
        metadata: this.createMetadata()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: this.createMetadata()
      }
    }
  }

  // Notes Operations
  async saveNote(objectId: string, nodeId: string, noteContent: string, author?: string): Promise<APIResponse<boolean>> {
    try {
      const success = await zlfnObjectManager.saveNote(objectId, nodeId, noteContent, author)
      
      return {
        success,
        data: success,
        error: success ? undefined : 'Failed to save note',
        metadata: this.createMetadata()
      }
    } catch (error) {
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: this.createMetadata()
      }
    }
  }

  async deleteNote(objectId: string, nodeId: string): Promise<APIResponse<boolean>> {
    try {
      const success = await zlfnObjectManager.deleteNote(objectId, nodeId)
      
      return {
        success,
        data: success,
        error: success ? undefined : 'Note not found or deletion failed',
        metadata: this.createMetadata()
      }
    } catch (error) {
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: this.createMetadata()
      }
    }
  }

  // Version Control Operations
  async getVersionHistory(objectId: string): Promise<APIResponse<ZLFNVersion[]>> {
    try {
      const versions = await zlfnObjectManager.getVersionHistory(objectId)
      
      return {
        success: true,
        data: versions,
        metadata: this.createMetadata()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: this.createMetadata()
      }
    }
  }

  async revertToVersion(objectId: string, versionTimestamp: string): Promise<APIResponse<ZLFNObject>> {
    try {
      const object = await zlfnObjectManager.revertToVersion(objectId, versionTimestamp)
      
      if (!object) {
        return {
          success: false,
          error: 'Object or version not found',
          metadata: this.createMetadata()
        }
      }

      return {
        success: true,
        data: object,
        metadata: this.createMetadata()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: this.createMetadata()
      }
    }
  }

  // Create a snapshot entry in version history (e.g., after layout save)
  async createSnapshot(objectId: string, description: string, changeType?: ZLFNVersion['changeType'], author?: string): Promise<APIResponse<ZLFNObject>> {
    try {
      const object = await zlfnObjectManager.createSnapshot(objectId, description, changeType, author)
      if (!object) {
        return { success: false, error: 'Object not found', metadata: this.createMetadata() }
      }
      return { success: true, data: object, metadata: this.createMetadata() }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error', metadata: this.createMetadata() }
    }
  }

  // Export Operations
  async exportObject(objectId: string, format: 'json' | 'markdown' | 'full' = 'full'): Promise<APIResponse<string>> {
    try {
      const exportData = await zlfnObjectManager.exportObject(objectId, format)
      
      if (!exportData) {
        return {
          success: false,
          error: 'Object not found or export failed',
          metadata: this.createMetadata()
        }
      }

      return {
        success: true,
        data: exportData,
        metadata: this.createMetadata()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: this.createMetadata()
      }
    }
  }

  // List and Search Operations
  async getAllObjects(): Promise<APIResponse<ZLFNObject[]>> {
    try {
      const objects = zlfnObjectManager.getAllObjects()
      
      return {
        success: true,
        data: objects,
        metadata: this.createMetadata()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: this.createMetadata()
      }
    }
  }

  async searchObjects(query: string): Promise<APIResponse<ZLFNObject[]>> {
    try {
      const objects = zlfnObjectManager.searchObjects(query)
      
      return {
        success: true,
        data: objects,
        metadata: this.createMetadata()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: this.createMetadata()
      }
    }
  }

  // Lock Management
  async acquireLock(objectId: string, userId: string, duration?: number): Promise<APIResponse<boolean>> {
    try {
      const success = zlfnObjectManager.acquireLock(objectId, userId, duration)
      
      return {
        success,
        data: success,
        error: success ? undefined : 'Failed to acquire lock - object may be locked by another user',
        metadata: this.createMetadata()
      }
    } catch (error) {
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: this.createMetadata()
      }
    }
  }

  async releaseLock(objectId: string, userId: string): Promise<APIResponse<boolean>> {
    try {
      const success = zlfnObjectManager.releaseLock(objectId, userId)
      
      return {
        success,
        data: success,
        error: success ? undefined : 'Failed to release lock',
        metadata: this.createMetadata()
      }
    } catch (error) {
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: this.createMetadata()
      }
    }
  }

  // Real-time collaboration simulation (will be replaced with WebSocket)
  async subscribe(objectId: string, callback: (event: any) => void): Promise<() => void> {
    // Mock implementation - in production this would set up WebSocket connection
    const interval = setInterval(() => {
      // Simulate occasional updates
      if (Math.random() < 0.1) { // 10% chance per second
        callback({
          type: 'object_updated',
          objectId,
          timestamp: new Date().toISOString(),
          data: { message: 'Object updated by another user' }
        })
      }
    }, 1000)

    // Return unsubscribe function
    return () => clearInterval(interval)
  }

  // File download utility
  downloadFile(filename: string, content: string, contentType: string = 'application/json'): void {
    const blob = new Blob([content], { type: contentType })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    
    URL.revokeObjectURL(url)
  }

  // Utility Methods
  private createMetadata() {
    return {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      requestId: this.generateRequestId()
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Configuration
  setBaseURL(url: string): void {
    this.baseURL = url
  }

  getBaseURL(): string {
    return this.baseURL
  }
}

// Singleton instance
export const zlfnAPI = new ZLFNAPIService()

// Export both the class and instance for flexibility
export { ZLFNAPIService }

// Convenience functions for common operations
export const api = {
  // Object operations
  getObject: (id: string) => zlfnAPI.getObject(id),
  createObject: (markdown?: string, zflnJson?: ZLFNStructure) => zlfnAPI.createObject(markdown, zflnJson),
  updateObject: (id: string, updates: Partial<ZLFNObject>) => zlfnAPI.updateObject(id, updates),
  deleteObject: (id: string) => zlfnAPI.deleteObject(id),
  
  // Content operations
  updateMarkdown: (id: string, markdown: string, author?: string) => zlfnAPI.updateMarkdown(id, markdown, author),
  updateJSON: (id: string, zflnJson: ZLFNStructure, options?: MergeOptions) => zlfnAPI.updateJSON(id, zflnJson, options),
  
  // File operations
  uploadFile: (file: File, existingObjectId?: string) => zlfnAPI.uploadFile(file, existingObjectId),
  exportObject: (objectId: string, format?: 'json' | 'markdown' | 'full') => zlfnAPI.exportObject(objectId, format),
  
  // Notes operations
  saveNote: (objectId: string, nodeId: string, noteContent: string, author?: string) => 
    zlfnAPI.saveNote(objectId, nodeId, noteContent, author),
  deleteNote: (objectId: string, nodeId: string) => zlfnAPI.deleteNote(objectId, nodeId),
  
  // Version control
  getVersionHistory: (objectId: string) => zlfnAPI.getVersionHistory(objectId),
  revertToVersion: (objectId: string, versionTimestamp: string) => zlfnAPI.revertToVersion(objectId, versionTimestamp),
  createSnapshot: (objectId: string, description: string, changeType?: ZLFNVersion['changeType'], author?: string) => zlfnAPI.createSnapshot(objectId, description, changeType, author),
  
  // Search and list
  getAllObjects: () => zlfnAPI.getAllObjects(),
  searchObjects: (query: string) => zlfnAPI.searchObjects(query),
  
  // Collaboration
  acquireLock: (objectId: string, userId: string, duration?: number) => zlfnAPI.acquireLock(objectId, userId, duration),
  releaseLock: (objectId: string, userId: string) => zlfnAPI.releaseLock(objectId, userId),
  subscribe: (objectId: string, callback: (event: any) => void) => zlfnAPI.subscribe(objectId, callback),
  
  // Utilities
  downloadFile: (filename: string, content: string, contentType?: string) => 
    zlfnAPI.downloadFile(filename, content, contentType)
}
