/**
 * Argument Tableau Network (ATN) - Main Component
 * Third visualization mode for informal argument analysis
 */

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { 
  Box, 
  Typography, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Stack, 
  Switch,
  FormControlLabel,
  IconButton,
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText,
  Chip,
  Alert
} from '@mui/material'
import {
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Analytics as AnalyticsIcon,
  AccountTree as SchemeIcon,
  Warning as WarningIcon,
  Keyboard as KeyboardIcon
} from '@mui/icons-material'
import type { 
  ArgumentTableauProps, 
  ArgumentData, 
  ArgumentNode, 
  ArgumentEdge,
  ATNLayoutMode,
  ArgumentCollection 
} from './types'
import { 
  ARGUMENT_COLORS,
  DEFAULT_ATN_CONFIG
} from './types'
import { storage } from '../../../services/storage'
import { 
  initializeTreeSVG, 
  renderTreeLayout, 
  renderHierarchicalLayout,
  type TreeRenderState 
} from './treeRenderer'
import { 
  initializeTableContainer, 
  renderTableLayout,
  type TableRenderState 
} from './tableRenderer'
import { type FacetClick } from '../../../vis/facets/icons'
import { 
  VennDiagramDialog,
  TruthTableDialog,
  TimelineDialog,
  CounterargumentsDialog,
  RebuttalDialog
} from '../../Enhanced'
import { 
  groupEdgesByScheme, 
  applySchemeClustering
} from './schemeCluster'
import { 
  calculateArgumentStrengths
} from './strengthPropagation'
import { 
  exportATNAnalysis,
  type ATNExportOptions 
} from './exportService'
import {
  createATNKeyboardHandler,
  getLayoutModeFromKey,
  getNextLayoutMode,
  type ATNKeyboardShortcuts
} from './keyboardShortcuts'
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog'

/**
 * Sample argument data for initial development and testing
 */
const SAMPLE_ARGUMENT: ArgumentData = {
  id: 'demo-argument',
  name: 'Policy X Should Be Adopted',
  description: 'A sample argument demonstrating the ATN structure',
  core: {
    id: 'claim-1',
    label: 'Policy X should be adopted',
    name: 'Main Claim',
    argumentType: 'claim',
    argumentId: 'demo-argument',
    type: 'conclusion',
    color: ARGUMENT_COLORS.claim,
    size: { width: 150, height: 40 },
    strength: 85,
    x: 400,
    y: 100,
    facets: {
      vennRelevant: true,
      truthTableRelevant: false,
      timelineRelevant: false,
      counterRelevant: true,
      rebuttalRelevant: true,
      noteRelevant: true
    }
  },
  components: [
    {
      id: 'ground-1',
      label: 'Studies show benefits',
      name: 'Evidence Ground',
      argumentType: 'ground',
      argumentId: 'demo-argument',
      type: 'premise',
      color: ARGUMENT_COLORS.ground,
      size: { width: 120, height: 30 },
      strength: 90,
      x: 200,
      y: 200,
      facets: { vennRelevant: true, noteRelevant: true }
    },
    {
      id: 'warrant-1',
      label: 'Evidence-based policy is good',
      name: 'Policy Warrant',
      argumentType: 'warrant',
      argumentId: 'demo-argument',
      type: 'term',
      color: ARGUMENT_COLORS.warrant,
      size: { width: 140, height: 30 },
      strength: 75,
      x: 400,
      y: 200,
      facets: { truthTableRelevant: true, noteRelevant: true }
    },
    {
      id: 'backing-1',
      label: 'Historical success of evidence-based policies',
      name: 'Historical Backing',
      argumentType: 'backing',
      argumentId: 'demo-argument',
      type: 'premise',
      color: ARGUMENT_COLORS.backing,
      size: { width: 160, height: 30 },
      strength: 80,
      x: 600,
      y: 280,
      facets: { timelineRelevant: true, noteRelevant: true }
    },
    {
      id: 'rebuttal-1',
      label: 'Policy X is too expensive',
      name: 'Cost Rebuttal',
      argumentType: 'rebuttal',
      argumentId: 'demo-argument',
      type: 'fallacy',
      color: ARGUMENT_COLORS.rebuttal,
      size: { width: 130, height: 30 },
      strength: 60,
      attackedBy: [],
      x: 100,
      y: 300,
      facets: { rebuttalRelevant: true, counterRelevant: true, noteRelevant: true }
    },
    {
      id: 'qualifier-1',
      label: 'Unless budget constraints apply',
      name: 'Budget Qualifier',
      argumentType: 'qualifier',
      argumentId: 'demo-argument',
      type: 'informal',
      color: ARGUMENT_COLORS.qualifier,
      size: { radius: 25 },
      strength: 70,
      x: 500,
      y: 50,
      facets: { noteRelevant: true }
    }
  ],
  relationships: [
    {
      id: 'rel-1',
      from: 'ground-1',
      to: 'warrant-1',
      relationshipType: 'support',
      scheme: 'Evidence to Warrant',
      confidence: 85,
      weight: 85,
      rule: 'Evidence Support',
      type: 'implication',
      style: 'solid'
    },
    {
      id: 'rel-2',
      from: 'warrant-1',
      to: 'claim-1',
      relationshipType: 'support',
      scheme: 'Warrant to Claim',
      confidence: 80,
      weight: 80,
      rule: 'Warrant Support',
      type: 'implication',
      style: 'solid'
    },
    {
      id: 'rel-3',
      from: 'backing-1',
      to: 'warrant-1',
      relationshipType: 'support',
      scheme: 'Historical Authority',
      confidence: 75,
      weight: 75,
      rule: 'Authority Support',
      type: 'implication',
      style: 'solid'
    },
    {
      id: 'rel-4',
      from: 'rebuttal-1',
      to: 'claim-1',
      relationshipType: 'attack',
      scheme: 'Cost-Benefit Challenge',
      confidence: 65,
      weight: 65,
      rule: 'Economic Challenge',
      type: 'counterexample',
      style: 'dashed'
    },
    {
      id: 'rel-5',
      from: 'qualifier-1',
      to: 'claim-1',
      relationshipType: 'undercut',
      scheme: 'Conditional Limitation',
      confidence: 70,
      weight: 70,
      rule: 'Conditional Qualifier',
      type: 'semantic',
      style: 'dotted'
    }
  ],
  layoutMode: 'tree'
}

const ArgumentTableau: React.FC<ArgumentTableauProps> = ({
  expression: _expression,
  ast: _ast,
  compact = false,
  argument,
  onArgumentSelect,
  onNodeSelect,
  onEdgeSelect,
  onLayoutModeChange
}) => {
  // Refs for rendering containers
  const containerRef = useRef<HTMLDivElement>(null)
  const renderStateRef = useRef<TreeRenderState | TableRenderState | null>(null)

  // Facet dialog states
  const [facetDialogs, setFacetDialogs] = useState({
    venn: { open: false, nodeData: null as ArgumentNode | null },
    truth: { open: false, nodeData: null as ArgumentNode | null },
    timeline: { open: false, nodeData: null as ArgumentNode | null },
    counter: { open: false, nodeData: null as ArgumentNode | null },
    rebuttal: { open: false, nodeData: null as ArgumentNode | null }
  })

  // Advanced features state
  const [showSchemeClustering, setShowSchemeClustering] = useState(true)
  const [showStrengthAnalysis, setShowStrengthAnalysis] = useState(true)
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null)
  const [settingsMenuAnchor, setSettingsMenuAnchor] = useState<null | HTMLElement>(null)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number>(-1)
  // State management
  const [layoutMode, setLayoutMode] = useState<ATNLayoutMode>(() => {
    try {
      return (storage.getItem('atn_layout_mode') as ATNLayoutMode) || 'tree'
    } catch {
      return 'tree'
    }
  })

  const [selectedArgumentId, setSelectedArgumentId] = useState<string>(() => {
    try {
      return storage.getItem('atn_selected_argument') || 'demo-argument'
    } catch {
      return 'demo-argument'
    }
  })

  const [argumentCollection] = useState<ArgumentCollection>(() => ({
    arguments: [argument || SAMPLE_ARGUMENT],
    selectedArgumentId: argument?.id || 'demo-argument',
    globalSettings: {
      showSchemeLabels: true,
      clusterByScheme: true,
      defaultLayoutMode: 'tree'
    }
  }))

  // Persist layout mode changes
  useEffect(() => {
    try {
      storage.setItem('atn_layout_mode', layoutMode)
    } catch {}
    onLayoutModeChange?.(layoutMode)
  }, [layoutMode, onLayoutModeChange])

  // Persist selected argument changes
  useEffect(() => {
    try {
      storage.setItem('atn_selected_argument', selectedArgumentId)
    } catch {}
    onArgumentSelect?.(selectedArgumentId)
  }, [selectedArgumentId, onArgumentSelect])

  // Get current argument data - wire to shared data if available
  const currentArgument = useMemo(() => {
    // Use shared data argument if provided, otherwise fall back to collection or sample
    if (argument) {
      return argument
    }
    return argumentCollection.arguments.find(arg => arg.id === selectedArgumentId) || SAMPLE_ARGUMENT
  }, [argument, argumentCollection, selectedArgumentId])

  // Convert to ATN format (adapt existing data if needed)
  const atnNodes = useMemo(() => {
    const nodes: ArgumentNode[] = [currentArgument.core, ...currentArgument.components]
    return nodes
  }, [currentArgument])

  const atnEdges = useMemo(() => {
    return currentArgument.relationships
  }, [currentArgument])

  // Advanced analysis computations
  const strengthAnalysis = useMemo(() => {
    if (!showStrengthAnalysis) return null
    return calculateArgumentStrengths(currentArgument)
  }, [currentArgument, showStrengthAnalysis])

  const schemeClusters = useMemo(() => {
    if (!showSchemeClustering) return []
    return groupEdgesByScheme(currentArgument)
  }, [currentArgument, showSchemeClustering])

  const processedArgument = useMemo(() => {
    return applySchemeClustering(currentArgument, showSchemeClustering)
  }, [currentArgument, showSchemeClustering])

  // Handle layout mode change
  const handleLayoutModeChange = (newMode: ATNLayoutMode) => {
    setLayoutMode(newMode)
  }

  // Handle argument selection
  const handleArgumentSelect = (argumentId: string) => {
    setSelectedArgumentId(argumentId)
  }

  // Handle node selection
  const handleNodeSelect = (node: ArgumentNode) => {
    onNodeSelect?.(node)
  }

  // Handle edge selection
  const handleEdgeSelect = (edge: ArgumentEdge) => {
    onEdgeSelect?.(edge)
  }

  // Handle facet clicks
  const handleFacetClick: FacetClick = (type, _opts, datum, _target) => {
    const nodeData = datum as ArgumentNode
    setFacetDialogs(prev => ({
      ...prev,
      [type]: { open: true, nodeData }
    }))
  }

  // Close facet dialogs
  const closeFacetDialog = (type: keyof typeof facetDialogs) => {
    setFacetDialogs(prev => ({
      ...prev,
      [type]: { open: false, nodeData: null }
    }))
  }

  // Handle export
  const handleExport = (format: 'json' | 'csv' | 'latex' | 'markdown') => {
    const options: ATNExportOptions = {
      includeMetadata: true,
      includeStrengthAnalysis: showStrengthAnalysis,
      includeConflictAnalysis: true,
      includeSchemeAnalysis: showSchemeClustering,
      format
    }

    exportATNAnalysis(
      processedArgument,
      strengthAnalysis || undefined,
      schemeClusters,
      format,
      options
    )

    setExportMenuAnchor(null)
  }

  // Menu handlers
  const handleExportMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setExportMenuAnchor(event.currentTarget)
  }

  const handleSettingsMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setSettingsMenuAnchor(event.currentTarget)
  }

  const handleMenuClose = () => {
    setExportMenuAnchor(null)
    setSettingsMenuAnchor(null)
  }

  // Get currently selected node
  const selectedNode = useMemo(() => {
    if (selectedNodeIndex >= 0 && selectedNodeIndex < atnNodes.length) {
      return atnNodes[selectedNodeIndex]
    }
    return null
  }, [selectedNodeIndex, atnNodes])

  // Keyboard shortcuts implementation
  const keyboardShortcuts: ATNKeyboardShortcuts = useMemo(() => ({
    // Layout controls
    switchToTree: () => setLayoutMode('tree'),
    switchToHierarchical: () => setLayoutMode('hierarchical'),
    switchToTable: () => setLayoutMode('table'),
    cycleLayouts: () => setLayoutMode(prev => getNextLayoutMode(prev)),
    
    // Analysis controls
    toggleStrengthAnalysis: () => setShowStrengthAnalysis(prev => !prev),
    toggleSchemeClustering: () => setShowSchemeClustering(prev => !prev),
    refreshAnalysis: () => {
      // Force re-calculation by toggling and re-toggling
      setShowStrengthAnalysis(prev => {
        setTimeout(() => setShowStrengthAnalysis(prev), 50)
        return !prev
      })
    },
    
    // Export shortcuts
    exportAsJSON: () => handleExport('json'),
    exportAsMarkdown: () => handleExport('markdown'),
    exportAsLaTeX: () => handleExport('latex'),
    exportAsCSV: () => handleExport('csv'),
    
    // Navigation
    selectNextNode: () => {
      setSelectedNodeIndex(prev => 
        prev < atnNodes.length - 1 ? prev + 1 : 0
      )
    },
    selectPreviousNode: () => {
      setSelectedNodeIndex(prev => 
        prev > 0 ? prev - 1 : atnNodes.length - 1
      )
    },
    selectCoreNode: () => {
      const coreIndex = atnNodes.findIndex(node => node.id === currentArgument.core.id)
      if (coreIndex >= 0) {
        setSelectedNodeIndex(coreIndex)
      }
    },
    clearSelection: () => setSelectedNodeIndex(-1),
    
    // View controls (these would need to be implemented in the renderers)
    fitToView: () => {
      // This would need to be implemented in the specific renderer
      console.log('Fit to view - would need renderer integration')
    },
    zoomIn: () => {
      console.log('Zoom in - would need renderer integration')
    },
    zoomOut: () => {
      console.log('Zoom out - would need renderer integration')
    },
    resetZoom: () => {
      console.log('Reset zoom - would need renderer integration')
    },
    
    // Facet shortcuts
    openVennDiagram: () => {
      if (selectedNode) {
        setFacetDialogs(prev => ({
          ...prev,
          venn: { open: true, nodeData: selectedNode }
        }))
      }
    },
    openTruthTable: () => {
      if (selectedNode) {
        setFacetDialogs(prev => ({
          ...prev,
          truth: { open: true, nodeData: selectedNode }
        }))
      }
    },
    openTimeline: () => {
      if (selectedNode) {
        setFacetDialogs(prev => ({
          ...prev,
          timeline: { open: true, nodeData: selectedNode }
        }))
      }
    },
    openCounterarguments: () => {
      if (selectedNode) {
        setFacetDialogs(prev => ({
          ...prev,
          counter: { open: true, nodeData: selectedNode }
        }))
      }
    },
    openRebuttal: () => {
      if (selectedNode) {
        setFacetDialogs(prev => ({
          ...prev,
          rebuttal: { open: true, nodeData: selectedNode }
        }))
      }
    },
    
    // Settings
    openSettings: () => setSettingsMenuAnchor(document.body),
    openExportMenu: () => setExportMenuAnchor(document.body),
    showHelp: () => setShowKeyboardHelp(true)
  }), [
    setLayoutMode, 
    setShowStrengthAnalysis, 
    setShowSchemeClustering, 
    handleExport, 
    atnNodes, 
    selectedNode, 
    currentArgument.core.id
  ])

  // Create keyboard event handler
  const keyboardHandler = useMemo(() => 
    createATNKeyboardHandler(keyboardShortcuts, true), 
    [keyboardShortcuts]
  )

  // Add keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', keyboardHandler)
    return () => document.removeEventListener('keydown', keyboardHandler)
  }, [keyboardHandler])

  // Handle direct layout switching from number keys
  useEffect(() => {
    const handleDirectLayoutSwitch = (event: KeyboardEvent) => {
      const layoutMode = getLayoutModeFromKey(event.key)
      if (layoutMode) {
        setLayoutMode(layoutMode)
      }
    }

    document.addEventListener('keydown', handleDirectLayoutSwitch)
    return () => document.removeEventListener('keydown', handleDirectLayoutSwitch)
  }, [])

  // Render the visualization when layout mode or argument changes
  useEffect(() => {
    if (!containerRef.current) return

    const config = {
      ...DEFAULT_ATN_CONFIG,
      layoutMode,
      width: containerRef.current.clientWidth || 800,
      height: containerRef.current.clientHeight || 600
    }

    try {
      if (layoutMode === 'table') {
        // Table layout
        const state = initializeTableContainer(containerRef.current, config)
        renderTableLayout(state, currentArgument, config, handleNodeSelect, handleEdgeSelect)
        renderStateRef.current = state
      } else {
        // Tree or hierarchical layout
        const state = initializeTreeSVG(containerRef.current, config)
        
        if (layoutMode === 'tree') {
          renderTreeLayout(state, currentArgument, config, handleNodeSelect, handleEdgeSelect, handleFacetClick)
        } else {
          renderHierarchicalLayout(state, currentArgument, config, handleNodeSelect, handleEdgeSelect, handleFacetClick)
        }
        
        renderStateRef.current = state
      }
    } catch (error) {
      console.error('ATN rendering error:', error)
    }
  }, [layoutMode, currentArgument, handleNodeSelect, handleEdgeSelect])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return
      
      // Re-render on resize
      const config = {
        ...DEFAULT_ATN_CONFIG,
        layoutMode,
        width: containerRef.current.clientWidth || 800,
        height: containerRef.current.clientHeight || 600
      }

      try {
        if (layoutMode === 'table') {
          const state = initializeTableContainer(containerRef.current, config)
          renderTableLayout(state, currentArgument, config, handleNodeSelect, handleEdgeSelect)
          renderStateRef.current = state
        } else {
          const state = initializeTreeSVG(containerRef.current, config)
          
          if (layoutMode === 'tree') {
            renderTreeLayout(state, currentArgument, config, handleNodeSelect, handleEdgeSelect, handleFacetClick)
          } else {
            renderHierarchicalLayout(state, currentArgument, config, handleNodeSelect, handleEdgeSelect, handleFacetClick)
          }
          
          renderStateRef.current = state
        }
      } catch (error) {
        console.error('ATN resize rendering error:', error)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [layoutMode, currentArgument, handleNodeSelect, handleEdgeSelect])

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: 'var(--ai-bg-primary)',
      color: 'var(--ai-text-primary)'
    }}>
      {/* ATN Header Controls */}
      {!compact && (
        <Box sx={{ 
          p: 2, 
          borderBottom: '1px solid rgba(64,196,255,0.3)',
          backgroundColor: 'var(--ai-bg-secondary)'
        }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h6" sx={{ color: '#40c4ff', fontWeight: 600 }}>
              Argument Tableau Network
            </Typography>
            
            {/* Argument Selector */}
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel sx={{ color: 'var(--ai-text-secondary)' }}>Argument</InputLabel>
              <Select
                value={selectedArgumentId}
                onChange={(e) => handleArgumentSelect(e.target.value)}
                label="Argument"
                sx={{ 
                  color: 'var(--ai-text-primary)',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(64,196,255,0.3)'
                  }
                }}
              >
                {argumentCollection.arguments.map(arg => (
                  <MenuItem key={arg.id} value={arg.id}>
                    {arg.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Layout Mode Selector */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel sx={{ color: 'var(--ai-text-secondary)' }}>Layout</InputLabel>
              <Select
                value={layoutMode}
                onChange={(e) => handleLayoutModeChange(e.target.value as ATNLayoutMode)}
                label="Layout"
                sx={{ 
                  color: 'var(--ai-text-primary)',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(64,196,255,0.3)'
                  }
                }}
              >
                <MenuItem value="tree">Tree</MenuItem>
                <MenuItem value="hierarchical">Hierarchical</MenuItem>
                <MenuItem value="table">Table</MenuItem>
              </Select>
            </FormControl>

            {/* Advanced Controls */}
            <Tooltip title="Export Analysis">
              <IconButton onClick={handleExportMenuOpen} sx={{ color: '#40c4ff' }}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Analysis Settings">
              <IconButton onClick={handleSettingsMenuOpen} sx={{ color: '#40c4ff' }}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Keyboard Shortcuts (Shift + ?)">
              <IconButton onClick={() => setShowKeyboardHelp(true)} sx={{ color: '#40c4ff' }}>
                <KeyboardIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      )}

      {/* Analysis Status */}
      {!compact && strengthAnalysis && (
        <Box sx={{ 
          p: 1, 
          backgroundColor: 'var(--ai-bg-secondary)',
          borderBottom: '1px solid rgba(64,196,255,0.3)'
        }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Chip
              icon={<AnalyticsIcon />}
              label={`Coherence: ${strengthAnalysis.overallCoherence}%`}
              color={strengthAnalysis.overallCoherence >= 70 ? 'success' : strengthAnalysis.overallCoherence >= 40 ? 'warning' : 'error'}
              size="small"
            />
            
            {strengthAnalysis.conflicts.length > 0 && (
              <Chip
                icon={<WarningIcon />}
                label={`${strengthAnalysis.conflicts.length} Conflicts`}
                color="error"
                size="small"
              />
            )}
            
            {schemeClusters.length > 0 && (
              <Chip
                icon={<SchemeIcon />}
                label={`${schemeClusters.length} Schemes`}
                color="info"
                size="small"
              />
            )}

            {selectedNode && (
              <Chip
                label={`Selected: ${selectedNode.name || selectedNode.label}`}
                color="primary"
                size="small"
                onDelete={() => setSelectedNodeIndex(-1)}
              />
            )}
          </Stack>
        </Box>
      )}

      {/* Conflicts Alert */}
      {!compact && strengthAnalysis && strengthAnalysis.conflicts.length > 0 && (
        <Alert 
          severity="warning" 
          sx={{ m: 1 }}
          action={
            <Typography variant="caption">
              Click nodes for details
            </Typography>
          }
        >
          <Typography variant="body2">
            <strong>{strengthAnalysis.conflicts.length} conflicts detected:</strong>{' '}
            {strengthAnalysis.conflicts.slice(0, 2).map(c => c.type.replace('_', ' ')).join(', ')}
            {strengthAnalysis.conflicts.length > 2 && ` and ${strengthAnalysis.conflicts.length - 2} more`}
          </Typography>
        </Alert>
      )}

      {/* ATN Visualization Area */}
      <Box 
        ref={containerRef}
        sx={{ 
          flex: 1, 
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          height: '100%'
        }}
      />
      
      {/* Status Bar */}
      {!compact && (
        <Box sx={{ 
          p: 1, 
          borderTop: '1px solid rgba(64,196,255,0.3)',
          backgroundColor: 'var(--ai-bg-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: 'var(--ai-text-secondary)'
        }}>
          <Stack direction="row" spacing={2}>
            <Typography variant="caption">
              Argument: {currentArgument.name}
            </Typography>
            <Typography variant="caption">
              Layout: {layoutMode}
            </Typography>
            <Typography variant="caption">
              Nodes: {atnNodes.length} | Edges: {atnEdges.length}
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: 'var(--ai-text-tertiary)' }}>
            Click nodes/edges for details
          </Typography>
        </Box>
      )}

      {/* Facet Dialogs */}
      <VennDiagramDialog
        open={facetDialogs.venn.open}
        onClose={() => closeFacetDialog('venn')}
        data={{
          sets: [
            { label: 'Set A', items: ['item1', 'item2'], color: '#7ac7ff' },
            { label: 'Set B', items: ['item2', 'item3'], color: '#ff8a80' }
          ],
          intersection: ['item2']
        }}
        expression={facetDialogs.venn.nodeData?.label || ''}
        nodeId={facetDialogs.venn.nodeData?.id}
      />
      
      <TruthTableDialog
        open={facetDialogs.truth.open}
        onClose={() => closeFacetDialog('truth')}
        ast={{
          id: facetDialogs.truth.nodeData?.id || 'ast-node',
          label: facetDialogs.truth.nodeData?.label || 'A',
          children: []
        }}
        expression={facetDialogs.truth.nodeData?.label || ''}
        nodeId={facetDialogs.truth.nodeData?.id}
      />
      
      <TimelineDialog
        open={facetDialogs.timeline.open}
        onClose={() => closeFacetDialog('timeline')}
        nodes={[
          { 
            id: '1', 
            label: 'Event 1', 
            type: 'premise', 
            timestamp: Date.now(), 
            confidence: 80,
            dependencies: []
          },
          { 
            id: '2', 
            label: 'Event 2', 
            type: 'conclusion', 
            timestamp: Date.now() + 1000, 
            confidence: 90,
            dependencies: ['1']
          }
        ]}
        edges={[
          { from: '1', to: '2', rule: 'implication', strength: 0.8, timestamp: Date.now() }
        ]}
        nodeId={facetDialogs.timeline.nodeData?.id}
      />
      
      <CounterargumentsDialog
        open={facetDialogs.counter.open}
        onClose={() => closeFacetDialog('counter')}
        expression={facetDialogs.counter.nodeData?.label || ''}
        nodeId={facetDialogs.counter.nodeData?.id}
      />
      
      <RebuttalDialog
        open={facetDialogs.rebuttal.open}
        onClose={() => closeFacetDialog('rebuttal')}
        nodeData={facetDialogs.rebuttal.nodeData}
      />

      {/* Export Menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            backgroundColor: 'var(--ai-bg-secondary)',
            border: '1px solid rgba(64,196,255,0.3)'
          }
        }}
      >
        <MenuItem onClick={() => handleExport('json')}>
          <ListItemIcon>
            <DownloadIcon sx={{ color: '#40c4ff' }} />
          </ListItemIcon>
          <ListItemText primary="Export as JSON" secondary="Complete analysis data" />
        </MenuItem>
        
        <MenuItem onClick={() => handleExport('markdown')}>
          <ListItemIcon>
            <DownloadIcon sx={{ color: '#40c4ff' }} />
          </ListItemIcon>
          <ListItemText primary="Export as Markdown" secondary="Human-readable report" />
        </MenuItem>
        
        <MenuItem onClick={() => handleExport('latex')}>
          <ListItemIcon>
            <DownloadIcon sx={{ color: '#40c4ff' }} />
          </ListItemIcon>
          <ListItemText primary="Export as LaTeX" secondary="Academic paper format" />
        </MenuItem>
        
        <MenuItem onClick={() => handleExport('csv')}>
          <ListItemIcon>
            <DownloadIcon sx={{ color: '#40c4ff' }} />
          </ListItemIcon>
          <ListItemText primary="Export as CSV" secondary="Spreadsheet data" />
        </MenuItem>
      </Menu>

      {/* Settings Menu */}
      <Menu
        anchorEl={settingsMenuAnchor}
        open={Boolean(settingsMenuAnchor)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            backgroundColor: 'var(--ai-bg-secondary)',
            border: '1px solid rgba(64,196,255,0.3)',
            minWidth: 250
          }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ color: 'var(--ai-text-primary)', mb: 2 }}>
            Analysis Settings
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={showStrengthAnalysis}
                onChange={(e) => setShowStrengthAnalysis(e.target.checked)}
                color="primary"
              />
            }
            label="Strength Analysis"
            sx={{ 
              color: 'var(--ai-text-primary)',
              display: 'block',
              mb: 1
            }}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={showSchemeClustering}
                onChange={(e) => setShowSchemeClustering(e.target.checked)}
                color="primary"
              />
            }
            label="Scheme Clustering"
            sx={{ 
              color: 'var(--ai-text-primary)',
              display: 'block'
            }}
          />
        </Box>
      </Menu>

      {/* Keyboard Shortcuts Help Dialog */}
      <KeyboardShortcutsDialog
        open={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />
    </Box>
  )
}

export default ArgumentTableau
