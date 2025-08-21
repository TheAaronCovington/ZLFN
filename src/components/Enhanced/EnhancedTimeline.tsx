import React, { useRef, useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Button,
  ButtonGroup,
  Stack,
  Chip,
  Slider,
  Card,
  CardContent,
  IconButton
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  SkipPrevious as PrevIcon,
  SkipNext as NextIcon,
  ThreeDRotation as ThreeDIcon,
  GetApp as ExportIcon,
  Loop as LoopIcon
} from '@mui/icons-material'
import * as d3 from 'd3'

interface TimelineNode {
  id: string
  label: string
  type: 'premise' | 'intermediate' | 'conclusion'
  timestamp: number
  confidence: number
  rule?: string
  dependencies: string[]
}

interface TimelineEdge {
  from: string
  to: string
  rule: string
  strength: number
  timestamp: number
}

interface EnhancedTimelineProps {
  nodes?: TimelineNode[]
  edges?: TimelineEdge[]
  expression?: string
  onExport?: () => void
}

// Default timeline data for demonstration
const defaultNodes: TimelineNode[] = [
  { id: 'P1', label: 'All humans are mortal', type: 'premise', timestamp: 0, confidence: 1.0, dependencies: [] },
  { id: 'P2', label: 'Socrates is human', type: 'premise', timestamp: 1, confidence: 1.0, dependencies: [] },
  { id: 'T1', label: 'Socrates has human properties', type: 'intermediate', timestamp: 2, confidence: 0.95, rule: 'Universal Instantiation', dependencies: ['P1', 'P2'] },
  { id: 'T2', label: 'Mortality applies to Socrates', type: 'intermediate', timestamp: 3, confidence: 0.92, rule: 'Property Transfer', dependencies: ['T1'] },
  { id: 'C1', label: 'Socrates is mortal', type: 'conclusion', timestamp: 4, confidence: 0.90, rule: 'Modus Ponens', dependencies: ['T2'] },
  { id: 'C2', label: 'Therefore, some humans die', type: 'conclusion', timestamp: 5, confidence: 0.85, rule: 'Existential Generalization', dependencies: ['C1'] }
]

const defaultEdges: TimelineEdge[] = [
  { from: 'P1', to: 'T1', rule: 'Universal Instantiation', strength: 0.95, timestamp: 2 },
  { from: 'P2', to: 'T1', rule: 'Universal Instantiation', strength: 0.95, timestamp: 2 },
  { from: 'T1', to: 'T2', rule: 'Property Transfer', strength: 0.92, timestamp: 3 },
  { from: 'T2', to: 'C1', rule: 'Modus Ponens', strength: 0.90, timestamp: 4 },
  { from: 'C1', to: 'C2', rule: 'Existential Generalization', strength: 0.85, timestamp: 5 }
]

export const EnhancedTimeline: React.FC<EnhancedTimelineProps> = ({
  nodes = defaultNodes,
  edges = defaultEdges,
  expression = '',
  onExport
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [loopMode, setLoopMode] = useState(false)
  const [show3D, setShow3D] = useState(false)
  const [selectedStep, setSelectedStep] = useState<TimelineNode | null>(null)

  // Enhanced dimensions
  const WIDTH = 1000
  const HEIGHT = 500
  const TIMELINE_HEIGHT = 60
  const NODE_RADIUS = 25

  // Animation state
  const maxTime = Math.max(...nodes.map(n => n.timestamp), 0)
  const [animationId, setAnimationId] = useState<number | null>(null)

  // Playback control
  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        setCurrentTime(prev => {
          const next = prev + (0.1 * playbackSpeed)
          if (next > maxTime) {
            if (loopMode) {
              return 0
            } else {
              setIsPlaying(false)
              return maxTime
            }
          }
          return next
        })
        
        if (isPlaying) {
          setAnimationId(requestAnimationFrame(animate))
        }
      }
      
      setAnimationId(requestAnimationFrame(animate))
    } else if (animationId) {
      cancelAnimationFrame(animationId)
      setAnimationId(null)
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [isPlaying, playbackSpeed, loopMode, maxTime, animationId])

  // D3 Timeline Rendering
  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Set up SVG
    svg
      .attr('width', WIDTH)
      .attr('height', HEIGHT)
      .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
      .style('background', 'linear-gradient(135deg, rgba(10, 10, 15, 0.8) 0%, rgba(25, 25, 35, 0.9) 100%)')
      .style('border-radius', '12px')
      .style('border', '1px solid rgba(64, 196, 255, 0.2)')

    // Create enhanced gradients and filters
    const defs = svg.append('defs')
    
    // Glow filter
    const glowFilter = defs.append('filter').attr('id', 'glow')
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur')
    const feMerge = glowFilter.append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'coloredBlur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Timeline gradient
    const timelineGradient = defs.append('linearGradient').attr('id', 'timelineGradient')
    timelineGradient.append('stop').attr('offset', '0%').attr('stop-color', '#40c4ff').attr('stop-opacity', 0.3)
    timelineGradient.append('stop').attr('offset', '100%').attr('stop-color', '#9c27b0').attr('stop-opacity', 0.6)

    // Calculate positions
    const timeScale = d3.scaleLinear()
      .domain([0, maxTime])
      .range([100, WIDTH - 100])

    const yPositions = {
      premise: HEIGHT * 0.2,
      intermediate: HEIGHT * 0.5,
      conclusion: HEIGHT * 0.8
    }

    // Draw timeline axis
    const timelineY = HEIGHT - TIMELINE_HEIGHT
    svg.append('line')
      .attr('x1', 80)
      .attr('y1', timelineY)
      .attr('x2', WIDTH - 80)
      .attr('y2', timelineY)
      .attr('stroke', 'url(#timelineGradient)')
      .attr('stroke-width', 4)
      .attr('filter', 'url(#glow)')

    // Draw time markers
    for (let t = 0; t <= maxTime; t++) {
      const x = timeScale(t)
      svg.append('line')
        .attr('x1', x)
        .attr('y1', timelineY - 10)
        .attr('x2', x)
        .attr('y2', timelineY + 10)
        .attr('stroke', '#40c4ff')
        .attr('stroke-width', 2)
      
      svg.append('text')
        .attr('x', x)
        .attr('y', timelineY + 25)
        .attr('text-anchor', 'middle')
        .attr('fill', '#40c4ff')
        .attr('font-size', '12px')
        .text(`t${t}`)
    }

    // Draw current time indicator
    const currentX = timeScale(currentTime)
    svg.append('line')
      .attr('x1', currentX)
      .attr('y1', 50)
      .attr('x2', currentX)
      .attr('y2', HEIGHT - 30)
      .attr('stroke', '#ff9800')
      .attr('stroke-width', 3)
      .attr('stroke-dasharray', '5,5')
      .attr('filter', 'url(#glow)')

    // Draw edges (connections)
    edges.forEach(edge => {
      const fromNode = nodes.find(n => n.id === edge.from)
      const toNode = nodes.find(n => n.id === edge.to)
      
      if (fromNode && toNode && edge.timestamp <= currentTime) {
        const x1 = timeScale(fromNode.timestamp)
        const y1 = yPositions[fromNode.type]
        const x2 = timeScale(toNode.timestamp)
        const y2 = yPositions[toNode.type]
        
        // Create curved path
        const midX = (x1 + x2) / 2
        const midY = Math.min(y1, y2) - 50
        
        const pathData = `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`
        
        svg.append('path')
          .attr('d', pathData)
          .attr('fill', 'none')
          .attr('stroke', d3.interpolateViridis(edge.strength))
          .attr('stroke-width', 3)
          .attr('opacity', edge.timestamp <= currentTime ? 1 : 0.3)
          .attr('filter', 'url(#glow)')
          .style('cursor', 'pointer')
          .append('title')
          .text(`${edge.rule} (Strength: ${(edge.strength * 100).toFixed(0)}%)`)
        
        // Add arrowhead
        if (edge.timestamp <= currentTime) {
          const angle = Math.atan2(y2 - midY, x2 - midX)
          const arrowLength = 10
          const arrowX = x2 - arrowLength * Math.cos(angle)
          const arrowY = y2 - arrowLength * Math.sin(angle)
          
          svg.append('polygon')
            .attr('points', `${x2},${y2} ${arrowX - 5 * Math.sin(angle)},${arrowY + 5 * Math.cos(angle)} ${arrowX + 5 * Math.sin(angle)},${arrowY - 5 * Math.cos(angle)}`)
            .attr('fill', d3.interpolateViridis(edge.strength))
            .attr('filter', 'url(#glow)')
        }
      }
    })

    // Draw nodes
    nodes.forEach(node => {
      const x = timeScale(node.timestamp)
      const y = yPositions[node.type]
      const isActive = node.timestamp <= currentTime
      const isSelected = selectedStep?.id === node.id
      
      // Node circle
      const nodeGroup = svg.append('g')
        .attr('class', 'timeline-node')
        .style('cursor', 'pointer')
        .on('click', () => setSelectedStep(node))
      
      nodeGroup.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', NODE_RADIUS)
        .attr('fill', isActive ? 
          (node.type === 'premise' ? '#40c4ff' :
           node.type === 'intermediate' ? '#00e676' : '#9c27b0') :
          'rgba(255, 255, 255, 0.2)')
        .attr('stroke', isSelected ? '#ff9800' : 'rgba(255, 255, 255, 0.5)')
        .attr('stroke-width', isSelected ? 4 : 2)
        .attr('opacity', isActive ? 1 : 0.4)
        .attr('filter', isActive ? 'url(#glow)' : 'none')
        .transition()
        .duration(300)
        .attr('r', isSelected ? NODE_RADIUS + 5 : NODE_RADIUS)
      
      // Node label
      nodeGroup.append('text')
        .attr('x', x)
        .attr('y', y - NODE_RADIUS - 10)
        .attr('text-anchor', 'middle')
        .attr('fill', isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.5)')
        .attr('font-size', '12px')
        .attr('font-weight', '600')
        .text(node.id)
      
      // Confidence indicator
      if (isActive && node.confidence < 1.0) {
        nodeGroup.append('circle')
          .attr('cx', x + NODE_RADIUS - 5)
          .attr('cy', y - NODE_RADIUS + 5)
          .attr('r', 8)
          .attr('fill', node.confidence > 0.8 ? '#00e676' : node.confidence > 0.6 ? '#ff9800' : '#f44336')
          .attr('opacity', 0.8)
        
        nodeGroup.append('text')
          .attr('x', x + NODE_RADIUS - 5)
          .attr('y', y - NODE_RADIUS + 9)
          .attr('text-anchor', 'middle')
          .attr('fill', '#000')
          .attr('font-size', '10px')
          .attr('font-weight', '700')
          .text(Math.round(node.confidence * 100))
      }
      
      // Tooltip
      nodeGroup.append('title')
        .text(`${node.label}\nConfidence: ${(node.confidence * 100).toFixed(0)}%${node.rule ? `\nRule: ${node.rule}` : ''}`)
    })

    // Add type labels
    Object.entries(yPositions).forEach(([type, y]) => {
      svg.append('text')
        .attr('x', 20)
        .attr('y', y + 5)
        .attr('fill', 
          type === 'premise' ? '#40c4ff' :
          type === 'intermediate' ? '#00e676' : '#9c27b0')
        .attr('font-size', '14px')
        .attr('font-weight', '600')
        .attr('text-transform', 'capitalize')
        .text(type)
    })

  }, [nodes, edges, currentTime, maxTime, selectedStep])

  const handlePlay = () => setIsPlaying(!isPlaying)
  const handleStop = () => {
    setIsPlaying(false)
    setCurrentTime(0)
  }
  const handlePrevious = () => {
    const prevTime = Math.max(0, Math.floor(currentTime) - 1)
    setCurrentTime(prevTime)
  }
  const handleNext = () => {
    const nextTime = Math.min(maxTime, Math.floor(currentTime) + 1)
    setCurrentTime(nextTime)
  }
  // Reset functionality handled by handleStop

  const handleExport = () => {
    if (!svgRef.current) return
    
    const svgData = new XMLSerializer().serializeToString(svgRef.current)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)
    
    const downloadLink = document.createElement('a')
    downloadLink.href = svgUrl
    downloadLink.download = 'timeline-analysis.svg'
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
    URL.revokeObjectURL(svgUrl)
    
    onExport?.()
  }

  const currentStep = nodes.find(n => Math.abs(n.timestamp - Math.round(currentTime)) < 0.5)

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Controls Row */}
      <Box sx={{ p: 3, borderBottom: '1px solid rgba(64, 196, 255, 0.2)' }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" sx={{ color: '#ffffff', fontFamily: 'monospace' }}>
              {expression || 'Logical Development Timeline'}
            </Typography>
          </Box>
          
          <Stack direction="row" spacing={2} alignItems="center">
            {/* Playback Controls */}
            <ButtonGroup variant="outlined" size="small">
              <IconButton onClick={handlePrevious} sx={{ color: '#40c4ff', borderColor: '#40c4ff' }}>
                <PrevIcon />
              </IconButton>
              <IconButton onClick={handlePlay} sx={{ color: isPlaying ? '#ff9800' : '#00e676', borderColor: isPlaying ? '#ff9800' : '#00e676' }}>
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </IconButton>
              <IconButton onClick={handleStop} sx={{ color: '#f44336', borderColor: '#f44336' }}>
                <StopIcon />
              </IconButton>
              <IconButton onClick={handleNext} sx={{ color: '#40c4ff', borderColor: '#40c4ff' }}>
                <NextIcon />
              </IconButton>
            </ButtonGroup>
            
            {/* Speed Control */}
            <Box sx={{ minWidth: 120 }}>
              <Typography variant="caption" sx={{ color: '#ffffff' }}>Speed</Typography>
              <Slider
                value={playbackSpeed}
                onChange={(_, value) => setPlaybackSpeed(value as number)}
                min={0.1}
                max={3}
                step={0.1}
                size="small"
                sx={{
                  color: '#40c4ff',
                  '& .MuiSlider-thumb': { backgroundColor: '#40c4ff' },
                  '& .MuiSlider-track': { backgroundColor: '#40c4ff' }
                }}
              />
            </Box>
            
            {/* Additional Controls */}
            <ButtonGroup variant="outlined" size="small">
              <Button
                startIcon={<LoopIcon />}
                onClick={() => setLoopMode(!loopMode)}
                sx={{ color: loopMode ? '#9c27b0' : '#ffffff', borderColor: loopMode ? '#9c27b0' : '#ffffff' }}
              >
                Loop
              </Button>
              <Button
                startIcon={<ThreeDIcon />}
                onClick={() => setShow3D(!show3D)}
                sx={{ color: show3D ? '#9c27b0' : '#ffffff', borderColor: show3D ? '#9c27b0' : '#ffffff' }}
              >
                3D
              </Button>
              <Button
                startIcon={<ExportIcon />}
                onClick={handleExport}
                sx={{ color: '#ff9800', borderColor: '#ff9800' }}
              >
                Export
              </Button>
            </ButtonGroup>
          </Stack>
        </Stack>
      </Box>

      {/* Main Timeline Visualization */}
      <Box sx={{ flexGrow: 1, p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Box sx={{ position: 'relative' }}>
          <svg
            ref={svgRef}
            style={{
              maxWidth: '100%',
              height: 'auto',
              filter: show3D ? 'perspective(1000px) rotateX(10deg)' : 'none',
              transition: 'filter 0.5s ease'
            }}
          />
          
          {/* Time scrubber */}
          <Box sx={{ position: 'absolute', bottom: -40, left: 100, right: 100 }}>
            <Slider
              value={currentTime}
              onChange={(_, value) => setCurrentTime(value as number)}
              min={0}
              max={maxTime}
              step={0.1}
              sx={{
                color: '#ff9800',
                '& .MuiSlider-thumb': { 
                  backgroundColor: '#ff9800',
                  width: 16,
                  height: 16
                },
                '& .MuiSlider-track': { backgroundColor: '#ff9800' },
                '& .MuiSlider-rail': { backgroundColor: 'rgba(255, 152, 0, 0.3)' }
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* Current Step Analysis */}
      <Box sx={{ p: 3, borderTop: '1px solid rgba(64, 196, 255, 0.2)' }}>
        <Card sx={{ backgroundColor: 'rgba(64, 196, 255, 0.05)', border: '1px solid rgba(64, 196, 255, 0.2)' }}>
          <CardContent>
            <Typography variant="h6" sx={{ color: '#40c4ff', mb: 2 }}>
              Current Step Analysis
            </Typography>
            {currentStep ? (
              <Stack direction="row" spacing={4} alignItems="center">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    🎯 Step {Math.round(currentTime)}:
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 500 }}>
                    {currentStep.rule || 'Initial State'}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    ⚡ Confidence:
                  </Typography>
                  <Chip
                    label={`${(currentStep.confidence * 100).toFixed(0)}%`}
                    size="small"
                    sx={{
                      backgroundColor: currentStep.confidence > 0.8 ? 'rgba(0, 230, 118, 0.2)' : 
                                     currentStep.confidence > 0.6 ? 'rgba(255, 152, 0, 0.2)' : 'rgba(244, 67, 54, 0.2)',
                      color: currentStep.confidence > 0.8 ? '#00e676' : 
                             currentStep.confidence > 0.6 ? '#ff9800' : '#f44336'
                    }}
                  />
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    📊 Progress:
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9c27b0', fontWeight: 500 }}>
                    {Math.round((currentTime / maxTime) * 100)}%
                  </Typography>
                </Box>
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Use playback controls to analyze the logical development timeline
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}

export default EnhancedTimeline
