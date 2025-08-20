import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Divider,
  Alert
} from '@mui/material';
import {
  Edit as EditIcon,
  Link as LinkIcon,
  Clear as ClearIcon,
  Save as SaveIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { MarkdownReferenceSelector, MarkdownReferenceIndicator } from '../MarkdownReference';
import type { MarkdownReference } from '../MarkdownReference';
import type { ZlfnNode } from '../Visualizations/ZlfnGraph';

interface NodeEditDialogProps {
  open: boolean;
  onClose: () => void;
  node: ZlfnNode | null;
  onSave: (updatedNode: ZlfnNode) => void;
  onNavigateToReference?: (reference: MarkdownReference) => void;
}

export default function NodeEditDialog({
  open,
  onClose,
  node,
  onSave,
  onNavigateToReference
}: NodeEditDialogProps) {
  const [editedNode, setEditedNode] = useState<ZlfnNode | null>(null);
  const [referenceDialogOpen, setReferenceDialogOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize edited node when dialog opens
  useEffect(() => {
    if (open && node) {
      setEditedNode({ ...node });
      setHasChanges(false);
    }
  }, [open, node]);

  const handleFieldChange = (field: keyof ZlfnNode, value: any) => {
    if (!editedNode) return;
    
    setEditedNode(prev => ({
      ...prev!,
      [field]: value
    }));
    setHasChanges(true);
  };

  const handleReferenceSelect = (reference: MarkdownReference | null) => {
    if (!editedNode) return;
    
    const referenceString = reference 
      ? `${reference.documentId}#${reference.sectionId}`
      : undefined;
    
    handleFieldChange('markdownRef', referenceString);
    setReferenceDialogOpen(false);
  };

  const handleSave = () => {
    if (editedNode && hasChanges) {
      onSave(editedNode);
    }
    onClose();
  };

  const handleCancel = () => {
    if (hasChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to cancel?');
      if (!confirmed) return;
    }
    onClose();
  };

  if (!editedNode) {
    return null;
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={handleCancel}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            border: '1px solid rgba(0, 255, 255, 0.3)',
            minHeight: '60vh'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          borderBottom: '1px solid rgba(0, 255, 255, 0.2)'
        }}>
          <EditIcon sx={{ color: '#00ffff' }} />
          <Typography variant="h6" sx={{ color: '#00ffff' }}>
            Edit Node
          </Typography>
          <Chip 
            label={editedNode.id} 
            size="small" 
            sx={{ ml: 'auto', backgroundColor: 'rgba(0, 255, 255, 0.1)' }}
          />
          {hasChanges && (
            <Chip 
              label="Modified" 
              size="small" 
              color="warning"
              sx={{ backgroundColor: 'rgba(255, 170, 0, 0.2)' }}
            />
          )}
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Basic Properties */}
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#00ffff', mb: 2 }}>
                Basic Properties
              </Typography>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
                <TextField
                  label="Name"
                  value={editedNode.name || ''}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  variant="outlined"
                  fullWidth
                />
                
                <TextField
                  label="Symbol"
                  value={editedNode.symbol || ''}
                  onChange={(e) => handleFieldChange('symbol', e.target.value)}
                  variant="outlined"
                  fullWidth
                />
              </Box>
              
              <TextField
                label="Translation"
                value={editedNode.translation || ''}
                onChange={(e) => handleFieldChange('translation', e.target.value)}
                variant="outlined"
                fullWidth
                multiline
                rows={2}
                sx={{ mb: 2 }}
              />
              
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={editedNode.type || 'premise'}
                    onChange={(e) => handleFieldChange('type', e.target.value)}
                    label="Type"
                  >
                    <MenuItem value="premise">Premise</MenuItem>
                    <MenuItem value="conclusion">Conclusion</MenuItem>
                    <MenuItem value="term">Term</MenuItem>
                    <MenuItem value="fallacy">Fallacy</MenuItem>
                    <MenuItem value="core">Core</MenuItem>
                    <MenuItem value="informal">Informal</MenuItem>
                    <MenuItem value="temporal">Temporal</MenuItem>
                  </Select>
                </FormControl>
                
                <TextField
                  label="Zone"
                  value={editedNode.zone || ''}
                  onChange={(e) => handleFieldChange('zone', e.target.value)}
                  variant="outlined"
                  fullWidth
                />
              </Box>
            </Box>

            <Divider sx={{ borderColor: 'rgba(0, 255, 255, 0.2)' }} />

            {/* Markdown Reference */}
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#00ffff', mb: 2 }}>
                Markdown Reference
              </Typography>
              
              {editedNode.markdownRef ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <MarkdownReferenceIndicator
                    reference={editedNode.markdownRef}
                    size="medium"
                    showLabel={true}
                    onNavigate={onNavigateToReference}
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleFieldChange('markdownRef', undefined)}
                    sx={{ color: '#ff6b6b' }}
                  >
                    <ClearIcon />
                  </IconButton>
                </Box>
              ) : (
                <Alert 
                  severity="info" 
                  sx={{ 
                    backgroundColor: 'rgba(0, 255, 255, 0.1)',
                    border: '1px solid rgba(0, 255, 255, 0.3)',
                    mb: 2
                  }}
                >
                  No markdown reference linked to this node.
                </Alert>
              )}
              
              <Button
                variant="outlined"
                startIcon={<LinkIcon />}
                onClick={() => setReferenceDialogOpen(true)}
                sx={{
                  borderColor: '#00ffff',
                  color: '#00ffff',
                  '&:hover': {
                    borderColor: '#00ccff',
                    backgroundColor: 'rgba(0, 255, 255, 0.1)'
                  }
                }}
              >
                {editedNode.markdownRef ? 'Change Reference' : 'Add Reference'}
              </Button>
            </Box>

            <Divider sx={{ borderColor: 'rgba(0, 255, 255, 0.2)' }} />

            {/* Facets */}
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#00ffff', mb: 2 }}>
                Facets
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label="Venn Relevant"
                  clickable
                  color={editedNode.facets?.vennRelevant ? 'primary' : 'default'}
                  onClick={() => handleFieldChange('facets', {
                    ...editedNode.facets,
                    vennRelevant: !editedNode.facets?.vennRelevant
                  })}
                />
                <Chip
                  label="Truth Table Relevant"
                  clickable
                  color={editedNode.facets?.truthTableRelevant ? 'primary' : 'default'}
                  onClick={() => handleFieldChange('facets', {
                    ...editedNode.facets,
                    truthTableRelevant: !editedNode.facets?.truthTableRelevant
                  })}
                />
                <Chip
                  label="Timeline Relevant"
                  clickable
                  color={editedNode.facets?.timelineRelevant ? 'primary' : 'default'}
                  onClick={() => handleFieldChange('facets', {
                    ...editedNode.facets,
                    timelineRelevant: !editedNode.facets?.timelineRelevant
                  })}
                />
                <Chip
                  label="Counter Relevant"
                  clickable
                  color={editedNode.facets?.counterRelevant ? 'primary' : 'default'}
                  onClick={() => handleFieldChange('facets', {
                    ...editedNode.facets,
                    counterRelevant: !editedNode.facets?.counterRelevant
                  })}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ borderTop: '1px solid rgba(0, 255, 255, 0.2)', p: 2 }}>
          <Button 
            onClick={handleCancel} 
            color="secondary"
            startIcon={<CloseIcon />}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!hasChanges}
            startIcon={<SaveIcon />}
            sx={{
              background: hasChanges 
                ? 'linear-gradient(45deg, #00ffff, #0080ff)'
                : 'rgba(128, 128, 128, 0.3)',
              '&:hover': hasChanges ? {
                background: 'linear-gradient(45deg, #00cccc, #0066cc)'
              } : {}
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Markdown Reference Selector */}
      <MarkdownReferenceSelector
        open={referenceDialogOpen}
        onClose={() => setReferenceDialogOpen(false)}
        onSelect={handleReferenceSelect}
        currentReference={editedNode.markdownRef}
        nodeId={editedNode.id}
      />
    </>
  );
}
