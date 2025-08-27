import React, { useRef, useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Button,
  ButtonGroup,
  Stack,
  Chip,
  Card,
  CardContent,
  Paper
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Refresh as ResetIcon,
  ThreeDRotation as ThreeDIcon,
  GetApp as DownloadIcon
} from '@mui/icons-material'
import * as d3 from 'd3'
import type { VennDiagramData, NecessarySufficientExample } from '../Visualizations/VennDiagram'

interface EnhancedVennDiagramProps {
  data: VennDiagramData
  examples?: NecessarySufficientExample[]
  expression?: string
  onExport?: () => void
}

export const EnhancedVennDiagram: React.FC<EnhancedVennDiagramProps> = ({
  data,
  examples = [],
  expression = '',
  onExport
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [show3D, setShow3D] = useState(false)
  const [selectedExample, setSelectedExample] = useState<string>('')
  const [hoveredSet, setHoveredSet] = useState<string | null>(null)

  // Enhanced dimensions for prominence
  const WIDTH = 1000
  const HEIGHT = 600

  // Animation state
  const [animationFrame, setAnimationFrame] = useState(0)

  useEffect(() => {
    
    if (!svgRef.current) {
      return
    }
    
    // Debug logging
    console.debug('[EnhancedVennDiagram] Rendering with data:', {
      shouldRenderAsSubset: data.shouldRenderAsSubset,
      subsetDirection: data.subsetDirection,
      description: data.description,
      setsCount: data.sets?.length
    })

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Set up SVG with enhanced styling
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
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur')
    const feMerge = glowFilter.append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'coloredBlur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Enhanced gradients for sets
    const gradientA = defs.append('radialGradient').attr('id', 'gradientA')
    gradientA.append('stop').attr('offset', '0%').attr('stop-color', '#40c4ff').attr('stop-opacity', 0.6)
    gradientA.append('stop').attr('offset', '100%').attr('stop-color', '#1976d2').attr('stop-opacity', 0.3)

    const gradientB = defs.append('radialGradient').attr('id', 'gradientB')
    gradientB.append('stop').attr('offset', '0%').attr('stop-color', '#00e676').attr('stop-opacity', 0.6)
    gradientB.append('stop').attr('offset', '100%').attr('stop-color', '#2e7d32').attr('stop-opacity', 0.3)

    // Intersection gradient
    const intersectionGradient = defs.append('radialGradient').attr('id', 'intersectionGradient')
    intersectionGradient.append('stop').attr('offset', '0%').attr('stop-color', '#9c27b0').attr('stop-opacity', 0.8)
    intersectionGradient.append('stop').attr('offset', '100%').attr('stop-color', '#673ab7').attr('stop-opacity', 0.4)

    // Calculate positions for enhanced layout
    const centerX = WIDTH / 2
    const centerY = HEIGHT / 2
    const defaultRadius = Math.min(WIDTH, HEIGHT) * 0.25
    const separation = defaultRadius * 0.8

    // Enhanced set rendering with subset relationship support
    let setA, setB
    
    // Force subset rendering for necessary/sufficient conditions based on description
    const isNecessaryCondition = data.description?.includes('necessary condition')
    const isSufficientCondition = data.description?.includes('sufficient')
    
    console.debug('[EnhancedVennDiagram] Subset check:', {
      shouldRenderAsSubset: data.shouldRenderAsSubset,
      subsetDirection: data.subsetDirection,
      isNecessaryCondition,
      isSufficientCondition,
      description: data.description
    })
    
    if ((data.shouldRenderAsSubset && data.subsetDirection) || isNecessaryCondition || isSufficientCondition) {
      // Render as subset relationship
      if (data.subsetDirection === 'A_in_B' || isNecessaryCondition) {
        // For "X is necessary condition for Y" -> Y ⊆ X (Y inside X)
        // So setA (X) should be outer, setB (Y) should be inner
        setA = {
          x: centerX,
          y: centerY,
          radius: 180, // Outer circle (X)
          label: data.sets[0]?.label || 'X',
          items: data.sets[0]?.items || [],
          color: data.sets[0]?.color || '#40c4ff'
        }
        setB = {
          x: centerX,
          y: centerY,
          radius: 120, // Inner circle (Y)
          label: data.sets[1]?.label || 'Y',
          items: data.sets[1]?.items || [],
          color: data.sets[1]?.color || '#00e676'
        }
      } else {
        // B is inside A (B ⊆ A)
        setB = {
          x: centerX,
          y: centerY,
          radius: 180, // Outer circle
          label: data.sets[1]?.label || 'B',
          items: data.sets[1]?.items || [],
          color: data.sets[1]?.color || '#00e676'
        }
        setA = {
          x: centerX,
          y: centerY,
          radius: 120, // Inner circle
          label: data.sets[0]?.label || 'A',
          items: data.sets[0]?.items || [],
          color: data.sets[0]?.color || '#40c4ff'
        }
      }
    } else {
      // Standard overlapping circles or use position overrides
      setA = {
        x: data.sets[0]?.position?.x || (centerX - separation / 2),
        y: data.sets[0]?.position?.y || centerY,
        radius: data.sets[0]?.position?.radius || defaultRadius,
        label: data.sets[0]?.label || 'A',
        items: data.sets[0]?.items || [],
        color: data.sets[0]?.color || '#40c4ff'
      }

      setB = {
        x: data.sets[1]?.position?.x || (centerX + separation / 2),
        y: data.sets[1]?.position?.y || centerY,
        radius: data.sets[1]?.position?.radius || defaultRadius,
        label: data.sets[1]?.label || 'B',
        items: data.sets[1]?.items || [],
        color: data.sets[1]?.color || '#00e676'
      }
    }

    // Render Set B first (outer circle for subset relationships)
    const groupB = svg.append('g').attr('class', 'set-b')
    groupB
      .append('circle')
      .attr('cx', setB.x)
      .attr('cy', setB.y)
      .attr('r', setB.radius)
      .attr('fill', 'url(#gradientB)')
      .attr('stroke', setB.color)
      .attr('stroke-width', 3)
      .attr('filter', 'url(#glow)')
      .style('cursor', 'pointer')
      .on('mouseenter', () => setHoveredSet('B'))
      .on('mouseleave', () => setHoveredSet(null))
      .transition()
      .duration(1000)
      .attr('r', setB.radius)

    // Render Set A second (inner circle for subset relationships)
    const groupA = svg.append('g').attr('class', 'set-a')
    groupA
      .append('circle')
      .attr('cx', setA.x)
      .attr('cy', setA.y)
      .attr('r', setA.radius)
      .attr('fill', 'url(#gradientA)')
      .attr('stroke', setA.color)
      .attr('stroke-width', 3)
      .attr('filter', 'url(#glow)')
      .style('cursor', 'pointer')
      .on('mouseenter', () => setHoveredSet('A'))
      .on('mouseleave', () => setHoveredSet(null))
      .transition()
      .duration(1000)
      .attr('r', setA.radius)

    // Enhanced intersection rendering
    if (data.intersection && data.intersection.length > 0) {
      const intersectionGroup = svg.append('g').attr('class', 'intersection')
      
      // Calculate intersection area
      const d = Math.abs(setA.x - setB.x)
      if (d < setA.radius + setB.radius) {
        // Create intersection path
        const r1 = setA.radius
        const r2 = setB.radius
        const x1 = setA.x
        const y1 = setA.y
        const x2 = setB.x
        const y2 = setB.y
        
        // Intersection lens shape
        const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d)
        const h = Math.sqrt(r1 * r1 - a * a)
        
        const px = x1 + a * (x2 - x1) / d
        const py1 = y1 + h * (y2 - y1) / d
        const py2 = y1 - h * (y2 - y1) / d
        
        const pathData = `
          M ${px} ${py1}
          A ${r1} ${r1} 0 0 1 ${px} ${py2}
          A ${r2} ${r2} 0 0 1 ${px} ${py1}
        `
        
        intersectionGroup
          .append('path')
          .attr('d', pathData)
          .attr('fill', 'url(#intersectionGradient)')
          .attr('stroke', '#9c27b0')
          .attr('stroke-width', 2)
          .attr('filter', 'url(#glow)')
          .style('cursor', 'pointer')
          .on('mouseenter', () => setHoveredSet('intersection'))
          .on('mouseleave', () => setHoveredSet(null))
      }
    }

    // Enhanced labels with better positioning to avoid overlap
    const labelOffsetY = 30
    
    // Remove unnecessary description text as requested
    
    // Position labels based on circle arrangement and subset relationships
    const isSubsetRendering = (data.shouldRenderAsSubset && data.subsetDirection) || isNecessaryCondition || isSufficientCondition
    
    if (isSubsetRendering) {
      // For subset relationships, position labels to avoid overlap
      const outerRadius = Math.max(setA.radius, setB.radius)
      const innerRadius = Math.min(setA.radius, setB.radius)
      
      // Determine which is outer and which is inner
      const isAOuter = setA.radius > setB.radius
      const outerSet = isAOuter ? setA : setB
      const innerSet = isAOuter ? setB : setA
      
      // Outer circle label above
      svg.append('text')
        .attr('x', outerSet.x)
        .attr('y', outerSet.y - outerRadius - labelOffsetY)
        .attr('text-anchor', 'middle')
        .attr('fill', outerSet.color)
        .attr('font-size', '20px')
        .attr('font-weight', '600')
        .attr('text-shadow', `0 0 10px ${outerSet.color}50`)
        .text(outerSet.label)
        
      // Inner circle label below
      svg.append('text')
        .attr('x', innerSet.x)
        .attr('y', innerSet.y + innerRadius + 25)
        .attr('text-anchor', 'middle')
        .attr('fill', innerSet.color)
        .attr('font-size', '18px')
        .attr('font-weight', '600')
        .attr('text-shadow', `0 0 10px ${innerSet.color}50`)
        .text(innerSet.label)
    } else {
      // Standard overlapping circles - position labels normally
      svg.append('text')
        .attr('x', setA.x)
        .attr('y', setA.y - setA.radius - labelOffsetY)
        .attr('text-anchor', 'middle')
        .attr('fill', setA.color)
        .attr('font-size', '20px')
        .attr('font-weight', '600')
        .attr('text-shadow', `0 0 10px ${setA.color}50`)
        .text(setA.label)

      svg.append('text')
        .attr('x', setB.x)
        .attr('y', setB.y - setB.radius - labelOffsetY)
        .attr('text-anchor', 'middle')
        .attr('fill', setB.color)
        .attr('font-size', '20px')
        .attr('font-weight', '600')
        .attr('text-shadow', `0 0 10px ${setB.color}50`)
        .text(setB.label)
    }

    // Add enhanced particle effects and animations
    if (isAnimating) {
      
      // Pulsing effect for circles - target the actual circles, not '.venn-circle' class
      svg.selectAll('circle')
        .filter(function() { 
          return d3.select(this).attr('class') !== 'particle'
        })
        .transition()
        .duration(1000)
        .attr('stroke-width', 5)
        .style('fill-opacity', 0.8)
        .transition()
        .duration(1000)
        .attr('stroke-width', 3)
        .style('fill-opacity', 0.4)
      
      // Particle effects - always create some particles for visual feedback
      const particles = svg.append('g').attr('class', 'particles')
      
      for (let i = 0; i < 30; i++) {
        const angle = (i / 30) * 2 * Math.PI
        const startRadius = 50
        const endRadius = 200
        
        particles
          .append('circle')
          .attr('class', 'particle')
          .attr('cx', centerX + Math.cos(angle) * startRadius)
          .attr('cy', centerY + Math.sin(angle) * startRadius)
          .attr('r', 2)
          .attr('fill', '#9c27b0')
          .attr('opacity', 0.9)
          .transition()
          .duration(2500)
          .attr('cx', centerX + Math.cos(angle) * endRadius)
          .attr('cy', centerY + Math.sin(angle) * endRadius)
          .attr('r', 6)
          .attr('opacity', 0)
          .remove()
      }
      
      // Glowing intersection highlight
      svg.append('circle')
        .attr('class', 'glow-ring')
        .attr('cx', centerX)
        .attr('cy', centerY)
        .attr('r', 20)
        .attr('fill', 'none')
        .attr('stroke', '#9c27b0')
        .attr('stroke-width', 4)
        .attr('opacity', 0.9)
        .transition()
        .duration(2000)
        .attr('r', 120)
        .attr('stroke-width', 1)
        .attr('opacity', 0)
        .remove()
        
      // Additional ripple effect
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          svg.append('circle')
            .attr('class', 'ripple')
            .attr('cx', centerX)
            .attr('cy', centerY)
            .attr('r', 10)
            .attr('fill', 'none')
            .attr('stroke', '#40c4ff')
            .attr('stroke-width', 2)
            .attr('opacity', 0.6)
            .transition()
            .duration(1500)
            .attr('r', 100)
            .attr('opacity', 0)
            .remove()
        }, i * 500)
      }
    } else {
      
    }

  }, [data, isAnimating, animationFrame, hoveredSet])

  const handleAnimate = () => {
    
    setIsAnimating(true)
    setAnimationFrame(f => f + 1)
    
    setTimeout(() => {
      setIsAnimating(false)
      
    }, 3000)
  }

  const handleReset = () => {
    setAnimationFrame(f => f + 1)
    setHoveredSet(null)
    setSelectedExample('')
  }

  const handleExport = () => {
    if (!svgRef.current) return
    
    const svgData = new XMLSerializer().serializeToString(svgRef.current)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)
    
    const downloadLink = document.createElement('a')
    downloadLink.href = svgUrl
    downloadLink.download = 'venn-diagram.svg'
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
    URL.revokeObjectURL(svgUrl)
    
    onExport?.()
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Controls Row */}
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(64, 196, 255, 0.2)', flexShrink: 0 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" sx={{ color: '#ffffff', fontFamily: 'monospace' }}>
              {expression || '(A ∧ B) → C'}
            </Typography>
          </Box>
          
          <ButtonGroup variant="outlined" size="small">
            <Button
              startIcon={<PlayIcon />}
              onClick={handleAnimate}
              disabled={isAnimating}
              sx={{ color: '#00e676', borderColor: '#00e676' }}
            >
              {isAnimating ? 'Animating...' : 'Animate'}
            </Button>
            <Button
              startIcon={<ResetIcon />}
              onClick={handleReset}
              sx={{ color: '#40c4ff', borderColor: '#40c4ff' }}
            >
              Reset
            </Button>
            <Button
              startIcon={<ThreeDIcon />}
              onClick={() => {
                
                setShow3D(!show3D)
              }}
              sx={{ color: show3D ? '#9c27b0' : '#ffffff', borderColor: show3D ? '#9c27b0' : '#ffffff' }}
            >
              3D View
            </Button>
            <Button
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              sx={{ color: '#ff9800', borderColor: '#ff9800' }}
            >
              Export SVG
            </Button>
          </ButtonGroup>
        </Stack>
      </Box>

      {/* Scrollable Content */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Main Visualization Row */}
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <Box 
            sx={{ 
              position: 'relative',
              perspective: show3D ? '1000px' : 'none',
              transition: 'all 0.5s ease'
            }}
          >
            <svg
              ref={svgRef}
              style={{
                maxWidth: '100%',
                height: 'auto',
                transform: show3D ? 'rotateX(15deg) rotateY(5deg)' : 'rotateX(0deg) rotateY(0deg)',
                transition: 'transform 0.5s ease',
                transformStyle: 'preserve-3d',
                filter: show3D ? 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' : 'none'
              }}
            />
            
            {/* Overlay information */}
            {hoveredSet && (
              <Paper
                sx={{
                  position: 'absolute',
                  top: 20,
                  right: 20,
                  p: 2,
                  backgroundColor: 'rgba(25, 25, 35, 0.9)',
                  border: '1px solid rgba(64, 196, 255, 0.3)',
                  borderRadius: 2,
                  backdropFilter: 'blur(10px)'
                }}
              >
                <Typography variant="h6" sx={{ color: '#40c4ff', mb: 1 }}>
                  {hoveredSet === 'intersection' ? 'Intersection' : `Set ${hoveredSet}`}
                </Typography>
                <Typography variant="body2" sx={{ color: '#ffffff' }}>
                  {hoveredSet === 'A' && `Items: ${data.sets[0]?.items?.length || 0}`}
                  {hoveredSet === 'B' && `Items: ${data.sets[1]?.items?.length || 0}`}
                  {hoveredSet === 'intersection' && `Common: ${data.intersection?.length || 0}`}
                </Typography>
              </Paper>
            )}
          </Box>
        </Box>

        {/* Supporting Information Row */}
        <Box sx={{ p: 3, borderTop: '1px solid rgba(64, 196, 255, 0.2)', flexShrink: 0 }}>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {/* Legend & Set Details */}
            <Box sx={{ flex: '1 1 300px', minWidth: 300 }}>
              <Card sx={{ backgroundColor: 'rgba(64, 196, 255, 0.05)', border: '1px solid rgba(64, 196, 255, 0.2)', height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#40c4ff', mb: 2 }}>
                    Legend & Set Details
                  </Typography>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: '#40c4ff' }} />
                      <Typography variant="body2" sx={{ color: '#ffffff' }}>
                        Set {data.sets[0]?.label || 'A'}: {data.sets[0]?.items?.length || 0} items
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: '#00e676' }} />
                      <Typography variant="body2" sx={{ color: '#ffffff' }}>
                        Set {data.sets[1]?.label || 'B'}: {data.sets[1]?.items?.length || 0} items
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: '#9c27b0' }} />
                      <Typography variant="body2" sx={{ color: '#ffffff' }}>
                        Intersection: {data.intersection?.length || 0} items
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Box>

            {/* Examples & Scenarios */}
            <Box sx={{ flex: '1 1 300px', minWidth: 300 }}>
              <Card sx={{ backgroundColor: 'rgba(0, 230, 118, 0.05)', border: '1px solid rgba(0, 230, 118, 0.2)', height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#00e676', mb: 2 }}>
                    Examples & Scenarios
                  </Typography>
                  <Stack spacing={1}>
                    {examples.length > 0 ? examples.map((example) => (
                      <Chip
                        key={example.id}
                        label={example.title}
                        variant={selectedExample === example.id ? 'filled' : 'outlined'}
                        onClick={() => setSelectedExample(example.id)}
                        sx={{
                          color: selectedExample === example.id ? '#000' : '#00e676',
                          backgroundColor: selectedExample === example.id ? '#00e676' : 'transparent',
                          borderColor: '#00e676'
                        }}
                      />
                    )) : (
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        No examples available for this logical relationship
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Box>

            {/* Analysis & Relationships */}
            <Box sx={{ flex: '1 1 300px', minWidth: 300 }}>
              <Card sx={{ backgroundColor: 'rgba(156, 39, 176, 0.05)', border: '1px solid rgba(156, 39, 176, 0.2)', height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#9c27b0', mb: 2 }}>
                    Analysis & Relationships
                  </Typography>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        ⚡ Logical Strength
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#9c27b0', fontWeight: 500 }}>
                        {Math.round((data.sets[0]?.items?.length || 1) * 85 / 10)}%
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        📊 Coverage
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#9c27b0', fontWeight: 500 }}>
                        {Math.round((data.intersection?.length || 0) * 100 / Math.max(1, (data.sets[0]?.items?.length || 1)))}%
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        🎯 Precision
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#9c27b0', fontWeight: 500 }}>
                        {Math.round((data.sets[1]?.items?.length || 1) * 78 / 10)}%
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default EnhancedVennDiagram
