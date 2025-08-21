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
  LinearProgress
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Refresh as ResetIcon,
  ThreeDRotation as ThreeDIcon,
  GetApp as DownloadIcon,
  AccountTree as LayoutIcon
} from '@mui/icons-material'
import * as d3 from 'd3'

// Data interfaces for counterarguments
export interface ArgumentNode {
  id: string
  label: string
  type: 'premise' | 'conclusion' | 'counterargument' | 'rebuttal' | 'support'
  content?: string
  strength?: number
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

export interface ArgumentRelationship {
  source: string | ArgumentNode
  target: string | ArgumentNode
  type: 'supports' | 'attacks' | 'undercuts' | 'rebuts'
  strength: number
  rule?: string
}

export interface ConflictZone {
  id: string
  nodes: string[]
  severity: 'low' | 'medium' | 'high'
  description: string
}

export interface FallacyDetection {
  id: string
  type: string
  description: string
  severity: 'minor' | 'major' | 'critical'
  affectedNodes: string[]
}

export interface CounterargumentData {
  mainArgument: ArgumentNode
  nodes: ArgumentNode[]
  relationships: ArgumentRelationship[]
  conflicts: ConflictZone[]
  fallacies: FallacyDetection[]
}

interface EnhancedCounterargumentsProps {
  data: CounterargumentData
  expression?: string
  nodeId?: string
  onExport?: () => void
}

export const EnhancedCounterarguments: React.FC<EnhancedCounterargumentsProps> = ({
  data,
  expression = '',
  nodeId = '',
  onExport
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [show3D, setShow3D] = useState(false)
  const [layoutMode, setLayoutMode] = useState<'force' | 'hierarchical' | 'circular'>('force')
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [, setFocusedConflict] = useState<string | null>(null)

  // Enhanced dimensions for prominence
  const WIDTH = 1000
  const HEIGHT = 600

  // Animation state
  const [animationFrame, setAnimationFrame] = useState(0)

  useEffect(() => {
    
    if (!svgRef.current) {
      
      return
    }

    // Error boundary for D3 operations
    try {

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Set up SVG with enhanced styling
    svg
      .attr('width', WIDTH)
      .attr('height', HEIGHT)
      .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
      .style('background', 'linear-gradient(135deg, rgba(10, 10, 15, 0.8) 0%, rgba(25, 25, 35, 0.9) 100%)')
      .style('border-radius', '12px')
      .style('border', '1px solid rgba(255, 82, 82, 0.2)')

    // Create enhanced gradients and filters
    const defs = svg.append('defs')
    
    // Glow filter
    const glowFilter = defs.append('filter').attr('id', 'glow-counter')
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur')
    const feMerge = glowFilter.append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'coloredBlur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Gradients for different node types
    const supportGradient = defs.append('radialGradient').attr('id', 'supportGradient')
    supportGradient.append('stop').attr('offset', '0%').attr('stop-color', '#4caf50').attr('stop-opacity', 0.8)
    supportGradient.append('stop').attr('offset', '100%').attr('stop-color', '#2e7d32').attr('stop-opacity', 0.4)

    const attackGradient = defs.append('radialGradient').attr('id', 'attackGradient')
    attackGradient.append('stop').attr('offset', '0%').attr('stop-color', '#f44336').attr('stop-opacity', 0.8)
    attackGradient.append('stop').attr('offset', '100%').attr('stop-color', '#c62828').attr('stop-opacity', 0.4)

    const neutralGradient = defs.append('radialGradient').attr('id', 'neutralGradient')
    neutralGradient.append('stop').attr('offset', '0%').attr('stop-color', '#2196f3').attr('stop-opacity', 0.8)
    neutralGradient.append('stop').attr('offset', '100%').attr('stop-color', '#1565c0').attr('stop-opacity', 0.4)

    // Prepare data for D3 force simulation
    const nodes = data.nodes.map(n => ({ ...n }))
    const links = data.relationships.map(r => ({ ...r }))

    // Create force simulation based on layout mode
    let simulation: d3.Simulation<ArgumentNode, ArgumentRelationship>

    if (layoutMode === 'force') {
      simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100).strength(0.8))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(WIDTH / 2, HEIGHT / 2))
        .force('collision', d3.forceCollide().radius(30))
    } else if (layoutMode === 'hierarchical') {
      // Safe hierarchical layout without stratify
      
      // Find root nodes (nodes with no incoming support links)
      const rootNodes = nodes.filter(node => 
        !links.some(link => 
          (link.target as ArgumentNode).id === node.id && link.type === 'supports'
        )
      )
      
      
      // Position nodes in layers
      const layers: ArgumentNode[][] = []
      const visited = new Set<string>()
      
      // Layer 0: Root nodes
      layers[0] = rootNodes
      rootNodes.forEach(node => visited.add(node.id))
      
      // Build subsequent layers
      let currentLayer = 0
      while (layers[currentLayer] && layers[currentLayer].length > 0) {
        const nextLayer: ArgumentNode[] = []
        
        layers[currentLayer].forEach(node => {
          // Find children (nodes that this node supports)
          const children = links
            .filter(link => 
              (link.source as ArgumentNode).id === node.id && 
              link.type === 'supports' &&
              !visited.has((link.target as ArgumentNode).id)
            )
            .map(link => nodes.find(n => n.id === (link.target as ArgumentNode).id))
            .filter((n): n is ArgumentNode => n !== undefined)
          
          children.forEach(child => {
            if (!visited.has(child.id)) {
              nextLayer.push(child)
              visited.add(child.id)
            }
          })
        })
        
        if (nextLayer.length > 0) {
          layers[currentLayer + 1] = nextLayer
          currentLayer++
        } else {
          break
        }
      }
      
      // Add any remaining nodes (counterarguments, isolated nodes) to final layer
      const remainingNodes = nodes.filter(node => !visited.has(node.id))
      if (remainingNodes.length > 0) {
        layers[currentLayer + 1] = remainingNodes
      }
      
      
      // Position nodes in layers
      const layerHeight = (HEIGHT - 100) / Math.max(1, layers.length - 1)
      
      layers.forEach((layer, layerIndex) => {
        const layerWidth = WIDTH - 100
        const nodeSpacing = layerWidth / Math.max(1, layer.length + 1)
        
        layer.forEach((node, nodeIndex) => {
          node.fx = 50 + nodeSpacing * (nodeIndex + 1)
          node.fy = 50 + layerHeight * layerIndex
        })
      })

      simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id((d: any) => d.id).distance(80))
        .force('collision', d3.forceCollide().radius(25))
    } else {
      // Circular layout
      const radius = Math.min(WIDTH, HEIGHT) / 3
      const angleStep = (2 * Math.PI) / nodes.length
      
      nodes.forEach((node, i) => {
        node.fx = WIDTH / 2 + radius * Math.cos(i * angleStep)
        node.fy = HEIGHT / 2 + radius * Math.sin(i * angleStep)
      })

      simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id((d: any) => d.id).distance(60))
        .force('collision', d3.forceCollide().radius(25))
    }

    // Draw conflict zones first (background) - but position them after simulation starts
    const conflictGroup = svg.append('g').attr('class', 'conflicts')
    const conflictZones: any[] = []
    
    
    data.conflicts.forEach((conflict, _index) => {
      
      const conflictNodes = nodes.filter(n => conflict.nodes.includes(n.id))
      
      if (conflictNodes.length < 2) {
        
        return
      }

      const conflictColor = conflict.severity === 'high' ? '#ff5252' : 
                           conflict.severity === 'medium' ? '#ff9800' : '#ffeb3b'

      
      // Create conflict zone background - start hidden until positioned
      const zone = conflictGroup.append('g')
        .attr('class', 'conflict-zone')
        .attr('data-conflict-id', conflict.id)
        .style('opacity', 0) // Start hidden
      
      const circle = zone.append('circle')
        .attr('r', 0)
        .attr('fill', conflictColor)
        .attr('fill-opacity', 0.1)
        .attr('stroke', conflictColor)
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.3)
        .attr('stroke-dasharray', '5,5')
        .style('cursor', 'pointer')
        .on('click', () => {
          
          setFocusedConflict(conflict.id)
        })

      // Add conflict label
      zone.append('text')
        .attr('y', -90)
        .attr('text-anchor', 'middle')
        .attr('fill', conflictColor)
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .text(`${conflict.severity.toUpperCase()} CONFLICT`)
        .style('pointer-events', 'none')

      
      conflictZones.push({ zone, circle, conflictNodes, conflictColor, conflictId: conflict.id })
    })

    
    // Position conflict zones - handle both simulation and fixed layouts
    const positionConflictZones = () => {
      
      conflictZones.forEach(({ zone, circle, conflictNodes, conflictId: _conflictId }, _index) => {
        // Check node positions
        
        
        const avgX = d3.mean(conflictNodes, (d: any) => d.x || d.fx || WIDTH / 2) || WIDTH / 2
        const avgY = d3.mean(conflictNodes, (d: any) => d.y || d.fy || HEIGHT / 2) || HEIGHT / 2
        
        // Constrain conflict zone to stay within canvas boundaries
        const radius = 80
        const margin = 20
        const constrainedX = Math.max(radius + margin, Math.min(WIDTH - radius - margin, avgX))
        const constrainedY = Math.max(radius + margin, Math.min(HEIGHT - radius - margin, avgY))
        
        
        zone.attr('transform', `translate(${constrainedX}, ${constrainedY})`)
        
        // Show and animate the zone
        
        zone.style('opacity', 1)
        circle.transition()
          .duration(1000)
          .attr('r', 80)
          .on('end', () => {
            
          })
      })
    }

    // Position immediately if nodes have fixed positions (circular layout)
    if (layoutMode === 'circular') {
      
      setTimeout(positionConflictZones, 100) // Small delay to ensure DOM is ready
    }

    // Also handle simulation ticks for dynamic layouts
    let tickCount = 0
    simulation.on('tick', () => {
      tickCount++
      
      if (tickCount <= 10) {
        
      }
      
      // Wait a few ticks for nodes to settle into initial positions
      if (tickCount === 6 && layoutMode !== 'circular') {
        
        positionConflictZones()
      }
      
      // Continue updating positions for non-circular layouts
      if (tickCount > 6 && layoutMode !== 'circular') {
        conflictZones.forEach(({ zone, conflictNodes }) => {
          const avgX = d3.mean(conflictNodes, (d: any) => d.x!) || WIDTH / 2
          const avgY = d3.mean(conflictNodes, (d: any) => d.y!) || HEIGHT / 2
          
          const radius = 80
          const margin = 20
          const constrainedX = Math.max(radius + margin, Math.min(WIDTH - radius - margin, avgX))
          const constrainedY = Math.max(radius + margin, Math.min(HEIGHT - radius - margin, avgY))
          
          zone.attr('transform', `translate(${constrainedX}, ${constrainedY})`)
        })
      }
    })

    // Draw links
    const linkGroup = svg.append('g').attr('class', 'links')
    
    const link = linkGroup.selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', d => {
        switch (d.type) {
          case 'supports': return '#4caf50'
          case 'attacks': return '#f44336'
          case 'undercuts': return '#ff9800'
          case 'rebuts': return '#9c27b0'
          default: return '#90caf9'
        }
      })
      .attr('stroke-width', d => Math.max(1, d.strength * 4))
      .attr('stroke-dasharray', d => d.type === 'attacks' || d.type === 'undercuts' ? '5,3' : 'none')
      .attr('opacity', 0.7)
      .attr('filter', 'url(#glow-counter)')
      .style('cursor', 'pointer')
      .on('click', function(_, _d) {
        
        // Show relationship details
      })
      .on('mouseover', function(_, d) {
        d3.select(this).attr('stroke-width', Math.max(2, d.strength * 6))
      })
      .on('mouseout', function(_, d) {
        d3.select(this).attr('stroke-width', Math.max(1, d.strength * 4))
      })

    // Draw nodes
    const nodeGroup = svg.append('g').attr('class', 'nodes')
    
    const node = nodeGroup.selectAll('g')
      .data(nodes)
      .enter().append('g')
      .attr('class', 'argument-node')
      .style('cursor', 'pointer')
      .on('click', function(_, _d) {
        const current: any = d3.select(this as any).datum()
        setSelectedNode(current.id === selectedNode ? null : current.id)
      })
      .call(d3.drag<SVGGElement, ArgumentNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        }))

    // Node circles
    node.append('circle')
      .attr('r', d => {
        const baseRadius = d.type === 'counterargument' ? 20 : 15
        return baseRadius + (d.strength || 0.5) * 10
      })
      .attr('fill', d => {
        switch (d.type) {
          case 'premise': return 'url(#neutralGradient)'
          case 'conclusion': return 'url(#supportGradient)'
          case 'counterargument': return 'url(#attackGradient)'
          case 'rebuttal': return 'url(#neutralGradient)'
          default: return 'url(#neutralGradient)'
        }
      })
      .attr('stroke', d => selectedNode === d.id ? '#fff' : 'rgba(255,255,255,0.3)')
      .attr('stroke-width', d => selectedNode === d.id ? 3 : 1)
      .attr('filter', 'url(#glow-counter)')

    // Node labels
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.3em')
      .attr('fill', '#fff')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .text(d => d.label)
      .style('pointer-events', 'none')

    // Node type indicators
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '20px')
      .attr('fill', '#cfd8dc')
      .attr('font-size', '8px')
      .text(d => d.type.charAt(0).toUpperCase() + d.type.slice(1))
      .style('pointer-events', 'none')

    // Add animations if active
    if (isAnimating) {
      
      // Pulsing effect for conflict nodes
      node.filter(d => data.conflicts.some(c => c.nodes.includes(d.id)))
        .select('circle')
        .transition()
        .duration(1000)
        .attr('r', function() { return +d3.select(this).attr('r') * 1.3 })
        .transition()
        .duration(1000)
        .attr('r', function() { return +d3.select(this).attr('r') / 1.3 })

      // Flowing particles along attack relationships
      links.filter(l => l.type === 'attacks').forEach((link, i) => {
        setTimeout(() => {
          const sourceNode = nodes.find(n => n.id === (link.source as ArgumentNode).id)
          const targetNode = nodes.find(n => n.id === (link.target as ArgumentNode).id)
          
          if (sourceNode && targetNode) {
            svg.append('circle')
              .attr('class', 'attack-particle')
              .attr('r', 3)
              .attr('fill', '#ff5252')
              .attr('cx', sourceNode.x || 0)
              .attr('cy', sourceNode.y || 0)
              .transition()
              .duration(2000)
              .attr('cx', targetNode.x || 0)
              .attr('cy', targetNode.y || 0)
              .attr('opacity', 0)
              .remove()
          }
        }, i * 300)
      })
    }

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as ArgumentNode).x!)
        .attr('y1', d => (d.source as ArgumentNode).y!)
        .attr('x2', d => (d.target as ArgumentNode).x!)
        .attr('y2', d => (d.target as ArgumentNode).y!)

      node.attr('transform', d => `translate(${d.x}, ${d.y})`)
    })

    } catch (error) {
      console.error('❌ Error in counterarguments visualization:', error)
      // Fallback: create a simple error message in the SVG
      const svg = d3.select(svgRef.current)
      svg.selectAll('*').remove()
      svg.append('text')
        .attr('x', WIDTH / 2)
        .attr('y', HEIGHT / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#ff5252')
        .attr('font-size', '16px')
        .text('Error rendering counterarguments visualization')
      
      svg.append('text')
        .attr('x', WIDTH / 2)
        .attr('y', HEIGHT / 2 + 30)
        .attr('text-anchor', 'middle')
        .attr('fill', '#ffffff')
        .attr('font-size', '12px')
        .text('Please try a different layout mode or refresh the page')
    }

  }, [data, isAnimating, animationFrame, selectedNode, layoutMode, show3D])

  const handleAnimate = () => {
    
    setIsAnimating(true)
    setAnimationFrame(f => f + 1)
    setTimeout(() => {
      setIsAnimating(false)
      
    }, 4000)
  }

  const handleReset = () => {
    setAnimationFrame(f => f + 1)
    setSelectedNode(null)
    setFocusedConflict(null)
  }

  const handleLayoutChange = () => {
    const modes: Array<'force' | 'hierarchical' | 'circular'> = ['force', 'hierarchical', 'circular']
    const currentIndex = modes.indexOf(layoutMode)
    const nextMode = modes[(currentIndex + 1) % modes.length]
    setLayoutMode(nextMode)
    setAnimationFrame(f => f + 1)
  }

  const handleExport = () => {
    if (!svgRef.current) return
    
    const svgData = new XMLSerializer().serializeToString(svgRef.current)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)
    
    const downloadLink = document.createElement('a')
    downloadLink.href = svgUrl
    downloadLink.download = 'counterarguments-analysis.svg'
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
    URL.revokeObjectURL(svgUrl)
    
    onExport?.()
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Controls Row */}
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(255, 82, 82, 0.2)', flexShrink: 0 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" sx={{ color: '#ffffff', fontFamily: 'monospace' }}>
              {expression || nodeId || 'Counterargument Analysis'}
            </Typography>
            {selectedNode && (
              <Chip
                label={`Selected: ${selectedNode}`}
                variant="outlined"
                size="small"
                onDelete={() => setSelectedNode(null)}
                sx={{ color: '#ff8a80', borderColor: '#ff8a80' }}
              />
            )}
          </Box>
          
          <ButtonGroup variant="outlined" size="small">
            <Button
              startIcon={<PlayIcon />}
              onClick={handleAnimate}
              disabled={isAnimating}
              sx={{ color: '#ff8a80', borderColor: '#ff8a80' }}
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
              startIcon={<LayoutIcon />}
              onClick={handleLayoutChange}
              sx={{ color: '#9c27b0', borderColor: '#9c27b0' }}
            >
              {layoutMode}
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
                transform: show3D ? 'rotateX(10deg) rotateY(5deg)' : 'rotateX(0deg) rotateY(0deg)',
                transition: 'transform 0.5s ease',
                transformStyle: 'preserve-3d',
                filter: show3D ? 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' : 'none'
              }}
            />
          </Box>
        </Box>

        {/* Supporting Information Row */}
        <Box sx={{ p: 3, borderTop: '1px solid rgba(255, 82, 82, 0.2)', flexShrink: 0 }}>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {/* Argument Structure & Types */}
            <Box sx={{ flex: '1 1 300px', minWidth: 300 }}>
              <Card sx={{ backgroundColor: 'rgba(33, 150, 243, 0.05)', border: '1px solid rgba(33, 150, 243, 0.2)', height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#2196f3', mb: 2 }}>
                    Argument Structure & Types
                  </Typography>
                  <Stack spacing={1}>
                    {['premise', 'conclusion', 'counterargument', 'rebuttal'].map(type => {
                      const count = data.nodes.filter(n => n.type === type).length
                      const percentage = count > 0 ? (count / data.nodes.length) * 100 : 0
                      return (
                        <Box key={type}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" sx={{ color: '#ffffff', textTransform: 'capitalize' }}>
                              {type}s
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#2196f3', fontWeight: 500 }}>
                              {count}
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={percentage}
                            sx={{
                              height: 4,
                              backgroundColor: 'rgba(33, 150, 243, 0.1)',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: type === 'counterargument' ? '#f44336' : '#2196f3'
                              }
                            }}
                          />
                        </Box>
                      )
                    })}
                  </Stack>
                </CardContent>
              </Card>
            </Box>

            {/* Fallacy Detection & Analysis */}
            <Box sx={{ flex: '1 1 300px', minWidth: 300 }}>
              <Card sx={{ backgroundColor: 'rgba(244, 67, 54, 0.05)', border: '1px solid rgba(244, 67, 54, 0.2)', height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#f44336', mb: 2 }}>
                    Fallacy Detection & Analysis
                  </Typography>
                  <Stack spacing={1}>
                    {data.fallacies.length > 0 ? data.fallacies.map((fallacy) => (
                      <Box key={fallacy.id} sx={{ p: 1, border: '1px solid rgba(244, 67, 54, 0.3)', borderRadius: 1 }}>
                        <Typography variant="body2" sx={{ color: '#f44336', fontWeight: 'bold' }}>
                          {fallacy.type}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                          {fallacy.description}
                        </Typography>
                        <Chip
                          label={fallacy.severity}
                          size="small"
                          sx={{
                            mt: 0.5,
                            color: fallacy.severity === 'critical' ? '#fff' : '#f44336',
                            backgroundColor: fallacy.severity === 'critical' ? '#f44336' : 'transparent',
                            borderColor: '#f44336'
                          }}
                          variant={fallacy.severity === 'critical' ? 'filled' : 'outlined'}
                        />
                      </Box>
                    )) : (
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        No logical fallacies detected in the current argument structure
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Box>

            {/* Conflict Resolution & Synthesis */}
            <Box sx={{ flex: '1 1 300px', minWidth: 300 }}>
              <Card sx={{ backgroundColor: 'rgba(156, 39, 176, 0.05)', border: '1px solid rgba(156, 39, 176, 0.2)', height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#9c27b0', mb: 2 }}>
                    Conflict Resolution & Synthesis
                  </Typography>
                  <Stack spacing={1}>
                    {data.conflicts.map((conflict) => (
                      <Box key={conflict.id} sx={{ p: 1, border: '1px solid rgba(156, 39, 176, 0.3)', borderRadius: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ color: '#9c27b0', fontWeight: 'bold' }}>
                            Conflict Zone
                          </Typography>
                          <Chip
                            label={conflict.severity}
                            size="small"
                            sx={{
                              color: conflict.severity === 'high' ? '#fff' : '#9c27b0',
                              backgroundColor: conflict.severity === 'high' ? '#9c27b0' : 'transparent',
                              borderColor: '#9c27b0'
                            }}
                            variant={conflict.severity === 'high' ? 'filled' : 'outlined'}
                          />
                        </Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                          {conflict.description}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#9c27b0', display: 'block', mt: 0.5 }}>
                          Nodes: {conflict.nodes.join(', ')}
                        </Typography>
                      </Box>
                    ))}
                    {data.conflicts.length === 0 && (
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        No major conflicts detected. Arguments appear to be logically consistent.
                      </Typography>
                    )}
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

export default EnhancedCounterarguments
