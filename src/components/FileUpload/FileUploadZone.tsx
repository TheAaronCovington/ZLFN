/**
 * File Upload Zone Component
 * Drag-and-drop file upload with validation and progress tracking
 */

import React, { useState, useCallback, useRef } from 'react'
import {
  Box,
  Typography,
  Button,
  LinearProgress,
  Alert,
  Chip,
  IconButton,
  Collapse,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material'
import {
  CloudUpload as CloudUploadIcon,
  InsertDriveFile as FileIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Close as CloseIcon,
  Merge as MergeIcon,
  Description as DescriptionIcon,
  Code as CodeIcon
} from '@mui/icons-material'
import { useZLFN } from '../../context/ZLFNContext'

interface FileUploadZoneProps {
  onFileUpload?: (files: File[]) => void
  onUploadComplete?: (results: any[]) => void
  acceptedTypes?: string[]
  maxFileSize?: number // in bytes
  maxFiles?: number
  existingObjectId?: string
  showMergeOptions?: boolean
}

interface UploadFile {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  result?: any
}

export function FileUploadZone({
  onFileUpload,
  onUploadComplete,
  acceptedTypes = ['.md', '.json'],
  maxFileSize = 10 * 1024 * 1024, // 10MB
  maxFiles = 5,
  existingObjectId,
  showMergeOptions = true
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const { importFile, state } = useZLFN()

  // Validate file
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!acceptedTypes.includes(fileExtension)) {
      return {
        valid: false,
        error: `File type ${fileExtension} not supported. Accepted types: ${acceptedTypes.join(', ')}`
      }
    }

    // Check file size
    if (file.size > maxFileSize) {
      return {
        valid: false,
        error: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds limit of ${(maxFileSize / 1024 / 1024).toFixed(1)}MB`
      }
    }

    return { valid: true }
  }, [acceptedTypes, maxFileSize])

  // Handle file selection
  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    
    // Check max files limit
    if (uploadFiles.length + fileArray.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`)
      return
    }

    const newUploadFiles: UploadFile[] = []
    
    fileArray.forEach(file => {
      const validation = validateFile(file)
      const uploadFile: UploadFile = {
        file,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        status: validation.valid ? 'pending' : 'error',
        progress: 0,
        error: validation.error
      }
      newUploadFiles.push(uploadFile)
    })

    setUploadFiles(prev => [...prev, ...newUploadFiles])
    onFileUpload?.(fileArray)
  }, [uploadFiles.length, maxFiles, validateFile, onFileUpload])

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFiles(files)
    }
  }, [handleFiles])

  // File input handler
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [handleFiles])

  // Upload files
  const handleUpload = useCallback(async () => {
    const pendingFiles = uploadFiles.filter(f => f.status === 'pending')
    if (pendingFiles.length === 0) return

    setIsUploading(true)
    const results: any[] = []

    for (const uploadFile of pendingFiles) {
      // Update status to uploading
      setUploadFiles(prev => prev.map(f => 
        f.id === uploadFile.id ? { ...f, status: 'uploading' as const, progress: 0 } : f
      ))

      try {
        // Simulate progress
        const progressInterval = setInterval(() => {
          setUploadFiles(prev => prev.map(f => 
            f.id === uploadFile.id && f.progress < 90 
              ? { ...f, progress: f.progress + 10 } 
              : f
          ))
        }, 100)

        // Upload file
        const result = await importFile(uploadFile.file)
        
        clearInterval(progressInterval)
        
        if (result) {
          // Success
          setUploadFiles(prev => prev.map(f => 
            f.id === uploadFile.id 
              ? { ...f, status: 'success' as const, progress: 100, result } 
              : f
          ))
          results.push(result)
        } else {
          // Error
          setUploadFiles(prev => prev.map(f => 
            f.id === uploadFile.id 
              ? { ...f, status: 'error' as const, progress: 0, error: 'Upload failed' } 
              : f
          ))
        }
      } catch (error) {
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { 
                ...f, 
                status: 'error' as const, 
                progress: 0, 
                error: error instanceof Error ? error.message : 'Upload failed' 
              } 
            : f
        ))
      }
    }

    setIsUploading(false)
    setShowResults(true)
    onUploadComplete?.(results)
  }, [uploadFiles, importFile, existingObjectId, onUploadComplete])

  // Remove file
  const removeFile = useCallback((fileId: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== fileId))
  }, [])

  // Clear all files
  const clearAll = useCallback(() => {
    setUploadFiles([])
    setShowResults(false)
  }, [])

  // Get file type icon
  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'md':
        return <DescriptionIcon />
      case 'json':
        return <CodeIcon />
      default:
        return <FileIcon />
    }
  }

  const pendingFiles = uploadFiles.filter(f => f.status === 'pending')
  const hasValidFiles = pendingFiles.length > 0
  const uploadingFiles = uploadFiles.filter(f => f.status === 'uploading')
  const successFiles = uploadFiles.filter(f => f.status === 'success')
  const errorFiles = uploadFiles.filter(f => f.status === 'error')

  return (
    <Box sx={{ width: '100%' }}>
      {/* Upload Zone */}
      <Paper
        sx={{
          p: 4,
          border: `2px dashed ${isDragOver ? '#40c4ff' : 'rgba(255, 255, 255, 0.3)'}`,
          borderRadius: 2,
          bgcolor: isDragOver ? 'rgba(64, 196, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          textAlign: 'center',
          '&:hover': {
            borderColor: '#40c4ff',
            bgcolor: 'rgba(64, 196, 255, 0.05)'
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <CloudUploadIcon sx={{ fontSize: 48, color: '#40c4ff', mb: 2 }} />
        
        <Typography variant="h6" sx={{ color: '#40c4ff', mb: 1 }}>
          {isDragOver ? 'Drop files here' : 'Upload ZLFN Files'}
        </Typography>
        
        <Typography variant="body2" sx={{ color: '#b0bec5', mb: 2 }}>
          Drag and drop files here, or click to browse
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {acceptedTypes.map(type => (
            <Chip 
              key={type}
              label={type}
              size="small"
              sx={{ bgcolor: 'rgba(64, 196, 255, 0.2)', color: '#40c4ff' }}
            />
          ))}
        </Box>
        
        <Typography variant="caption" sx={{ color: '#666' }}>
          Max {maxFiles} files, {(maxFileSize / 1024 / 1024).toFixed(0)}MB each
        </Typography>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
      </Paper>

      {/* File List */}
      {uploadFiles.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ color: '#40c4ff' }}>
              Files ({uploadFiles.length})
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {hasValidFiles && (
                <Button
                  variant="contained"
                  startIcon={<MergeIcon />}
                  onClick={handleUpload}
                  disabled={isUploading || state.isLoading}
                  sx={{ bgcolor: '#40c4ff' }}
                >
                  {isUploading ? 'Uploading...' : `Upload ${pendingFiles.length} files`}
                </Button>
              )}
              <Button
                variant="outlined"
                onClick={clearAll}
                disabled={isUploading}
              >
                Clear All
              </Button>
            </Box>
          </Box>

          <Paper sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)' }}>
            <List>
              {uploadFiles.map((uploadFile, index) => (
                <ListItem key={uploadFile.id} divider={index < uploadFiles.length - 1}>
                  <ListItemIcon>
                    {getFileIcon(uploadFile.file.name)}
                  </ListItemIcon>
                  
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                          {uploadFile.file.name}
                        </Typography>
                        <Chip
                          size="small"
                          label={uploadFile.status}
                          color={
                            uploadFile.status === 'success' ? 'success' :
                            uploadFile.status === 'error' ? 'error' :
                            uploadFile.status === 'uploading' ? 'warning' : 'default'
                          }
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="caption" sx={{ color: '#b0bec5' }}>
                          {(uploadFile.file.size / 1024).toFixed(1)} KB
                        </Typography>
                        {uploadFile.error && (
                          <Typography variant="caption" sx={{ color: '#f44336', display: 'block' }}>
                            {uploadFile.error}
                          </Typography>
                        )}
                        {uploadFile.status === 'uploading' && (
                          <LinearProgress 
                            variant="determinate" 
                            value={uploadFile.progress} 
                            sx={{ mt: 1 }}
                          />
                        )}
                      </Box>
                    }
                  />
                  
                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {uploadFile.status === 'success' && <CheckCircleIcon color="success" />}
                      {uploadFile.status === 'error' && <ErrorIcon color="error" />}
                      <IconButton
                        edge="end"
                        onClick={() => removeFile(uploadFile.id)}
                        disabled={uploadFile.status === 'uploading'}
                        size="small"
                      >
                        <CloseIcon />
                      </IconButton>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Box>
      )}

      {/* Results Summary */}
      <Collapse in={showResults}>
        <Box sx={{ mt: 3 }}>
          {successFiles.length > 0 && (
            <Alert severity="success" sx={{ mb: 1 }}>
              Successfully uploaded {successFiles.length} file{successFiles.length > 1 ? 's' : ''}
              {existingObjectId && showMergeOptions && ' and merged with existing object'}
            </Alert>
          )}
          
          {errorFiles.length > 0 && (
            <Alert severity="error" sx={{ mb: 1 }}>
              Failed to upload {errorFiles.length} file{errorFiles.length > 1 ? 's' : ''}
            </Alert>
          )}
          
          {uploadingFiles.length > 0 && (
            <Alert severity="info">
              Uploading {uploadingFiles.length} file{uploadingFiles.length > 1 ? 's' : ''}...
            </Alert>
          )}
        </Box>
      </Collapse>

      {/* Global Loading State */}
      {state.isLoading && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress />
          <Typography variant="caption" sx={{ color: '#b0bec5', mt: 1, display: 'block' }}>
            Processing files...
          </Typography>
        </Box>
      )}
    </Box>
  )
}

export default FileUploadZone
