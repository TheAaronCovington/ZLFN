import React, { useEffect, useRef } from 'react'
import { Box, useTheme } from '@mui/material'
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout'
import { useTouchGestures } from '../../hooks/useTouchGestures'

interface MobileLayoutProps {
  children: React.ReactNode
  onPinch?: (scale: number, center: { x: number; y: number }) => void
  onPan?: (delta: { x: number; y: number }, center: { x: number; y: number }) => void
  onDoubleTap?: (point: { x: number; y: number }) => void
  onLongPress?: (point: { x: number; y: number }) => void
  enableGestures?: boolean
  className?: string
}

const MobileLayout: React.FC<MobileLayoutProps> = ({
  children,
  onPinch,
  onPan,
  onDoubleTap,
  onLongPress,
  enableGestures = true,
  className
}) => {
  const theme = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const { isMobile, isTablet, getMobileLayoutConfig } = useResponsiveLayout()
  const mobileConfig = getMobileLayoutConfig()

  // Setup touch gestures
  const { attachToElement } = useTouchGestures({
    onPinch: enableGestures ? onPinch : undefined,
    onPan: enableGestures ? onPan : undefined,
    onDoubleTap: enableGestures ? onDoubleTap : undefined,
    onLongPress: enableGestures ? onLongPress : undefined
  })

  useEffect(() => {
    if (!enableGestures || !containerRef.current) return

    const element = containerRef.current
    const cleanup = attachToElement(element)

    return cleanup
  }, [enableGestures, attachToElement])

  // Prevent default touch behaviors that interfere with gestures
  useEffect(() => {
    if (!isMobile && !isTablet) return

    const preventDefault = (e: Event) => {
      // Prevent double-tap zoom on mobile browsers
      if (e.type === 'touchstart' && (e as TouchEvent).touches.length > 1) {
        e.preventDefault()
      }
      // Prevent context menu on long press
      if (e.type === 'contextmenu') {
        e.preventDefault()
      }
    }

    const element = containerRef.current
    if (element) {
      element.addEventListener('touchstart', preventDefault, { passive: false })
      element.addEventListener('contextmenu', preventDefault)
      
      return () => {
        element.removeEventListener('touchstart', preventDefault)
        element.removeEventListener('contextmenu', preventDefault)
      }
    }
  }, [isMobile, isTablet])

  // Mobile-specific styles
  const mobileStyles = {
    // Ensure full viewport usage on mobile
    height: isMobile ? '100vh' : 'auto',
    width: '100%',
    
    // Improve touch scrolling
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
    
    // Prevent text selection during gestures
    userSelect: 'none' as const,
    WebkitUserSelect: 'none' as const,
    
    // Improve tap responsiveness
    touchAction: enableGestures ? 'none' : 'manipulation',
    
    // Ensure proper stacking
    position: 'relative' as const,
    zIndex: 1,
    
    // Optimize for mobile performance
    willChange: enableGestures ? 'transform' : 'auto',
    
    // Padding adjustments for mobile
    padding: isMobile ? mobileConfig.spacing.xs : mobileConfig.spacing.sm,
    
    // Safe area handling for notched devices
    ...(isMobile && {
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      paddingLeft: 'env(safe-area-inset-left)',
      paddingRight: 'env(safe-area-inset-right)'
    }),
    
    // Improve rendering performance
    backfaceVisibility: 'hidden' as const,
    perspective: 1000,
    
    // Custom scrollbar for mobile
    '&::-webkit-scrollbar': {
      width: isMobile ? 2 : 8,
      height: isMobile ? 2 : 8
    },
    '&::-webkit-scrollbar-track': {
      background: 'transparent'
    },
    '&::-webkit-scrollbar-thumb': {
      background: theme.palette.divider,
      borderRadius: 4,
      '&:hover': {
        background: theme.palette.text.secondary
      }
    }
  }

  return (
    <Box
      ref={containerRef}
      className={className}
      sx={mobileStyles}
    >
      {children}
      
      {/* Mobile-specific overlay for gesture feedback */}
      {(isMobile || isTablet) && enableGestures && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 10,
            
            // Visual feedback for touch interactions
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'transparent',
              transition: 'background-color 0.1s ease',
            }
          }}
        />
      )}
    </Box>
  )
}

export default MobileLayout
