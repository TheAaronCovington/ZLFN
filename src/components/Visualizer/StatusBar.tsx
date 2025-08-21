import React from 'react'
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Chip,
  Stack,

} from '@mui/material'
import {
  ZoomIn as ZoomIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Hub as NodesIcon,
  Timeline as EdgesIcon
} from '@mui/icons-material'

interface StatusBarProps {
  // Graph stats
  nodeCount: number
  edgeCount: number
  selectedCount?: number
  
  // Performance
  fps?: number
  memoryUsage?: number
  isPerformanceVisible?: boolean
  
  // Zoom
  zoomLevel?: number
  
  // Filters
  activeFilters?: string[]
  
  // Status message
  statusMessage?: string
  statusType?: 'info' | 'success' | 'warning' | 'error'
}

export const StatusBar: React.FC<StatusBarProps> = ({
  nodeCount,
  edgeCount,
  selectedCount,
  fps,
  memoryUsage,
  isPerformanceVisible,
  zoomLevel,
  activeFilters = [],
  statusMessage,
  statusType = 'info'
}) => {
  const getStatusColor = () => {
    switch (statusType) {
      case 'success': return '#4caf50'
      case 'warning': return '#ff9800'
      case 'error': return '#f44336'
      default: return '#40c4ff'
    }
  }

  const getFpsColor = (fps: number) => {
    if (fps > 30) return '#4caf50'
    if (fps > 15) return '#ff9800'
    return '#f44336'
  }

  return (
    <AppBar 
      position="fixed" 
      sx={{ 
        top: 'auto', 
        bottom: 0,
        backgroundColor: 'rgba(25, 25, 35, 0.95)',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(64, 196, 255, 0.2)',
        height: 32
      }}
    >
      <Toolbar 
        variant="dense" 
        sx={{ 
          minHeight: 32, 
          height: 32,
          px: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}
      >
        {/* Left side - Graph stats */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <NodesIcon sx={{ fontSize: 16, color: '#40c4ff' }} />
            <Typography variant="caption" sx={{ color: '#ffffff' }}>
              {nodeCount}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <EdgesIcon sx={{ fontSize: 16, color: '#40c4ff' }} />
            <Typography variant="caption" sx={{ color: '#ffffff' }}>
              {edgeCount}
            </Typography>
          </Box>

          {selectedCount !== undefined && selectedCount > 0 && (
            <Chip 
              label={`${selectedCount} selected`}
              size="small"
              color="primary"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          )}

          {zoomLevel !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ZoomIcon sx={{ fontSize: 16, color: '#40c4ff' }} />
              <Typography variant="caption" sx={{ color: '#ffffff' }}>
                {Math.round(zoomLevel * 100)}%
              </Typography>
            </Box>
          )}
        </Stack>

        {/* Center - Status message */}
        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
          {statusMessage && (
            <Typography 
              variant="caption" 
              sx={{ 
                color: getStatusColor(),
                fontWeight: 500,
                maxWidth: 300,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {statusMessage}
            </Typography>
          )}
        </Box>

        {/* Right side - Performance and filters */}
        <Stack direction="row" spacing={2} alignItems="center">
          {activeFilters.length > 0 && (
            <Chip 
              label={`${activeFilters.length} filters`}
              size="small"
              color="secondary"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          )}

          {isPerformanceVisible && fps !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <SpeedIcon sx={{ fontSize: 16, color: getFpsColor(fps) }} />
              <Typography 
                variant="caption" 
                sx={{ color: getFpsColor(fps), fontWeight: 500, minWidth: 30 }}
              >
                {Math.round(fps)}
              </Typography>
            </Box>
          )}

          {isPerformanceVisible && memoryUsage !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <MemoryIcon sx={{ fontSize: 16, color: '#40c4ff' }} />
              <Typography variant="caption" sx={{ color: '#ffffff', minWidth: 40 }}>
                {Math.round(memoryUsage)}MB
              </Typography>
            </Box>
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  )
}

export default StatusBar
