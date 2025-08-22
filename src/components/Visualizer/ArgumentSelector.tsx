/**
 * Reusable Argument Selector Component
 * Extracted from ATN and generalized for use across all views (ZLFN/STN/ATN)
 */

import React from 'react'
import { FormControl, InputLabel, Select, MenuItem, Typography } from '@mui/material'
import type { SharedArgument } from '../../context/LogicSharedContext'

export interface ArgumentSelectorProps {
  arguments: SharedArgument[]
  selectedArgumentId: string | null
  onArgumentSelect: (argumentId: string) => void
  label?: string
  size?: 'small' | 'medium'
  minWidth?: number
  showTitle?: boolean
  title?: string
}

export const ArgumentSelector: React.FC<ArgumentSelectorProps> = ({
  arguments: argumentList,
  selectedArgumentId,
  onArgumentSelect,
  label = "Argument",
  size = "small",
  minWidth = 200,
  showTitle = false,
  title
}) => {
  // Ensure selectedArgumentId exists in the argumentList, otherwise use empty string
  const validSelectedId = React.useMemo(() => {
    if (!selectedArgumentId) return ''
    const exists = argumentList.some(arg => arg.id === selectedArgumentId)
    return exists ? selectedArgumentId : ''
  }, [selectedArgumentId, argumentList])

  // Auto-select first argument if current selection is invalid and arguments are available
  React.useEffect(() => {
    if (!validSelectedId && argumentList.length > 0) {
      // Auto-select first argument if no valid selection exists
      console.log('ArgumentSelector: Auto-selecting first argument:', argumentList[0].id, 'Previous selection was:', selectedArgumentId)
      onArgumentSelect(argumentList[0].id)
    }
  }, [validSelectedId, argumentList, onArgumentSelect, selectedArgumentId])

  const handleChange = (event: { target: { value: string } }) => {
    onArgumentSelect(event.target.value)
  }

  return (
    <>
      {showTitle && title && (
        <Typography variant="h6" sx={{ color: '#40c4ff', fontWeight: 600, mr: 2 }}>
          {title}
        </Typography>
      )}
      
      <FormControl size={size} sx={{ minWidth }}>
        <InputLabel sx={{ color: 'var(--ai-text-secondary)' }}>
          {label}
        </InputLabel>
        <Select
          value={validSelectedId}
          onChange={handleChange}
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
          {argumentList.length === 0 ? (
            <MenuItem disabled value="">
              No arguments available
            </MenuItem>
          ) : (
            argumentList.map(arg => (
              <MenuItem key={arg.id} value={arg.id}>
                {arg.title}
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>
    </>
  )
}

export default ArgumentSelector
