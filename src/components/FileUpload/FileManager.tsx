/**
 * File Manager Component
 * Complete file management interface with upload, merge, and conflict resolution
 */

import React, { useState, useCallback } from 'react'
import {
  Box,
  Typography,
  Button,
  Paper,
  Tabs,
  Tab,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Collapse
} from '@mui/material'
import {
  CloudUpload as CloudUploadIcon,
  Merge as MergeIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material'
import { FileUploadZone } from './FileUploadZone'
import { MergeOptionsDialog } from './MergeOptionsDialog'
import { useZLFN } from '../../context/ZLFNContext'
import type { Conflict, MergeOptions, ImportResult } from '../../types/zlfn'

interface FileManagerProps {
  objectId?: string
  onFileProcessed?: (result: ImportResult) => void
  showAdvancedOptions?: boolean
  compact?: boolean
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`file-manager-tabpanel-${index}`}
      aria-labelledby={`file-manager-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  )
}

export function FileManager({
  objectId,
  onFileProcessed,
  showAdvancedOptions = true,
  compact = false
}: FileManagerProps) {
  const [activeTab, setActiveTab] = useState(0)
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [pendingMerge, setPendingMerge] = useState<{
    file: File
    conflicts: Conflict[]
  } | null>(null)
  const [uploadResults, setUploadResults] = useState<ImportResult[]>([])
  const [_showResults, setShowResults] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const { state, importFile, getVersionHistory } = useZLFN()

  // Handle file upload completion
  const handleUploadComplete = useCallback((results: ImportResult[]) => {
    setUploadResults(results)
    setShowResults(true)
    
    results.forEach(result => {
      onFileProcessed?.(result)
    })
  }, [onFileProcessed])

  // Handle merge confirmation
  const handleMergeConfirm = useCallback(async (_options: MergeOptions) => {
    if (!pendingMerge) return

    setMergeDialogOpen(false)
    
    try {
      // Process the merge with the selected options
      const result = await importFile(pendingMerge.file)
      
      if (result) {
        setUploadResults([result])
        setShowResults(true)
        onFileProcessed?.(result)
      }
    } catch (error) {
      console.error('Merge failed:', error)
    } finally {
      setPendingMerge(null)
    }
  }, [pendingMerge, importFile, objectId, onFileProcessed])

  // Get upload statistics
  const getUploadStats = () => {
    const total = uploadResults.length
    const successful = uploadResults.filter(r => r.success).length
    const failed = total - successful
    const totalMerged = uploadResults.reduce((sum, r) => sum + (r.mergedArguments || 0), 0)

    return { total, successful, failed, totalMerged }
  }

  const stats = getUploadStats()

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      {!compact && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h5" sx={{ color: '#40c4ff', fontWeight: 600 }}>
              File Manager
            </Typography>
            
            {showAdvancedOptions && (
              <Tooltip title="Advanced Options">
                <IconButton
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  sx={{ color: '#40c4ff' }}
                >
                  {showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Tooltip>
            )}
          </Box>
          
          <Typography variant="body2" sx={{ color: '#b0bec5' }}>
            Upload and manage ZLFN files with intelligent merging and conflict resolution
          </Typography>
        </Box>
      )}

      {/* Advanced Options */}
      <Collapse in={showAdvanced}>
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(64, 196, 255, 0.1)', border: '1px solid rgba(64, 196, 255, 0.3)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <SettingsIcon sx={{ color: '#40c4ff', fontSize: 18 }} />
            <Typography variant="subtitle2" sx={{ color: '#40c4ff' }}>
              Advanced Options
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip
              label={objectId ? `Target: ${objectId}` : 'No target object'}
              size="small"
              color={objectId ? 'success' : 'default'}
              sx={{ fontFamily: 'monospace' }}
            />
            
            <Chip
              label="Auto-merge enabled"
              size="small"
              color="info"
            />
            
            <Chip
              label="Conflict detection active"
              size="small"
              color="warning"
            />
          </Box>
        </Paper>
      </Collapse>

      {/* Status Summary */}
      {state.currentObject && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="body2">
              Current object loaded: <strong>{state.currentObject.id}</strong>
            </Typography>
            <Button
              size="small"
              startIcon={<HistoryIcon />}
              onClick={() => getVersionHistory()}
              sx={{ color: '#40c4ff' }}
            >
              View History
            </Button>
          </Box>
        </Alert>
      )}

      {/* Main Content */}
      <Paper sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)' }}>
        {!compact && (
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              '& .MuiTab-root': { color: '#b0bec5' },
              '& .Mui-selected': { color: '#40c4ff' }
            }}
          >
            <Tab 
              icon={<CloudUploadIcon />} 
              label="Upload Files" 
              iconPosition="start"
            />
            <Tab 
              icon={<MergeIcon />} 
              label="Merge & Import" 
              iconPosition="start"
            />
            <Tab 
              icon={<HistoryIcon />} 
              label="Recent Activity" 
              iconPosition="start"
            />
          </Tabs>
        )}

        {/* Upload Tab */}
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ p: 3 }}>
            <FileUploadZone
              onUploadComplete={handleUploadComplete}
              existingObjectId={objectId}
              showMergeOptions={true}
            />
          </Box>
        </TabPanel>

        {/* Merge Tab */}
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ color: '#40c4ff', mb: 2 }}>
              Merge Operations
            </Typography>
            
            <Alert severity="info" sx={{ mb: 2 }}>
              Advanced merge operations with conflict resolution and data preservation options.
            </Alert>
            
            <FileUploadZone
              onUploadComplete={handleUploadComplete}
              existingObjectId={objectId}
              showMergeOptions={true}
              acceptedTypes={['.json']}
              maxFiles={1}
            />
          </Box>
        </TabPanel>

        {/* Activity Tab */}
        <TabPanel value={activeTab} index={2}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ color: '#40c4ff', mb: 2 }}>
              Recent Activity
            </Typography>
            
            {uploadResults.length > 0 ? (
              <Box>
                {/* Statistics */}
                <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
                  <Chip
                    label={`${stats.total} files processed`}
                    color="info"
                    size="small"
                  />
                  <Chip
                    label={`${stats.successful} successful`}
                    color="success"
                    size="small"
                  />
                  {stats.failed > 0 && (
                    <Chip
                      label={`${stats.failed} failed`}
                      color="error"
                      size="small"
                    />
                  )}
                  {stats.totalMerged > 0 && (
                    <Chip
                      label={`${stats.totalMerged} arguments merged`}
                      color="warning"
                      size="small"
                    />
                  )}
                </Box>

                {/* Results List */}
                {uploadResults.map((result, index) => (
                  <Alert
                    key={index}
                    severity={result.success ? 'success' : 'error'}
                    sx={{ mb: 1 }}
                  >
                    <Typography variant="body2">
                      {result.success ? (
                        <>
                          <strong>Success:</strong> {result.mergedArguments || 0} arguments processed
                          {result.objectId && ` (Object: ${result.objectId})`}
                        </>
                      ) : (
                        <>
                          <strong>Failed:</strong> {result.errors?.join(', ') || 'Unknown error'}
                        </>
                      )}
                    </Typography>
                    
                    {result.warnings && result.warnings.length > 0 && (
                      <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#ff9800' }}>
                        Warnings: {result.warnings.join(', ')}
                      </Typography>
                    )}
                  </Alert>
                ))}
              </Box>
            ) : (
              <Alert severity="info">
                No recent file operations. Upload files to see activity here.
              </Alert>
            )}
          </Box>
        </TabPanel>

        {/* Compact Mode */}
        {compact && (
          <Box sx={{ p: 2 }}>
            <FileUploadZone
              onUploadComplete={handleUploadComplete}
              existingObjectId={objectId}
              showMergeOptions={false}
              maxFiles={3}
            />
          </Box>
        )}
      </Paper>

      {/* Merge Options Dialog */}
      <MergeOptionsDialog
        open={mergeDialogOpen}
        onClose={() => {
          setMergeDialogOpen(false)
          setPendingMerge(null)
        }}
        onConfirm={handleMergeConfirm}
        conflicts={pendingMerge?.conflicts || []}
        fileName={pendingMerge?.file.name || ''}
        existingObjectName={state.currentObject?.id || 'Current Object'}
      />

      {/* Loading State */}
      {state.isLoading && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Processing files... Please wait.
        </Alert>
      )}

      {/* Error State */}
      {state.error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {state.error}
        </Alert>
      )}
    </Box>
  )
}

export default FileManager
