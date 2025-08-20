import React, { useState, useEffect } from 'react'
import {
  Paper,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Box,
  Alert,
  Chip,
  Divider
} from '@mui/material'
import { apiConfig, type APIConfig } from '../../services/apiConfig'

const APISwitcher: React.FC = () => {
  const [config, setConfig] = useState<APIConfig>(apiConfig.getConfig())
  const [backendURL, setBackendURL] = useState(config.backendURL)
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown')
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    const unsubscribe = apiConfig.subscribe((newConfig) => {
      setConfig(newConfig)
      setBackendURL(newConfig.backendURL)
    })
    return unsubscribe
  }, [])

  const handleToggleBackend = () => {
    if (config.useRealBackend) {
      apiConfig.enableMockBackend()
      setConnectionStatus('unknown')
      setStatusMessage('Switched to mock backend')
    } else {
      apiConfig.enableRealBackend()
      testConnection()
    }
  }

  const handleUpdateURL = () => {
    apiConfig.setBackendURL(backendURL)
    if (config.useRealBackend) {
      testConnection()
    }
  }

  const testConnection = async () => {
    setConnectionStatus('unknown')
    setStatusMessage('Testing connection...')
    
    try {
      const response = await fetch(`${backendURL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        setConnectionStatus('connected')
        setStatusMessage('Backend connection successful')
      } else {
        setConnectionStatus('error')
        setStatusMessage(`Connection failed: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      setConnectionStatus('error')
      setStatusMessage(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'success'
      case 'error': return 'error'
      default: return 'default'
    }
  }

  return (
    <Paper sx={{ p: 3, maxWidth: 600 }}>
      <Typography variant="h6" gutterBottom>
        API Configuration
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={config.useRealBackend}
              onChange={handleToggleBackend}
              color="primary"
            />
          }
          label={
            <Box>
              <Typography variant="body1">
                Use Real Backend
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {config.useRealBackend 
                  ? 'Connected to Node.js/MongoDB backend' 
                  : 'Using mock API (localStorage)'}
              </Typography>
            </Box>
          }
        />
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          label="Backend URL"
          value={backendURL}
          onChange={(e) => setBackendURL(e.target.value)}
          disabled={!config.useRealBackend}
          sx={{ mb: 2 }}
        />
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button
            variant="outlined"
            onClick={handleUpdateURL}
            disabled={!config.useRealBackend || backendURL === config.backendURL}
          >
            Update URL
          </Button>
          
          <Button
            variant="outlined"
            onClick={testConnection}
            disabled={!config.useRealBackend}
          >
            Test Connection
          </Button>

          <Chip
            label={connectionStatus === 'unknown' ? 'Unknown' : connectionStatus === 'connected' ? 'Connected' : 'Error'}
            color={getStatusColor()}
            size="small"
          />
        </Box>
      </Box>

      {statusMessage && (
        <Alert 
          severity={connectionStatus === 'connected' ? 'success' : connectionStatus === 'error' ? 'error' : 'info'}
          sx={{ mb: 2 }}
        >
          {statusMessage}
        </Alert>
      )}

      <Divider sx={{ my: 2 }} />

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Additional Options
        </Typography>
        
        <FormControlLabel
          control={
            <Switch
              checked={config.enableAuth}
              onChange={() => apiConfig.toggleAuth()}
              disabled={!config.useRealBackend}
            />
          }
          label="Enable Authentication"
        />
        
        <FormControlLabel
          control={
            <Switch
              checked={config.enableWebSocket}
              onChange={() => apiConfig.toggleWebSocket()}
              disabled={!config.useRealBackend}
            />
          }
          label="Enable WebSocket (Real-time)"
        />
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          <strong>Note:</strong> Changes take effect immediately. The mock backend uses localStorage 
          for data persistence, while the real backend uses MongoDB and Redis.
        </Typography>
      </Box>
    </Paper>
  )
}

export default APISwitcher
