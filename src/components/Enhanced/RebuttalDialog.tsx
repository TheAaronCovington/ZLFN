/**
 * Rebuttal Dialog Wrapper
 * Provides a dialog interface for the Enhanced Rebuttal component
 */

import React from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton } from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'
import EnhancedRebuttal, { type RebuttalData } from './EnhancedRebuttal'

export interface RebuttalDialogProps {
  open: boolean
  onClose: () => void
  nodeData?: any
  title?: string
}

// Sample rebuttal data generator
function generateSampleRebuttalData(nodeData: any): RebuttalData {
  const nodeName = nodeData?.name || nodeData?.label || nodeData?.id || 'Unknown Node'
  const argumentType = nodeData?.argumentType || nodeData?.type || 'unknown'
  
  return {
    nodeId: nodeData?.id || 'unknown',
    nodeName,
    argumentType,
    rebuttalType: argumentType === 'rebuttal' ? 'direct' : 'indirect',
    targetClaim: nodeData?.targetClaim || `The main claim being challenged by ${nodeName}`,
    rebuttalClaim: nodeData?.label || `${nodeName} presents a counterargument`,
    strength: nodeData?.strength || Math.floor(Math.random() * 40) + 60, // 60-100%
    confidence: Math.floor(Math.random() * 30) + 70, // 70-100%
    
    evidence: [
      {
        id: 'ev1',
        type: 'empirical',
        description: 'Statistical data contradicts the original claim',
        strength: 85,
        source: 'Research Study 2023'
      },
      {
        id: 'ev2',
        type: 'logical',
        description: 'Logical inconsistency in the original argument structure',
        strength: 75
      },
      {
        id: 'ev3',
        type: 'precedent',
        description: 'Historical cases demonstrate alternative outcomes',
        strength: 70,
        source: 'Historical Analysis Database'
      }
    ],
    
    weaknesses: [
      {
        id: 'w1',
        type: 'scope',
        description: 'Limited scope of applicability to specific contexts',
        severity: 45,
        mitigation: 'Acknowledge scope limitations and specify applicable contexts'
      },
      {
        id: 'w2',
        type: 'evidential',
        description: 'Some supporting evidence is circumstantial',
        severity: 35,
        mitigation: 'Supplement with additional direct evidence'
      }
    ],
    
    counterRebuttals: [
      {
        id: 'cr1',
        claim: 'The rebuttal relies on outdated information',
        strength: 40,
        response: 'Recent updates confirm the validity of the evidence used'
      },
      {
        id: 'cr2',
        claim: 'Alternative explanations exist for the presented evidence',
        strength: 55,
        response: 'While alternatives exist, this explanation has the highest probability'
      }
    ],
    
    sources: [
      'Academic Journal of Logic 2023',
      'Argumentation Theory Handbook',
      'Critical Thinking Research Database'
    ],
    
    tags: ['logical-analysis', 'evidence-based', 'counterargument']
  }
}

const RebuttalDialog: React.FC<RebuttalDialogProps> = ({
  open,
  onClose,
  nodeData,
  title
}) => {
  const rebuttalData = React.useMemo(() => {
    if (!nodeData) return null
    return generateSampleRebuttalData(nodeData)
  }, [nodeData])

  if (!rebuttalData) return null

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'var(--ai-bg-primary)',
          color: 'var(--ai-text-primary)',
          minHeight: '70vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        backgroundColor: 'var(--ai-bg-secondary)',
        color: 'var(--ai-text-primary)'
      }}>
        {title || `Rebuttal Analysis - ${rebuttalData.nodeName}`}
        <IconButton onClick={onClose} sx={{ color: 'var(--ai-text-secondary)' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        <EnhancedRebuttal
          data={rebuttalData}
          readonly={true}
        />
      </DialogContent>
      
      <DialogActions sx={{ 
        p: 2, 
        backgroundColor: 'var(--ai-bg-secondary)',
        justifyContent: 'space-between'
      }}>
        <Button 
          variant="outlined" 
          onClick={onClose}
          sx={{ color: 'var(--ai-text-primary)', borderColor: 'var(--ai-text-secondary)' }}
        >
          Close
        </Button>
        <Button 
          variant="contained" 
          sx={{ 
            backgroundColor: '#D32F2F',
            color: 'white',
            '&:hover': { backgroundColor: '#B71C1C' }
          }}
        >
          Export Analysis
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default RebuttalDialog
