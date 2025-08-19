/**
 * Merge Options Dialog Component
 * Handles conflict resolution and merge strategy selection during file imports
 */

import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  FormControl,
  FormLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material'
import {
  Merge as MergeIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  AccountTree as TreeIcon,
  Note as NoteIcon,
  History as HistoryIcon
} from '@mui/icons-material'
import type { Conflict, MergeOptions } from '../../types/zlfn'

interface MergeOptionsDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (options: MergeOptions) => void
  conflicts: Conflict[]
  fileName: string
  existingObjectName?: string
}

export function MergeOptionsDialog({
  open,
  onClose,
  onConfirm,
  conflicts,
  fileName,
  existingObjectName = 'Current Object'
}: MergeOptionsDialogProps) {
  const [mergeStrategy, setMergeStrategy] = useState<MergeOptions['strategy']>('merge')
  const [preserveNotes, setPreserveNotes] = useState(true)
  const [validateStructure, setValidateStructure] = useState(true)
  const [createBackup, setCreateBackup] = useState(true)

  const handleConfirm = () => {
    const options: MergeOptions = {
      strategy: mergeStrategy,
      preserveNotes,
      validateStructure,
      createBackup
    }
    onConfirm(options)
  }

  const duplicateIdConflicts = conflicts.filter(c => c.type === 'duplicate_id')
  const structuralConflicts = conflicts.filter(c => c.type === 'structural_mismatch')
  const referenceConflicts = conflicts.filter(c => c.type === 'invalid_reference')

  const getStrategyDescription = (strategy: MergeOptions['strategy']) => {
    switch (strategy) {
      case 'merge':
        return 'Combine new content with existing data. Conflicts will be resolved automatically.'
      case 'overwrite':
        return 'Replace existing data entirely with new content. All current data will be lost.'
      case 'suffix':
        return 'Add new content alongside existing data with modified IDs to avoid conflicts.'
      default:
        return ''
    }
  }

  const getConflictIcon = (type: Conflict['type']) => {
    switch (type) {
      case 'duplicate_id':
        return <TreeIcon color="warning" />
      case 'structural_mismatch':
        return <WarningIcon color="error" />
      case 'invalid_reference':
        return <InfoIcon color="info" />
      default:
        return <WarningIcon />
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'rgba(30, 30, 30, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(64, 196, 255, 0.3)',
          borderRadius: 2
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <MergeIcon sx={{ color: '#40c4ff' }} />
        <Box>
          <Typography variant="h6" sx={{ color: '#40c4ff' }}>
            Merge Options
          </Typography>
          <Typography variant="body2" sx={{ color: '#b0bec5' }}>
            {fileName} → {existingObjectName}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Conflicts Summary */}
        {conflicts.length > 0 && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} detected
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {duplicateIdConflicts.length > 0 && (
                <Chip 
                  label={`${duplicateIdConflicts.length} ID conflicts`}
                  size="small"
                  color="warning"
                />
              )}
              {structuralConflicts.length > 0 && (
                <Chip 
                  label={`${structuralConflicts.length} structural conflicts`}
                  size="small"
                  color="error"
                />
              )}
              {referenceConflicts.length > 0 && (
                <Chip 
                  label={`${referenceConflicts.length} reference conflicts`}
                  size="small"
                  color="info"
                />
              )}
            </Box>
          </Alert>
        )}

        {/* Merge Strategy Selection */}
        <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
          <FormLabel component="legend" sx={{ color: '#40c4ff', mb: 2 }}>
            Merge Strategy
          </FormLabel>
          <RadioGroup
            value={mergeStrategy}
            onChange={(e) => setMergeStrategy(e.target.value as MergeOptions['strategy'])}
          >
            <FormControlLabel
              value="merge"
              control={<Radio sx={{ color: '#40c4ff' }} />}
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Merge (Recommended)
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#b0bec5' }}>
                    {getStrategyDescription('merge')}
                  </Typography>
                </Box>
              }
              sx={{ mb: 1, alignItems: 'flex-start' }}
            />
            
            <FormControlLabel
              value="suffix"
              control={<Radio sx={{ color: '#40c4ff' }} />}
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Add with Suffix
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#b0bec5' }}>
                    {getStrategyDescription('suffix')}
                  </Typography>
                </Box>
              }
              sx={{ mb: 1, alignItems: 'flex-start' }}
            />
            
            <FormControlLabel
              value="overwrite"
              control={<Radio sx={{ color: '#f44336' }} />}
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#f44336' }}>
                    Overwrite (Destructive)
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#b0bec5' }}>
                    {getStrategyDescription('overwrite')}
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start' }}
            />
          </RadioGroup>
        </FormControl>

        {/* Additional Options */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ color: '#40c4ff', mb: 2 }}>
            Additional Options
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={preserveNotes}
                  onChange={(e) => setPreserveNotes(e.target.checked)}
                  sx={{ color: '#40c4ff' }}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <NoteIcon sx={{ fontSize: 16 }} />
                  <Typography variant="body2">Preserve existing notes</Typography>
                </Box>
              }
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={validateStructure}
                  onChange={(e) => setValidateStructure(e.target.checked)}
                  sx={{ color: '#40c4ff' }}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TreeIcon sx={{ fontSize: 16 }} />
                  <Typography variant="body2">Validate structure integrity</Typography>
                </Box>
              }
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={createBackup}
                  onChange={(e) => setCreateBackup(e.target.checked)}
                  sx={{ color: '#40c4ff' }}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HistoryIcon sx={{ fontSize: 16 }} />
                  <Typography variant="body2">Create backup before merge</Typography>
                </Box>
              }
            />
          </Box>
        </Box>

        {/* Conflict Details */}
        {conflicts.length > 0 && (
          <Accordion sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">
                View Conflict Details ({conflicts.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                {conflicts.map((conflict, index) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemIcon>
                        {getConflictIcon(conflict.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {conflict.type.replace('_', ' ').toUpperCase()}
                            {conflict.nodeId && ` - Node: ${conflict.nodeId}`}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" sx={{ color: '#b0bec5' }}>
                            {conflict.description}
                          </Typography>
                        }
                      />
                    </ListItem>
                    {index < conflicts.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Strategy Impact Warning */}
        {mergeStrategy === 'overwrite' && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Warning: Overwrite Strategy
            </Typography>
            <Typography variant="caption">
              This will permanently replace all existing data. This action cannot be undone 
              {createBackup ? ' (except by restoring from backup)' : ''}.
            </Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ 
        px: 3, 
        pb: 2,
        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          startIcon={<MergeIcon />}
          sx={{
            bgcolor: mergeStrategy === 'overwrite' ? '#f44336' : '#40c4ff',
            '&:hover': {
              bgcolor: mergeStrategy === 'overwrite' ? '#d32f2f' : '#1976d2'
            }
          }}
        >
          {mergeStrategy === 'overwrite' ? 'Overwrite Data' : 'Merge Files'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default MergeOptionsDialog
