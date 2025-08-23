import { realAPI } from './realAPI'
import { api as mockAPI } from './zlfnAPI'

export interface APIConfig {
  useRealBackend: boolean
  backendURL: string
  enableAuth: boolean
  enableWebSocket: boolean
}

const defaultConfig: APIConfig = {
  useRealBackend: true, // Activate real backend by default
  backendURL: 'http://localhost:3001/api',
  enableAuth: false, // Disable auth initially
  enableWebSocket: false // Disable WebSocket initially
}

class APIConfigManager {
  private config: APIConfig
  private listeners: Array<(config: APIConfig) => void> = []

  constructor() {
    // Load config from localStorage or use defaults
    const savedConfig = localStorage.getItem('api_config')
    this.config = savedConfig ? { ...defaultConfig, ...JSON.parse(savedConfig) } : defaultConfig
  }

  getConfig(): APIConfig {
    return { ...this.config }
  }

  updateConfig(updates: Partial<APIConfig>): void {
    this.config = { ...this.config, ...updates }
    localStorage.setItem('api_config', JSON.stringify(this.config))
    this.notifyListeners()
  }

  subscribe(listener: (config: APIConfig) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.config))
  }

  // Get the appropriate API instance based on config
  getAPI() {
    return this.config.useRealBackend ? realAPI : mockAPI
  }

  // Helper methods for common config changes
  enableRealBackend(): void {
    this.updateConfig({ useRealBackend: true })
  }

  enableMockBackend(): void {
    this.updateConfig({ useRealBackend: false })
  }

  setBackendURL(url: string): void {
    this.updateConfig({ backendURL: url })
  }

  toggleAuth(): void {
    this.updateConfig({ enableAuth: !this.config.enableAuth })
  }

  toggleWebSocket(): void {
    this.updateConfig({ enableWebSocket: !this.config.enableWebSocket })
  }
}

// Create singleton instance
export const apiConfig = new APIConfigManager()

// Export the current API instance (will switch based on config)
export const getCurrentAPI = () => apiConfig.getAPI()

export default apiConfig
