import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Fade,
  Backdrop,
  LinearProgress,
  Chip,
  Stack,
  Button,

} from '@mui/material'
import {
  Close as CloseIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Upload as UploadIcon,
  Description as DescriptionIcon
} from '@mui/icons-material'
import ObjectForm from './ObjectForm'
import { readJsonFile } from '../../services/io'


interface ObjectFormModalProps {
  open: boolean
  onClose: () => void
  mode?: 'create' | 'edit'
  objectId?: string
  initialData?: any // For pre-populated data from imports
}

export default function ObjectFormModal({ 
  open, 
  onClose, 
  mode = 'create', 
  objectId,
  initialData
}: ObjectFormModalProps) {
  const [isSubmitting] = useState(false)
  const [formProgress, setFormProgress] = useState(0)
  const [importedData, setImportedData] = useState<any>(null)

  // Calculate form completion progress (mock for now)
  React.useEffect(() => {
    if (open) {
      setFormProgress(25) // Basic progress simulation
    }
  }, [open])

  // Handle imported data
  React.useEffect(() => {
    if (initialData) {
      setImportedData(initialData)
      setFormProgress(75) // Higher progress for imported data
    }
  }, [initialData])

  const handleClose = () => {
    if (!isSubmitting) {
      setImportedData(null) // Clear imported data on close
      onClose()
    }
  }

  // Import handlers
  const handleJSONImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        try {
          const data = await readJsonFile(file)
          // Use the LogicSharedContext to properly handle multi-core imports
          // This will create separate SharedArguments with core metadata
          window.dispatchEvent(new CustomEvent('xv:add-imported-json', { detail: data }))
          setImportedData({ imported: true, coreCount: data.arguments?.length || 1 })
          setFormProgress(75)
          // Close the modal since the import is handled by the context
          onClose()
        } catch (error) {
          console.error('Failed to import JSON:', error)
        }
      }
    }
    input.click()
  }

  const handleMarkdownImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown,.txt'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        try {
          const content = await file.text()
          const fileName = file.name.replace(/\.(md|markdown|txt)$/, '')
          
          // Create a basic ZLFN structure with the markdown content
          const markdownData = {
            markdownContent: content,
            arguments: [{
              title: fileName,
              markdown: {
                documentId: fileName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                content: content
              },
              core: {
                name: fileName,
                summary: `Imported from ${file.name}`,
                layoutMode: "network",
                variables: {},
                mode: {
                  zlfMode: true,
                  atnMode: true
                },
                metadata: {
                  confidence: 0.5,
                  uncertain: [],
                  domain: "general"
                }
              },
              zones: [],
              dependencies: [],
              modes: {
                zlfn: { enabled: true },
                atn: { enabled: true }
              },
              counterarguments: [],
              subarguments: [],
              validation: {
                isValid: true,
                errors: [],
                warnings: []
              },
              pagination: {
                currentPage: 1,
                totalPages: 1,
                hasNext: false,
                hasPrevious: false
              },
              zlfnGraph: {
                nodes: [
                  {
                    id: "core",
                    label: fileName,
                    type: "core",
                    zone: "core",
                    position: { x: 0, y: 0 }
                  }
                ],
                edges: [],
                zones: [
                  { name: "core", bounds: { x: -50, y: -50, width: 100, height: 100 } }
                ]
              }
            }]
          }
          
          setImportedData(markdownData)
          setFormProgress(75)
        } catch (error) {
          console.error('Error reading markdown file:', error)
          alert('Error reading markdown file. Please try again.')
        }
      }
    }
    input.click()
  }

  const handleClearImport = () => {
    setImportedData(null)
    setFormProgress(25)
  }



  const getModalTitle = () => {
    if (mode === 'edit') {
      return 'Edit Argument'
    }
    return 'Create New Argument'
  }

  const getModalSubtitle = () => {
    if (mode === 'edit') {
      return 'Modify your existing argument structure'
    }
    return 'Build a new logical argument from scratch or import existing data'
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={false}
      fullWidth
      PaperProps={{
        className: 'object-form-modal',
        sx: {
          width: '90vw',
          height: '90vh',
          maxWidth: '1200px',
          maxHeight: '800px',
          background: 'rgba(30, 30, 47, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--ai-border-primary)',
          borderRadius: '16px',
          boxShadow: `
            0 20px 40px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            var(--ai-glow-cyan)
          `,
          overflow: 'hidden'
        }
      }}
      BackdropComponent={Backdrop}
      BackdropProps={{
        sx: {
          background: 'rgba(10, 10, 15, 0.8)',
          backdropFilter: 'blur(8px)'
        }
      }}
      TransitionComponent={Fade}
      transitionDuration={300}
    >
      {/* Header */}
      <Box
        sx={{
          position: 'relative',
          background: 'linear-gradient(135deg, var(--ai-bg-surface), var(--ai-bg-elevated))',
          borderBottom: '1px solid var(--ai-border-secondary)',
          padding: 'var(--ai-space-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        {/* Animated background sweep */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: '-100%',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(0, 229, 255, 0.1), transparent)',
            animation: 'headerSweep 8s infinite linear',
            zIndex: 1,
            '@keyframes headerSweep': {
              '0%': { left: '-100%' },
              '100%': { left: '100%' }
            }
          }}
        />

        {/* Title Section */}
        <Box sx={{ position: 'relative', zIndex: 2 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--ai-cyan), var(--ai-blue))',
                boxShadow: 'var(--ai-glow-cyan)'
              }}
            >
              {mode === 'edit' ? <EditIcon /> : <AddIcon />}
            </Box>
            <Box>
              <Typography
                variant="h5"
                sx={{
                  color: 'var(--ai-text-primary)',
                  fontWeight: 600,
                  marginBottom: '4px'
                }}
              >
                {getModalTitle()}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'var(--ai-text-secondary)',
                  fontSize: 'var(--ai-font-size-sm)'
                }}
              >
                {getModalSubtitle()}
              </Typography>
            </Box>
          </Stack>

          {/* Progress Indicator */}
          {formProgress > 0 && (
            <Box sx={{ mt: 2, width: '300px' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ color: 'var(--ai-text-tertiary)' }}>
                  Form Progress
                </Typography>
                <Chip
                  label={`${formProgress}%`}
                  size="small"
                  sx={{
                    background: 'var(--ai-cyan)',
                    color: 'var(--ai-bg-primary)',
                    fontSize: '0.7rem',
                    height: '20px'
                  }}
                />
                {importedData && (
                  <Chip
                    label="Imported"
                    size="small"
                    sx={{
                      background: 'var(--ai-green)',
                      color: 'var(--ai-bg-primary)',
                      fontSize: '0.7rem',
                      height: '20px'
                    }}
                  />
                )}
              </Stack>
              <LinearProgress
                variant="determinate"
                value={formProgress}
                sx={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  '& .MuiLinearProgress-bar': {
                    background: importedData 
                      ? 'linear-gradient(90deg, var(--ai-green), var(--ai-cyan))'
                      : 'linear-gradient(90deg, var(--ai-cyan), var(--ai-blue))',
                    borderRadius: 2
                  }
                }}
              />
            </Box>
          )}

          {/* Import Actions */}
          {mode === 'create' && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ color: 'var(--ai-text-tertiary)', mb: 1, display: 'block' }}>
                {importedData ? 'Import Additional Data' : 'Quick Start'}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  startIcon={<UploadIcon />}
                  onClick={handleJSONImport}
                  sx={{
                    color: 'var(--ai-cyan)',
                    borderColor: 'var(--ai-cyan)',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 229, 255, 0.1)',
                      borderColor: 'var(--ai-cyan)'
                    }
                  }}
                  variant="outlined"
                >
                  Import JSON
                </Button>
                <Button
                  size="small"
                  startIcon={<DescriptionIcon />}
                  onClick={handleMarkdownImport}
                  sx={{
                    color: 'var(--ai-purple)',
                    borderColor: 'var(--ai-purple)',
                    '&:hover': {
                      backgroundColor: 'rgba(187, 134, 252, 0.1)',
                      borderColor: 'var(--ai-purple)'
                    }
                  }}
                  variant="outlined"
                >
                  Import Markdown
                </Button>
              </Stack>
            </Box>
          )}

          {/* Clear Import */}
          {importedData && (
            <Box sx={{ mt: 2 }}>
              <Button
                size="small"
                onClick={handleClearImport}
                sx={{
                  color: 'var(--ai-orange)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 149, 0, 0.1)'
                  }
                }}
              >
                Clear Import & Start Fresh
              </Button>
            </Box>
          )}
        </Box>

        {/* Close Button */}
        <IconButton
          onClick={handleClose}
          disabled={isSubmitting}
          sx={{
            position: 'relative',
            zIndex: 2,
            color: 'var(--ai-text-secondary)',
            '&:hover': {
              color: 'var(--ai-text-primary)',
              background: 'rgba(255, 255, 255, 0.1)',
              transform: 'scale(1.1)'
            },
            transition: 'all var(--ai-transition-normal)'
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Form Content */}
      <DialogContent
        sx={{
          padding: 0,
          height: 'calc(100% - 120px)', // Account for header height
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* Loading Overlay */}
        {isSubmitting && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(10, 10, 15, 0.8)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <Box
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  border: '3px solid rgba(0, 229, 255, 0.3)',
                  borderTop: '3px solid var(--ai-cyan)',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' }
                  }
                }}
              />
              <Typography sx={{ color: 'var(--ai-text-primary)' }}>
                Saving argument...
              </Typography>
            </Box>
          </Box>
        )}

        {/* ObjectForm */}
        <Box sx={{ height: '100%', overflow: 'auto' }}>
          <ObjectForm
            objectId={objectId}
            onClose={handleClose}
            initialData={importedData}
          />
        </Box>
      </DialogContent>
    </Dialog>
  )
}
