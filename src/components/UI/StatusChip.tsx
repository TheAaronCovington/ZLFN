/**
 * StatusChip Component
 * Consolidates all status and legend chip patterns across the application
 * Provides consistent styling and behavior for different chip variants
 */

import React from 'react'
import { Chip, Tooltip, type ChipProps } from '@mui/material'

export interface StatusChipProps extends Omit<ChipProps, 'variant' | 'color'> {
  // Core properties
  variant: 'status' | 'legend' | 'counter' | 'mode' | 'action' | 'keyboard' | 'branch'
  status?: 'success' | 'error' | 'warning' | 'info' | 'active' | 'inactive' | 'pending'
  
  // Content
  label: React.ReactNode
  tooltip?: React.ReactNode
  icon?: React.ReactElement
  
  // Appearance
  size?: 'small' | 'medium'
  interactive?: boolean
  
  // Behavior
  onClick?: () => void
  onDelete?: () => void
}

/**
 * Maps status to MUI color and variant
 */
function getChipAppearance(variant: StatusChipProps['variant'], status?: StatusChipProps['status']) {
  // Default appearance
  let color: ChipProps['color'] = 'default'
  let chipVariant: ChipProps['variant'] = 'outlined'
  
  switch (variant) {
    case 'status':
      chipVariant = status === 'active' || status === 'success' ? 'filled' : 'outlined'
      switch (status) {
        case 'success':
        case 'active':
          color = 'success'
          break
        case 'error':
          color = 'error'
          break
        case 'warning':
          color = 'warning'
          break
        case 'info':
          color = 'info'
          break
        case 'pending':
          color = 'default'
          break
        default:
          color = 'default'
      }
      break
      
    case 'counter':
      chipVariant = 'filled'
      color = status === 'active' ? 'warning' : 'default'
      break
      
    case 'mode':
      chipVariant = status === 'active' ? 'filled' : 'outlined'
      color = status === 'active' ? 'primary' : 'default'
      break
      
    case 'legend':
    case 'keyboard':
    case 'branch':
      chipVariant = 'outlined'
      color = 'default'
      break
      
    case 'action':
      chipVariant = 'outlined'
      color = 'primary'
      break
      
    default:
      chipVariant = 'outlined'
      color = 'default'
  }
  
  return { color, variant: chipVariant }
}

/**
 * Gets custom styling based on variant
 */
function getCustomStyling(variant: StatusChipProps['variant'], interactive: boolean = false) {
  const baseStyle = {
    fontSize: '0.75rem',
    height: 'auto',
    '& .MuiChip-label': {
      padding: '2px 6px',
      fontSize: 'inherit'
    }
  }
  
  const interactiveStyle = interactive ? {
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: 'rgba(64, 196, 255, 0.1)',
      borderColor: 'rgba(64, 196, 255, 0.5)'
    }
  } : {}
  
  switch (variant) {
    case 'keyboard':
      return {
        ...baseStyle,
        ...interactiveStyle,
        backgroundColor: 'rgba(25, 25, 35, 0.8)',
        borderColor: 'rgba(64, 196, 255, 0.3)',
        color: '#40c4ff',
        '& .MuiChip-label': {
          ...baseStyle['& .MuiChip-label'],
          fontFamily: 'monospace',
          fontSize: '0.7rem'
        }
      }
      
    case 'branch':
      return {
        ...baseStyle,
        ...interactiveStyle,
        backgroundColor: 'rgba(25, 25, 35, 0.8)',
        borderColor: 'rgba(64, 196, 255, 0.3)',
        color: '#40c4ff'
      }
      
    case 'legend':
      return {
        ...baseStyle,
        ...interactiveStyle,
        backgroundColor: 'rgba(25, 25, 35, 0.6)',
        borderColor: 'rgba(64, 196, 255, 0.2)'
      }
      
    case 'counter':
      return {
        ...baseStyle,
        minWidth: '24px',
        '& .MuiChip-label': {
          ...baseStyle['& .MuiChip-label'],
          fontWeight: 600,
          fontSize: '0.7rem'
        }
      }
      
    case 'mode':
      return {
        ...baseStyle,
        ...interactiveStyle
      }
      
    case 'status':
      return {
        ...baseStyle,
        '& .MuiChip-label': {
          ...baseStyle['& .MuiChip-label'],
          fontWeight: 500
        }
      }
      
    case 'action':
      return {
        ...baseStyle,
        ...interactiveStyle,
        '&:hover': {
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          borderColor: 'rgba(33, 150, 243, 0.5)'
        }
      }
      
    default:
      return {
        ...baseStyle,
        ...interactiveStyle
      }
  }
}

export const StatusChip: React.FC<StatusChipProps> = ({
  variant,
  status,
  label,
  tooltip,
  icon,
  size = 'small',
  interactive = false,
  onClick,
  onDelete,
  ...chipProps
}) => {
  const { color, variant: chipVariant } = getChipAppearance(variant, status)
  const customSx = getCustomStyling(variant, interactive || !!onClick)
  
  const chipElement = (
    <Chip
      {...chipProps}
      label={label}
      icon={icon}
      size={size}
      color={color}
      variant={chipVariant}
      onClick={onClick}
      onDelete={onDelete}
      sx={{
        ...customSx,
        ...chipProps.sx
      }}
    />
  )
  
  if (tooltip) {
    return (
      <Tooltip title={tooltip} arrow placement="top">
        {chipElement}
      </Tooltip>
    )
  }
  
  return chipElement
}

// Convenience functions for common patterns
export const createStatusChip = (
  label: React.ReactNode,
  status: StatusChipProps['status'],
  tooltip?: React.ReactNode
) => ({
  variant: 'status' as const,
  label,
  status,
  tooltip
})

export const createCounterChip = (
  count: number,
  label: string,
  active: boolean = false
) => ({
  variant: 'counter' as const,
  label: `${label}: ${count}`,
  status: active ? ('active' as const) : ('inactive' as const)
})

export const createModeChip = (
  label: React.ReactNode,
  active: boolean,
  onClick?: () => void
) => ({
  variant: 'mode' as const,
  label,
  status: active ? ('active' as const) : ('inactive' as const),
  interactive: !!onClick,
  onClick
})

export const createLegendChip = (
  label: React.ReactNode,
  tooltip?: React.ReactNode
) => ({
  variant: 'legend' as const,
  label,
  tooltip,
  interactive: true
})

export const createKeyboardChip = (
  keys: string,
  description: string
) => ({
  variant: 'keyboard' as const,
  label: keys,
  tooltip: description
})

export const createBranchChip = (
  tooltip: React.ReactNode
) => ({
  variant: 'branch' as const,
  label: '🌳',
  tooltip
})

export default StatusChip
