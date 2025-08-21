/**
 * Legend Component
 * Consolidates legend and guide displays across the application
 * Supports multiple display variants and flexible item configuration
 */

import React from 'react'
import { Box, Card, CardContent, Typography, Tooltip, type SxProps, type Theme } from '@mui/material'

export interface LegendItem {
  key: string
  label: React.ReactNode
  symbol?: React.ReactNode
  color?: string
  style?: 'solid' | 'dashed' | 'dotted'
  description?: React.ReactNode
  onClick?: () => void
}

export interface LegendProps {
  title?: string
  items: LegendItem[]
  variant: 'tooltip' | 'panel' | 'inline' | 'grid' | 'symbols'
  compact?: boolean
  direction?: 'row' | 'column'
  sx?: SxProps<Theme>
}

/**
 * Renders a color indicator based on item properties
 */
const ColorIndicator: React.FC<{ item: LegendItem; compact?: boolean }> = ({ item, compact = false }) => {
  if (!item.color) return null
  
  const size = compact ? 8 : 12
  const baseStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    border: `1px solid ${item.color}50`,
    boxShadow: `0 0 ${compact ? 3 : 6}px ${item.color}40`,
    flexShrink: 0
  }
  
  let backgroundColor = item.color
  let borderStyle = 'solid'
  
  switch (item.style) {
    case 'dashed':
      borderStyle = 'dashed'
      break
    case 'dotted':
      borderStyle = 'dotted'
      break
    default:
      borderStyle = 'solid'
  }
  
  return (
    <Box
      sx={{
        ...baseStyle,
        backgroundColor,
        borderStyle
      }}
    />
  )
}

/**
 * Renders a symbol indicator for symbol guides
 */
const SymbolIndicator: React.FC<{ item: LegendItem }> = ({ item }) => {
  if (!item.symbol) return null
  
  return (
    <Typography 
      variant="h4" 
      sx={{ 
        color: '#00e676', 
        textShadow: '0 0 6px rgba(0,230,118,0.6)',
        fontSize: '2rem',
        lineHeight: 1
      }}
    >
      {item.symbol}
    </Typography>
  )
}

/**
 * Renders legend items based on variant
 */
const LegendItems: React.FC<{
  items: LegendItem[]
  variant: LegendProps['variant']
  compact?: boolean
  direction?: 'row' | 'column'
}> = ({ items, variant, compact = false, direction = 'column' }) => {
  
  if (variant === 'symbols') {
    return (
      <Box sx={{ 
        display: 'grid', 
        gap: 2, 
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' 
      }}>
        {items.map(item => (
          <Tooltip key={item.key} title={item.description || ''} arrow>
            <Card sx={{
              backgroundColor: 'var(--ai-bg-secondary)',
              border: '1px solid rgba(64,196,255,0.3)',
              borderRadius: 2,
              textAlign: 'center',
              cursor: item.onClick ? 'pointer' : 'default',
              '&:hover': item.onClick ? {
                backgroundColor: 'rgba(64,196,255,0.1)',
                borderColor: 'rgba(64,196,255,0.5)'
              } : {}
            }}
            onClick={item.onClick}
            >
              <CardContent>
                <SymbolIndicator item={item} />
                <Typography variant="body2" sx={{ color: 'var(--ai-text-secondary)', mt: 1 }}>
                  {item.label}
                </Typography>
              </CardContent>
            </Card>
          </Tooltip>
        ))}
      </Box>
    )
  }
  
  if (variant === 'grid') {
    return (
      <Box sx={{ 
        display: 'grid', 
        gap: compact ? 1 : 2, 
        gridTemplateColumns: direction === 'row' ? `repeat(${items.length}, 1fr)` : '1fr'
      }}>
        {items.map(item => (
          <Box
            key={item.key}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              padding: compact ? 0.5 : 1,
              borderRadius: 1,
              cursor: item.onClick ? 'pointer' : 'default',
              '&:hover': item.onClick ? {
                backgroundColor: 'rgba(64,196,255,0.1)'
              } : {}
            }}
            onClick={item.onClick}
          >
            <ColorIndicator item={item} compact={compact} />
            <Typography 
              variant={compact ? 'caption' : 'body2'} 
              sx={{ 
                color: 'var(--ai-text-primary)',
                fontSize: compact ? '0.7rem' : '0.875rem',
                fontWeight: 500
              }}
            >
              {item.label}
            </Typography>
          </Box>
        ))}
      </Box>
    )
  }
  
  // Default: simple list layout for tooltip, panel, inline variants
  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: direction,
      gap: compact ? 0.5 : 1,
      alignItems: direction === 'row' ? 'center' : 'flex-start'
    }}>
      {items.map(item => {
        const itemContent = (
          <Box
            key={item.key}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: compact ? 0.5 : 1,
              padding: compact ? '2px 4px' : '4px 8px',
              borderRadius: 1,
              cursor: item.onClick ? 'pointer' : 'default',
              '&:hover': item.onClick ? {
                backgroundColor: 'rgba(64,196,255,0.1)'
              } : {}
            }}
            onClick={item.onClick}
          >
            <ColorIndicator item={item} compact={compact} />
            {item.symbol && (
              <Typography 
                variant="body2" 
                sx={{ 
                  fontFamily: 'monospace',
                  color: 'var(--ai-text-primary)',
                  fontSize: compact ? '0.7rem' : '0.8rem'
                }}
              >
                {item.symbol}
              </Typography>
            )}
            <Typography 
              variant={compact ? 'caption' : 'body2'} 
              sx={{ 
                color: 'var(--ai-text-primary)',
                fontSize: compact ? '0.7rem' : '0.8rem',
                fontWeight: 500
              }}
            >
              {item.label}
            </Typography>
          </Box>
        )
        
        if (item.description && variant !== 'inline') {
          return (
            <Tooltip key={item.key} title={item.description} arrow placement="top">
              {itemContent}
            </Tooltip>
          )
        }
        
        return itemContent
      })}
    </Box>
  )
}

export const Legend: React.FC<LegendProps> = ({
  title,
  items,
  variant,
  compact = false,
  direction = 'column',
  sx
}) => {
  const getContainerStyling = () => {
    switch (variant) {
      case 'panel':
        return {
          padding: compact ? 1 : 1.5,
          backgroundColor: 'var(--ai-bg-elevated)',
          borderRadius: 1,
          border: '1px solid rgba(64,196,255,0.3)',
          minWidth: compact ? 80 : 120
        }
        
      case 'tooltip':
        return {
          padding: 1,
          backgroundColor: 'rgba(25, 25, 35, 0.9)',
          borderRadius: 1,
          border: '1px solid rgba(64,196,255,0.2)'
        }
        
      case 'inline':
        return {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1
        }
        
      case 'symbols':
      case 'grid':
      default:
        return {}
    }
  }
  
  return (
    <Box sx={{ ...getContainerStyling(), ...sx }}>
      {title && (
        <Typography 
          variant={compact ? 'caption' : 'subtitle2'} 
          sx={{ 
            color: 'var(--ai-text-secondary)',
            fontWeight: 600,
            mb: compact ? 0.5 : 1,
            fontSize: compact ? '0.7rem' : '0.875rem'
          }}
        >
          {title}
        </Typography>
      )}
      <LegendItems 
        items={items}
        variant={variant}
        compact={compact}
        direction={direction}
      />
    </Box>
  )
}

// Convenience functions for common legend patterns
export const createColorLegend = (
  items: Array<{ key: string; label: string; color: string; description?: string }>
): LegendItem[] => {
  return items.map(item => ({
    key: item.key,
    label: item.label,
    color: item.color,
    description: item.description
  }))
}

export const createSymbolLegend = (
  items: Array<{ key: string; symbol: string; label: string; description?: string }>
): LegendItem[] => {
  return items.map(item => ({
    key: item.key,
    symbol: item.symbol,
    label: item.label,
    description: item.description
  }))
}

export const createBranchLegend = (): LegendItem[] => [
  { key: 'alpha', label: 'α rules (conjunction)', symbol: '━━', color: '#2196f3', style: 'solid' as const },
  { key: 'beta', label: 'β rules (disjunction)', symbol: '┅┅', color: '#ff9800', style: 'dashed' as const },
  { key: 'implication', label: 'Implication', symbol: '━━', color: '#9c27b0', style: 'solid' as const },
  { key: 'biconditional', label: 'Biconditional', symbol: '━━', color: '#e91e63', style: 'solid' as const },
  { key: 'quantifiers', label: 'Quantifiers', symbol: '┄┄', color: '#673ab7', style: 'dotted' as const },
  { key: 'double-neg', label: 'Double negation', symbol: '···', color: '#4caf50', style: 'dotted' as const }
]

export default Legend
