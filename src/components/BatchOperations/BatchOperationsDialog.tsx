import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  Typography,
  TextField,
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  LinearProgress,
  Alert,
  Chip,

  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  Autocomplete
} from '@mui/material';
import {
  Edit as EditIcon,
  History as HistoryIcon,
  Download as ExportIcon,

  Add as AddIcon,
  Remove as RemoveIcon,
  PlayArrow as StartIcon,
  Stop as CancelIcon,
  CheckCircle as CompletedIcon,
  Error as ErrorIcon,
  Schedule as PendingIcon
} from '@mui/icons-material';
import { batchOperations, type BatchOperation, type BatchNoteEdit, type BatchVersionOperation, type BatchExportOptions } from '../../services/batchOperations';
import { api } from '../../services/zlfnAPI';

interface BatchOperationsDialogProps {
  open: boolean;
  onClose: () => void;
  initialTab?: number;
}

type TabValue = 'notes' | 'versions' | 'export' | 'status';

export default function BatchOperationsDialog({ open, onClose, initialTab = 0 }: BatchOperationsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('notes');
  const [operations, setOperations] = useState<BatchOperation[]>([]);
  
  // Notes tab state
  const [noteEdits, setNoteEdits] = useState<BatchNoteEdit[]>([]);
  const [availableObjects, setAvailableObjects] = useState<string[]>([]);
  
  // Versions tab state
  const [versionOps, setVersionOps] = useState<BatchVersionOperation[]>([]);
  
  // Export tab state
  const [exportOptions, setExportOptions] = useState<BatchExportOptions>({
    objectIds: [],
    format: 'json',
    includeNotes: true,
    includeVersionHistory: false
  });

  const tabs: { value: TabValue; label: string; icon: React.ReactElement }[] = [
    { value: 'notes', label: 'Bulk Notes', icon: <EditIcon /> },
    { value: 'versions', label: 'Version Ops', icon: <HistoryIcon /> },
    { value: 'export', label: 'Batch Export', icon: <ExportIcon /> },
    { value: 'status', label: 'Operations', icon: <PendingIcon /> }
  ];

  useEffect(() => {
    if (open) {
      loadAvailableObjects();
      const unsubscribe = batchOperations.subscribe(setOperations);
      setOperations(batchOperations.getAllOperations());
      return () => {
        unsubscribe();
      };
    }
  }, [open]);

  useEffect(() => {
    if (initialTab >= 0 && initialTab < tabs.length) {
      setActiveTab(tabs[initialTab].value);
    }
  }, [initialTab]);

  const loadAvailableObjects = async () => {
    try {
      const response = await api.getAllObjects();
      if (response.success && response.data) {
        setAvailableObjects(response.data.map(obj => obj.id));
      }
    } catch (error) {
      console.error('Failed to load objects:', error);
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: TabValue) => {
    setActiveTab(newValue);
  };

  // Notes tab handlers
  const addNoteEdit = () => {
    setNoteEdits([...noteEdits, {
      objectId: '',
      nodeId: '',
      oldContent: '',
      newContent: ''
    }]);
  };

  const removeNoteEdit = (index: number) => {
    setNoteEdits(noteEdits.filter((_, i) => i !== index));
  };

  const updateNoteEdit = (index: number, field: keyof BatchNoteEdit, value: string) => {
    const updated = [...noteEdits];
    updated[index] = { ...updated[index], [field]: value };
    setNoteEdits(updated);
  };

  const executeBatchNoteEdits = async () => {
    if (noteEdits.length === 0) return;
    
    try {
      await batchOperations.batchEditNotes(noteEdits);
      setNoteEdits([]);
    } catch (error) {
      console.error('Batch note edit failed:', error);
    }
  };

  // Version operations handlers
  const addVersionOp = () => {
    setVersionOps([...versionOps, {
      objectId: '',
      versionTimestamp: '',
      operation: 'revert'
    }]);
  };

  const removeVersionOp = (index: number) => {
    setVersionOps(versionOps.filter((_, i) => i !== index));
  };

  const updateVersionOp = (index: number, field: keyof BatchVersionOperation, value: string) => {
    const updated = [...versionOps];
    updated[index] = { ...updated[index], [field]: value };
    setVersionOps(updated);
  };

  const executeBatchVersionOps = async () => {
    if (versionOps.length === 0) return;
    
    try {
      await batchOperations.batchVersionOperations(versionOps);
      setVersionOps([]);
    } catch (error) {
      console.error('Batch version operations failed:', error);
    }
  };

  // Export handlers
  const executeBatchExport = async () => {
    if (exportOptions.objectIds.length === 0) return;
    
    try {
      await batchOperations.batchExport(exportOptions);
    } catch (error) {
      console.error('Batch export failed:', error);
    }
  };

  const getOperationIcon = (operation: BatchOperation) => {
    switch (operation.status) {
      case 'completed': return <CompletedIcon sx={{ color: 'success.main' }} />;
      case 'failed': return <ErrorIcon sx={{ color: 'error.main' }} />;
      case 'running': return <PendingIcon sx={{ color: 'warning.main' }} />;
      default: return <PendingIcon sx={{ color: 'info.main' }} />;
    }
  };

  const getOperationColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'running': return 'warning';
      default: return 'info';
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'rgba(25, 25, 35, 0.95)',
          border: '1px solid rgba(64, 196, 255, 0.3)',
          borderRadius: 2,
          minHeight: '70vh'
        }
      }}
    >
      <DialogTitle sx={{ color: '#40c4ff', borderBottom: '1px solid rgba(64, 196, 255, 0.2)' }}>
        Batch Operations
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            borderBottom: '1px solid rgba(64, 196, 255, 0.2)',
            '& .MuiTab-root': { color: '#b0bec5' },
            '& .Mui-selected': { color: '#40c4ff' }
          }}
        >
          {tabs.map((tab) => (
            <Tab
              key={tab.value}
              value={tab.value}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
            />
          ))}
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ color: '#40c4ff' }}>
                  Bulk Note Editing
                </Typography>
                <Button
                  startIcon={<AddIcon />}
                  onClick={addNoteEdit}
                  variant="outlined"
                  size="small"
                >
                  Add Edit
                </Button>
              </Box>

              <List>
                {noteEdits.map((edit, index) => (
                  <ListItem key={index} sx={{ border: '1px solid rgba(64, 196, 255, 0.2)', borderRadius: 1, mb: 1 }}>
                    <Box sx={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 2fr auto', gap: 2, alignItems: 'center' }}>
                      <Autocomplete
                        options={availableObjects}
                        value={edit.objectId}
                        onChange={(_, value) => updateNoteEdit(index, 'objectId', value || '')}
                        renderInput={(params) => (
                          <TextField {...params} label="Object ID" size="small" />
                        )}
                        size="small"
                      />
                      <TextField
                        label="Node ID"
                        value={edit.nodeId}
                        onChange={(e) => updateNoteEdit(index, 'nodeId', e.target.value)}
                        size="small"
                      />
                      <TextField
                        label="Old Content"
                        value={edit.oldContent}
                        onChange={(e) => updateNoteEdit(index, 'oldContent', e.target.value)}
                        multiline
                        rows={2}
                        size="small"
                      />
                      <TextField
                        label="New Content"
                        value={edit.newContent}
                        onChange={(e) => updateNoteEdit(index, 'newContent', e.target.value)}
                        multiline
                        rows={2}
                        size="small"
                      />
                      <IconButton onClick={() => removeNoteEdit(index)} color="error">
                        <RemoveIcon />
                      </IconButton>
                    </Box>
                  </ListItem>
                ))}
              </List>

              {noteEdits.length > 0 && (
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    startIcon={<StartIcon />}
                    onClick={executeBatchNoteEdits}
                    variant="contained"
                    sx={{ bgcolor: '#40c4ff' }}
                  >
                    Execute Batch Edit ({noteEdits.length} items)
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {/* Versions Tab */}
          {activeTab === 'versions' && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ color: '#40c4ff' }}>
                  Batch Version Operations
                </Typography>
                <Button
                  startIcon={<AddIcon />}
                  onClick={addVersionOp}
                  variant="outlined"
                  size="small"
                >
                  Add Operation
                </Button>
              </Box>

              <List>
                {versionOps.map((op, index) => (
                  <ListItem key={index} sx={{ border: '1px solid rgba(64, 196, 255, 0.2)', borderRadius: 1, mb: 1 }}>
                    <Box sx={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 2, alignItems: 'center' }}>
                      <Autocomplete
                        options={availableObjects}
                        value={op.objectId}
                        onChange={(_, value) => updateVersionOp(index, 'objectId', value || '')}
                        renderInput={(params) => (
                          <TextField {...params} label="Object ID" size="small" />
                        )}
                        size="small"
                      />
                      <TextField
                        label="Version Timestamp"
                        value={op.versionTimestamp}
                        onChange={(e) => updateVersionOp(index, 'versionTimestamp', e.target.value)}
                        size="small"
                        type="datetime-local"
                      />
                      <FormControl size="small">
                        <FormLabel>Operation</FormLabel>
                        <RadioGroup
                          value={op.operation}
                          onChange={(e) => updateVersionOp(index, 'operation', e.target.value)}
                          row
                        >
                          <FormControlLabel value="revert" control={<Radio size="small" />} label="Revert" />
                          <FormControlLabel value="delete" control={<Radio size="small" />} label="Delete" />
                          <FormControlLabel value="compare" control={<Radio size="small" />} label="Compare" />
                        </RadioGroup>
                      </FormControl>
                      <IconButton onClick={() => removeVersionOp(index)} color="error">
                        <RemoveIcon />
                      </IconButton>
                    </Box>
                  </ListItem>
                ))}
              </List>

              {versionOps.length > 0 && (
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    startIcon={<StartIcon />}
                    onClick={executeBatchVersionOps}
                    variant="contained"
                    sx={{ bgcolor: '#40c4ff' }}
                  >
                    Execute Version Operations ({versionOps.length} items)
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {/* Export Tab */}
          {activeTab === 'export' && (
            <Box>
              <Typography variant="h6" sx={{ color: '#40c4ff', mb: 2 }}>
                Batch Export
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ color: '#8ad7ff', mb: 1 }}>
                    Objects to Export
                  </Typography>
                  <Autocomplete
                    multiple
                    options={availableObjects}
                    value={exportOptions.objectIds}
                    onChange={(_, value) => setExportOptions(prev => ({ ...prev, objectIds: value }))}
                    renderInput={(params) => (
                      <TextField {...params} label="Select Objects" />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          {...getTagProps({ index })}
                          key={option}
                          label={option}
                          size="small"
                          sx={{ bgcolor: 'rgba(64, 196, 255, 0.2)' }}
                        />
                      ))
                    }
                  />
                </Box>

                <Box>
                  <Typography variant="subtitle1" sx={{ color: '#8ad7ff', mb: 1 }}>
                    Export Options
                  </Typography>
                  <FormControl component="fieldset">
                    <FormLabel component="legend" sx={{ color: '#b0bec5' }}>Format</FormLabel>
                    <RadioGroup
                      value={exportOptions.format}
                      onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as any }))}
                    >
                      <FormControlLabel value="json" control={<Radio />} label="JSON" />
                      <FormControlLabel value="markdown" control={<Radio />} label="Markdown" />
                      <FormControlLabel value="pdf" control={<Radio />} label="PDF" />
                    </RadioGroup>
                  </FormControl>

                  <Box sx={{ mt: 2 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={exportOptions.includeNotes}
                          onChange={(e) => setExportOptions(prev => ({ ...prev, includeNotes: e.target.checked }))}
                        />
                      }
                      label="Include Notes"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={exportOptions.includeVersionHistory}
                          onChange={(e) => setExportOptions(prev => ({ ...prev, includeVersionHistory: e.target.checked }))}
                        />
                      }
                      label="Include Version History"
                    />
                  </Box>
                </Box>
              </Box>

              {exportOptions.objectIds.length > 0 && (
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    startIcon={<ExportIcon />}
                    onClick={executeBatchExport}
                    variant="contained"
                    sx={{ bgcolor: '#40c4ff' }}
                  >
                    Export {exportOptions.objectIds.length} Objects
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {/* Status Tab */}
          {activeTab === 'status' && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ color: '#40c4ff' }}>
                  Operation Status
                </Typography>
                <Button
                  onClick={() => batchOperations.clearCompleted()}
                  variant="outlined"
                  size="small"
                >
                  Clear Completed
                </Button>
              </Box>

              {operations.length === 0 ? (
                <Alert severity="info" sx={{ bgcolor: 'rgba(64, 196, 255, 0.1)' }}>
                  No batch operations running
                </Alert>
              ) : (
                <List>
                  {operations.map((operation) => (
                    <ListItem key={operation.id} sx={{ border: '1px solid rgba(64, 196, 255, 0.2)', borderRadius: 1, mb: 1 }}>
                      <ListItemIcon>
                        {getOperationIcon(operation)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle2" sx={{ color: '#e0f2ff' }}>
                              {operation.type.replace('-', ' ').toUpperCase()}
                            </Typography>
                            <Chip
                              label={operation.status}
                              size="small"
                              color={getOperationColor(operation.status) as any}
                            />
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={operation.progress}
                              sx={{
                                mb: 1,
                                '& .MuiLinearProgress-bar': {
                                  bgcolor: operation.status === 'failed' ? 'error.main' : '#40c4ff'
                                }
                              }}
                            />
                            <Typography variant="caption" sx={{ color: '#b0bec5' }}>
                              {operation.progress.toFixed(1)}% complete
                              {operation.error && ` • Error: ${operation.error}`}
                            </Typography>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        {operation.status === 'pending' && (
                          <IconButton
                            onClick={() => batchOperations.cancelOperation(operation.id)}
                            color="error"
                            size="small"
                          >
                            <CancelIcon />
                          </IconButton>
                        )}
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(64, 196, 255, 0.2)' }}>
        <Button onClick={onClose} sx={{ color: '#b0bec5' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
