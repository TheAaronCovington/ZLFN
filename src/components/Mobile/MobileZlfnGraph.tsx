import React, { useCallback, useRef } from 'react'
import { Box } from '@mui/material'
import { ZlfnGraph } from '../Visualizations/ZlfnGraph'
import MobileToolbar from './MobileToolbar'
import MobileLayout from './MobileLayout'
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout'
import { useZLFNNotes } from '../../hooks/useZLFNNotes'

interface MobileZlfnGraphProps {
  // Pass through all ZlfnGraph props
  nodes?: any[]
  edges?: any[]
  onNodeClick?: (node: any) => void
  onEdgeClick?: (edge: any) => void
  onBackgroundClick?: () => void
  
  // Mobile-specific props
  showMobileToolbar?: boolean
  toolbarPosition?: 'top' | 'bottom'
  enableTouchGestures?: boolean
  
  // Notes integration
  objectId?: string
  showNotesIndicators?: boolean
}

const MobileZlfnGraph: React.FC<MobileZlfnGraphProps> = ({
  nodes = [],
  edges = [],
  onNodeClick,
  onEdgeClick,
  onBackgroundClick,
  showMobileToolbar = true,
  toolbarPosition = 'bottom',
  enableTouchGestures = true,
  objectId = 'demo-object',
  showNotesIndicators = true,
  ...graphProps
}) => {
  const graphRef = useRef<any>(null)
  const { isMobile, isTablet, getMobileLayoutConfig } = useResponsiveLayout()
  const mobileConfig = getMobileLayoutConfig()
  
  // Notes integration
  const notesHook = useZLFNNotes({ objectId })
  const { notes, openNote } = notesHook
  
  // Simple notes state for mobile
  const [notesEnabled, setNotesEnabled] = React.useState(showNotesIndicators)
  const toggleNotes = useCallback(() => setNotesEnabled(prev => !prev), [])

  // Graph control functions
  const handleSaveLayout = useCallback(() => {
    if (graphRef.current?.saveLayout) {
      graphRef.current.saveLayout()
    }
  }, [])

  const handleClearLayout = useCallback(() => {
    if (graphRef.current?.clearLayout) {
      graphRef.current.clearLayout()
    }
  }, [])

  const handleUndoLayout = useCallback(() => {
    if (graphRef.current?.undoLayout) {
      graphRef.current.undoLayout()
    }
  }, [])

  const handleRedoLayout = useCallback(() => {
    if (graphRef.current?.redoLayout) {
      graphRef.current.redoLayout()
    }
  }, [])

  const handleFitGraph = useCallback(() => {
    if (graphRef.current?.fitGraph) {
      graphRef.current.fitGraph()
    }
  }, [])

  const handleCenterGraph = useCallback(() => {
    if (graphRef.current?.centerGraph) {
      graphRef.current.centerGraph()
    }
  }, [])

  const handleZoomIn = useCallback(() => {
    if (graphRef.current?.zoomIn) {
      graphRef.current.zoomIn()
    }
  }, [])

  const handleZoomOut = useCallback(() => {
    if (graphRef.current?.zoomOut) {
      graphRef.current.zoomOut()
    }
  }, [])

  // Touch gesture handlers
  const handlePinch = useCallback((scale: number, center: { x: number; y: number }) => {
    if (graphRef.current?.handlePinchZoom) {
      graphRef.current.handlePinchZoom(scale, center.x, center.y)
    }
  }, [])

  const handlePan = useCallback((delta: { x: number; y: number }, _center: { x: number; y: number }) => {
    if (graphRef.current?.handlePan) {
      graphRef.current.handlePan(delta.x, delta.y)
    }
  }, [])

  const handleDoubleTap = useCallback((point: { x: number; y: number }) => {
    // Double tap to zoom in on that point
    if (graphRef.current?.zoomToPoint) {
      graphRef.current.zoomToPoint(point.x, point.y, 2)
    } else {
      handleZoomIn()
    }
  }, [handleZoomIn])

  const handleLongPress = useCallback((_point: { x: number; y: number }) => {
    // Long press could open context menu or create new node
    if (onBackgroundClick) {
      onBackgroundClick()
    }
  }, [onBackgroundClick])



  // Calculate container height accounting for mobile toolbar
  const containerHeight = React.useMemo(() => {
    if (!isMobile && !isTablet) return '100%'
    
    const toolbarHeight = 64
    const safeAreaBottom = 20 // Approximate safe area
    const totalOffset = showMobileToolbar ? toolbarHeight + safeAreaBottom : 0
    
    return `calc(100vh - ${totalOffset}px)`
  }, [isMobile, isTablet, showMobileToolbar])

  return (
    <Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
      <MobileLayout
        enableGestures={enableTouchGestures && (isMobile || isTablet)}
        onPinch={handlePinch}
        onPan={handlePan}
        onDoubleTap={handleDoubleTap}
        onLongPress={handleLongPress}
      >
        <Box
          sx={{
            height: containerHeight,
            width: '100%',
            position: 'relative',
            overflow: 'hidden',
            
            // Mobile-specific optimizations
            ...(isMobile || isTablet ? {
              // Improve rendering performance on mobile
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
              
              // Optimize touch interactions
              touchAction: 'none',
              
              // Prevent text selection
              userSelect: 'none',
              WebkitUserSelect: 'none',
              
              // Improve scrolling
              WebkitOverflowScrolling: 'touch',
              
              // Reduce motion on mobile for better performance
              '& *': {
                animationDuration: `${mobileConfig.animationDuration}ms !important`,
                transitionDuration: `${mobileConfig.animationDuration}ms !important`
              }
            } : {})
          }}
        >
          <ZlfnGraph
            nodes={nodes}
            edges={edges}
            
            // Notes integration
            notesEnabled={notesEnabled}
            onNotesToggle={toggleNotes}
            onNoteRequest={openNote}
            
            {...graphProps}
          />
        </Box>
      </MobileLayout>

      {/* Mobile Toolbar */}
      {showMobileToolbar && (isMobile || isTablet) && (
        <MobileToolbar
          position={toolbarPosition}
          onSaveLayout={handleSaveLayout}
          onClearLayout={handleClearLayout}
          onUndoLayout={handleUndoLayout}
          onRedoLayout={handleRedoLayout}
          onFitGraph={handleFitGraph}
          onCenterGraph={handleCenterGraph}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          
          // Notes integration
          notesEnabled={notesEnabled}
          onNotesToggle={toggleNotes}
          notesCount={Object.keys(notes).length}
          
          // Layout state
          canUndo={false} // TODO: Wire to actual undo state
          canRedo={false} // TODO: Wire to actual redo state
        />
      )}
    </Box>
  )
}

export default MobileZlfnGraph
