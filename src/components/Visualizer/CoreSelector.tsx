/**
 * Core Selector Component for Multi-Core JSON Imports
 * Allows users to select which core argument to visualize when multiple cores are available
 */

import React from 'react'
import { FormControl, InputLabel, Select, MenuItem, Typography, Box } from '@mui/material'

import { useLogicShared } from '../../context/LogicSharedContext'

export interface CoreSelectorProps {
  label?: string
  size?: 'small' | 'medium'
  minWidth?: number
  showTitle?: boolean
  title?: string
}

export const CoreSelector: React.FC<CoreSelectorProps> = ({
  label = "Core",
  size = "small",
  minWidth = 200,
  showTitle = false,
  title
}) => {
  const { 
    selectedCoreId, 
    setSelectedCoreId, 
    getCoresForCurrentImport, 
    getCurrentImportId,
    setSelectedArgumentId 
  } = useLogicShared()

  const cores = getCoresForCurrentImport()
  const currentImportId = getCurrentImportId()

  // Debug logging
  React.useEffect(() => {
    console.debug('[CoreSelector] Debug info:', {
      currentImportId,
      coresCount: cores.length,
      cores: cores.map(c => ({ id: c.id, title: c.title, coreMetadata: c.coreMetadata })),
      selectedCoreId
    })
  }, [currentImportId, cores, selectedCoreId])

  // Don't render if not a multi-core import or only one core
  if (!currentImportId || cores.length <= 1) {
    console.debug('[CoreSelector] Not rendering:', { currentImportId, coresLength: cores.length })
    return null
  }

  const handleCoreChange = (event: { target: { value: string } }) => {
    const newCoreId = event.target.value
    setSelectedCoreId(newCoreId)
    // Also update the selected argument to match the core
    setSelectedArgumentId(newCoreId)
  }

  // Ensure selectedCoreId is valid
  const validSelectedCoreId = selectedCoreId && cores.some(core => core.id === selectedCoreId) 
    ? selectedCoreId 
    : (cores[0]?.id || '')

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {showTitle && title && (
        <Typography variant="h6" sx={{ color: '#40c4ff', fontWeight: 600, mr: 1 }}>
          {title}
        </Typography>
      )}
      
      <FormControl size={size} sx={{ minWidth }}>
        <InputLabel sx={{ color: 'var(--ai-text-secondary)' }}>
          {label}
        </InputLabel>
        <Select
          value={validSelectedCoreId}
          onChange={handleCoreChange}
          label={label}
          sx={{ 
            color: 'var(--ai-text-primary)',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(64,196,255,0.3)'
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(64,196,255,0.5)'
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#40c4ff'
            }
          }}
        >
          {cores.map((core, index) => (
            <MenuItem key={core.id} value={core.id}>
              {`Core ${index + 1}: ${core.coreMetadata?.coreName || core.title}`}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
      <Typography 
        variant="caption" 
        sx={{ 
          color: 'var(--ai-text-secondary)', 
          ml: 1,
          fontSize: '0.75rem'
        }}
      >
        {cores.length} cores available
      </Typography>
    </Box>
  )
}

export default CoreSelector
