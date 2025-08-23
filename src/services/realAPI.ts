import type { 
  ZLFNObject, 
  ZLFNVersion, 
  APIResponse, 
  MergeResult,
  CollaborationState 
} from '../types/zlfn'

const API_BASE_URL = 'http://localhost:3001/api'

class RealZLFNAPI {
  private baseURL: string
  private token: string | null = null

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
    this.token = localStorage.getItem('auth_token')
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const url = `${this.baseURL}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return {
        success: true,
        data,
        error: null
      }
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error)
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Authentication
  async login(username: string, password: string): Promise<APIResponse<{ token: string; user: any }>> {
    const response = await this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })

    if (response.success && response.data) {
      this.token = response.data.token
      localStorage.setItem('auth_token', this.token)
    }

    return response
  }

  async register(username: string, password: string): Promise<APIResponse<{ token: string; user: any }>> {
    return this.request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })
  }

  logout(): void {
    this.token = null
    localStorage.removeItem('auth_token')
  }

  // ZLFN Objects
  async getObject(id: string): Promise<APIResponse<ZLFNObject>> {
    return this.request<ZLFNObject>(`/zlfn/${id}`)
  }

  async createObject(object: Partial<ZLFNObject>): Promise<APIResponse<ZLFNObject>> {
    return this.request<ZLFNObject>('/zlfn', {
      method: 'POST',
      body: JSON.stringify(object)
    })
  }

  async updateObject(id: string, updates: Partial<ZLFNObject>): Promise<APIResponse<ZLFNObject>> {
    return this.request<ZLFNObject>(`/zlfn/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    })
  }

  async deleteObject(id: string): Promise<APIResponse<void>> {
    return this.request<void>(`/zlfn/${id}`, {
      method: 'DELETE'
    })
  }

  async listObjects(): Promise<APIResponse<ZLFNObject[]>> {
    const resp = await this.request<any>('/zlfn')
    if (resp.success && resp.data && (resp.data as any).success) {
      const payload = (resp.data as any)
      const items = Array.isArray(payload.data) ? payload.data : []
      return { success: true, data: items as ZLFNObject[], error: null }
    }
    return { success: false, data: [] as any, error: resp.error || 'Failed to list objects' }
  }

  // Content Management
  async updateContent(id: string, zflnJson: any): Promise<APIResponse<ZLFNObject>> {
    return this.request<ZLFNObject>(`/zlfn/objects/${id}/content`, {
      method: 'PUT',
      body: JSON.stringify({ zflnJson })
    })
  }

  async updateJSON(id: string, zflnJson: any, _options?: any): Promise<APIResponse<ZLFNObject>> {
    return this.updateContent(id, zflnJson)
  }

  async updateMarkdown(id: string, markdownContent: string): Promise<APIResponse<ZLFNObject>> {
    return this.request<ZLFNObject>(`/zlfn/objects/${id}/markdown`, {
      method: 'PUT',
      body: JSON.stringify({ markdownContent })
    })
  }

  // File Operations
  async uploadFile(file: File, _objectId?: string): Promise<APIResponse<any>> {
    return this.importFile(file)
  }

  async importFile(file: File): Promise<APIResponse<MergeResult>> {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`${this.baseURL}/zlfn/import`, {
        method: 'POST',
        headers: {
          'Authorization': this.token ? `Bearer ${this.token}` : ''
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return {
        success: true,
        data,
        error: null
      }
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Import failed'
      }
    }
  }

  async exportObject(id: string, format: string): Promise<APIResponse<Blob>> {
    try {
      const response = await fetch(`${this.baseURL}/zlfn/${id}/export?format=${format}`, {
        headers: {
          'Authorization': this.token ? `Bearer ${this.token}` : ''
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const blob = await response.blob()
      return {
        success: true,
        data: blob,
        error: null
      }
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Export failed'
      }
    }
  }

  // Notes Management
  async getNotes(objectId: string): Promise<APIResponse<Record<string, string>>> {
    return this.request<Record<string, string>>(`/zlfn/${objectId}/notes`)
  }

  async saveNote(objectId: string, nodeId: string, content: string): Promise<APIResponse<void>> {
    return this.request<void>(`/zlfn/${objectId}/notes/${nodeId}`, {
      method: 'PUT',
      body: JSON.stringify({ content })
    })
  }

  async deleteNote(objectId: string, nodeId: string): Promise<APIResponse<void>> {
    return this.request<void>(`/zlfn/${objectId}/notes/${nodeId}`, {
      method: 'DELETE'
    })
  }

  // Version Control
  async getVersionHistory(objectId: string): Promise<APIResponse<ZLFNVersion[]>> {
    return this.request<ZLFNVersion[]>(`/zlfn/${objectId}/versions`)
  }

  async createSnapshot(
    objectId: string, 
    description: string, 
    changeType: string = 'manual', 
    author: string = 'user',
    layout?: Record<string, { x: number; y: number }>
  ): Promise<APIResponse<ZLFNVersion>> {
    return this.request<ZLFNVersion>(`/zlfn/${objectId}/snapshot`, {
      method: 'POST',
      body: JSON.stringify({ description, changeType, author, layout })
    })
  }

  async revertToVersion(objectId: string, versionTimestamp: string): Promise<APIResponse<ZLFNObject>> {
    return this.request<ZLFNObject>(`/zlfn/${objectId}/revert`, {
      method: 'POST',
      body: JSON.stringify({ timestamp: versionTimestamp })
    })
  }

  // Search
  async searchObjects(query: string, filters?: any): Promise<APIResponse<ZLFNObject[]>> {
    const params = new URLSearchParams({ query })
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
    }

    return this.request<ZLFNObject[]>(`/zlfn?${params.toString()}`)
  }

  // Collaboration
  async getCollaborationState(objectId: string): Promise<APIResponse<CollaborationState>> {
    return this.request<CollaborationState>(`/zlfn/${objectId}/collaboration`)
  }

  async acquireLock(objectId: string, nodeId?: string): Promise<APIResponse<void>> {
    return this.request<void>(`/zlfn/${objectId}/lock`, {
      method: 'POST',
      body: JSON.stringify({ nodeId })
    })
  }

  async releaseLock(objectId: string, nodeId?: string): Promise<APIResponse<void>> {
    return this.request<void>(`/zlfn/${objectId}/lock`, {
      method: 'DELETE',
      body: JSON.stringify({ nodeId })
    })
  }

  // Batch Operations
  async batchUpdateNotes(operations: Array<{
    objectId: string
    nodeId: string
    content: string
  }>): Promise<APIResponse<void>> {
    return this.request<void>('/zlfn/batch/notes', {
      method: 'POST',
      body: JSON.stringify({ operations })
    })
  }

  async batchExport(objectIds: string[], format: string): Promise<APIResponse<Blob>> {
    try {
      const response = await fetch(`${this.baseURL}/zlfn/batch/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.token ? `Bearer ${this.token}` : ''
        },
        body: JSON.stringify({ objectIds, format })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const blob = await response.blob()
      return {
        success: true,
        data: blob,
        error: null
      }
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Batch export failed'
      }
    }
  }

  // Utility Methods
  downloadFile(filename: string, content: string | Blob, contentType?: string): void {
    const blob = content instanceof Blob ? content : new Blob([content], { type: contentType || 'text/plain' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
  }
}

// Create singleton instance
export const realAPI = new RealZLFNAPI()
export default realAPI
