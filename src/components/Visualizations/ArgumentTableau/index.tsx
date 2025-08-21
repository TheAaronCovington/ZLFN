/**
 * Argument Tableau Network (ATN) - Main Component
 * Third visualization mode for informal argument analysis
 */

import React, { useState, useEffect, useMemo } from 'react'
import { Box, Typography, Select, MenuItem, FormControl, InputLabel, Stack } from '@mui/material'
import type { 
  ArgumentTableauProps, 
  ArgumentData, 
  ArgumentNode, 
  ATNLayoutMode,
  ArgumentCollection 
} from './types'
import { 
  ARGUMENT_COLORS
} from './types'
import { storage } from '../../../services/storage'

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
  onArgumentSelect,
  onNodeSelect: _onNodeSelect,
  onEdgeSelect: _onEdgeSelect,
  onLayoutModeChange
}) => {
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
    arguments: [SAMPLE_ARGUMENT],
    selectedArgumentId: 'demo-argument',
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

  // Get current argument data
  const currentArgument = useMemo(() => {
    return argumentCollection.arguments.find(arg => arg.id === selectedArgumentId) || SAMPLE_ARGUMENT
  }, [argumentCollection, selectedArgumentId])

  // Convert to ATN format (adapt existing data if needed)
  const atnNodes = useMemo(() => {
    const nodes: ArgumentNode[] = [currentArgument.core, ...currentArgument.components]
    return nodes
  }, [currentArgument])

  const atnEdges = useMemo(() => {
    return currentArgument.relationships
  }, [currentArgument])

  // Handle layout mode change
  const handleLayoutModeChange = (newMode: ATNLayoutMode) => {
    setLayoutMode(newMode)
  }

  // Handle argument selection
  const handleArgumentSelect = (argumentId: string) => {
    setSelectedArgumentId(argumentId)
  }

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
          </Stack>
        </Box>
      )}

      {/* ATN Visualization Area */}
      <Box sx={{ 
        flex: 1, 
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Placeholder for renderer - will be implemented in Phase 2 */}
        <Box sx={{ 
          textAlign: 'center',
          p: 4,
          border: '2px dashed rgba(64,196,255,0.3)',
          borderRadius: 2,
          backgroundColor: 'rgba(64,196,255,0.05)'
        }}>
          <Typography variant="h5" sx={{ color: '#40c4ff', mb: 2 }}>
            ATN Renderer Placeholder
          </Typography>
          <Typography variant="body1" sx={{ color: 'var(--ai-text-secondary)', mb: 2 }}>
            Current Argument: {currentArgument.name}
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--ai-text-secondary)', mb: 1 }}>
            Layout Mode: {layoutMode}
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--ai-text-secondary)', mb: 1 }}>
            Nodes: {atnNodes.length} | Edges: {atnEdges.length}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--ai-text-tertiary)' }}>
            Phase 2 will implement tree/hierarchical rendering here
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

export default ArgumentTableau
