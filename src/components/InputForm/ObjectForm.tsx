import React from 'react'
import { Box, Tabs, Tab, TextField, Button, Accordion, AccordionSummary, AccordionDetails, Typography, Select, MenuItem, Snackbar, Slider, Checkbox, Alert, LinearProgress } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { debounce } from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import type { ZLFNArgument, ZLFNObject, ZLFNStructure } from '../../types/zlfn'
import { createEmptyZLFNObject } from '../../types/zlfn'
import { getCurrentAPI, apiConfig } from '../../services/apiConfig'
import realAPI from '../../services/realAPI'
import { zlfnObjectManager } from '../../services/zlfnObjectManager'

interface ObjectFormProps {
  objectId?: string
  onClose: () => void
  initialData?: any
}

export default function ObjectForm({ objectId, onClose, initialData }: ObjectFormProps) {
  const [activeTab, setActiveTab] = React.useState(0)
  const [error, setError] = React.useState('')
  const [formData, setFormData] = React.useState<Partial<ZLFNObject>>(() => ({ 
    id: objectId || uuidv4(), 
    markdownContent: '', 
    zflnJson: { arguments: [] } as ZLFNStructure,
    metadata: {
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      fileReferences: []
    }
  }))
  const [errors, setErrors] = React.useState<{ [key: string]: string }>({})
  const [isValidating, setIsValidating] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [markdownFile, setMarkdownFile] = React.useState<File | null>(null)
  const [jsonFile, setJsonFile] = React.useState<File | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!objectId) return
      const res = await getCurrentAPI().getObject(objectId)
      if (!cancelled && res.success && res.data) {
        setFormData(res.data as ZLFNObject)
      }
    }
    load()
    return () => { cancelled = true }
  }, [objectId])

  // Handle imported data (legacy support)
  React.useEffect(() => {
    if (initialData && !objectId) {
      // Convert imported data to ZLFNObject format
      const importedObject = createEmptyZLFNObject(`imported_${Date.now()}`)
      
      if (initialData.arguments && initialData.arguments.length > 0) {
        // Use the first argument from imported data
        const firstArg = initialData.arguments[0]
        importedObject.zflnJson.arguments = [firstArg]
        importedObject.metadata.title = firstArg.title || 'Imported Argument'
        importedObject.markdownContent = firstArg.markdown?.content || ''
      }
      
      setFormData(importedObject)
    }
  }, [initialData, objectId])

  // Markdown file import handler
  const handleMarkdownImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setMarkdownFile(file)
      const id = file.name.replace(/\.md$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setFormData(prev => ({ 
          ...prev, 
          id, 
          markdownContent: content,
          metadata: {
            ...prev.metadata,
            title: file.name.replace(/\.md$/, '').replace(/_/g, ' '),
            created: prev.metadata?.created || new Date().toISOString(),
            modified: new Date().toISOString(),
            fileReferences: prev.metadata?.fileReferences || []
          }
        }))
      }
      reader.onerror = () => {
        setError('Failed to read markdown file')
      }
      reader.readAsText(file)
    }
  }

  // JSON file import handler
  const handleJsonImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setJsonFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const json = JSON.parse(content)
          setFormData(prev => ({
            ...prev,
            zflnJson: { 
              ...prev.zflnJson, 
              arguments: json.arguments || [] 
            }
          }))
        } catch (error) {
          setError('Invalid JSON file format')
        }
      }
      reader.onerror = () => {
        setError('Failed to read JSON file')
      }
      reader.readAsText(file)
    }
  }

  // Comprehensive validation function
  const validateForm = React.useCallback(async (): Promise<boolean> => {
    const newErrors: { [key: string]: string } = {}
    
    // ID validation (required for routing)
    if (!formData.id || formData.id.length < 1 || formData.id.length > 100) {
      newErrors.id = 'ID must be 1-100 characters'
    }
    
    // ID format validation (for URL compatibility)
    if (formData.id && !/^[a-zA-Z0-9_-]+$/.test(formData.id)) {
      newErrors.id = 'ID can only contain letters, numbers, underscores, and hyphens'
    }
    
    // Title validation (optional but recommended)
    if (formData.metadata?.title && (formData.metadata.title.length < 1 || formData.metadata.title.length > 200)) {
      newErrors.title = 'Title must be 1-200 characters'
    }
    
    // Markdown content validation (optional - can be empty)
    if (formData.markdownContent && formData.markdownContent.length > 100000) {
      newErrors.markdownContent = 'Markdown content is too large (max 100,000 characters)'
    }
    
    // Arguments validation (optional - can be empty for markdown-only documents)
    if (formData.zflnJson?.arguments) {
      formData.zflnJson.arguments.forEach((arg, i) => {
        if (arg.core?.name && (arg.core.name.length < 1 || arg.core.name.length > 100)) {
          newErrors[`arg${i}.core.name`] = `Argument ${i + 1} name must be 1-100 characters`
        }
        
        // Validate dependencies if present
        if (arg.dependencies && arg.dependencies.length > 0) {
          arg.dependencies.forEach((dep, j) => {
            if (!dep.type || !dep.target) {
              newErrors[`arg${i}.dep${j}`] = `Dependency ${j + 1} is incomplete`
            }
          })
        }
      })
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  // Debounced validation for real-time feedback
  const debouncedValidate = React.useMemo(
    () => debounce(async () => {
      setIsValidating(true)
      await validateForm()
      setIsValidating(false)
    }, 500),
    [validateForm]
  )

  // Trigger validation on form data changes
  React.useEffect(() => {
    debouncedValidate()
    return () => {
      debouncedValidate.cancel()
    }
  }, [formData, debouncedValidate])

  const handleSubmit = async () => {
    if (isSubmitting) return
    
    setIsSubmitting(true)
    setError('')
    
    // Validate form before submission
    if (!await validateForm()) {
      setIsSubmitting(false)
      setError('Please fix validation errors before submitting')
      return
    }
    
    let lock: { userId: string; expires: number } | null = null
    
    try {
      // Acquire lock for editing existing objects
      if (objectId) {
        const userId = `user_${Date.now()}` // In production, use actual user ID
        const lockAcquired = zlfnObjectManager.acquireLock(objectId, userId, 30000)
        if (!lockAcquired) {
          throw new Error('Object is currently locked by another user')
        }
        lock = { userId, expires: Date.now() + 30000 }
      }
      
      const api = getCurrentAPI()
      
      if (objectId) {
        // Update existing object
        const res = await api.updateObject(objectId, { 
          ...formData, 
          markdownContent: formData.markdownContent 
        })
        if (!res.success) throw new Error(res.error || 'Update failed')
      } else {
        // Create new object
        const res = apiConfig.getConfig().useRealBackend
          ? await realAPI.createObject({ 
              ...formData, 
              markdownContent: formData.markdownContent, 
              id: formData.id 
            })
          : await api.createObject(formData.markdownContent || '', formData.zflnJson)
        if (!res.success) throw new Error(res.error || 'Create failed')
        
        // Navigate to the new route if ID is set
        if (formData.id) {
          window.history.pushState({}, '', `/${formData.id}`)
        }
      }
      
      onClose()
    } catch (e: any) {
      setError(e.message || 'Submission failed')
    } finally {
      // Release lock
      if (lock && objectId) {
        zlfnObjectManager.releaseLock(objectId, lock.userId)
      }
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!objectId) return
    
    const confirmed = window.confirm(
      'Are you sure you want to delete this object? This action cannot be undone.'
    )
    
    if (!confirmed) return
    
    try {
      setIsSubmitting(true)
      const api = getCurrentAPI()
      const res = await api.deleteObject(objectId)
      if (!res.success) throw new Error(res.error || 'Delete failed')
      onClose()
    } catch (e: any) {
      setError(e.message || 'Delete failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleArgChange = (i: number, updater: (arg: ZLFNArgument) => ZLFNArgument) => {
    setFormData(prev => ({
      ...prev,
      zflnJson: {
        ...prev.zflnJson,
        arguments: prev.zflnJson?.arguments?.map((a, idx) => idx === i ? updater(a) : a) || []
      }
    }))
  }

  return (
    <Box p={2} display="flex" flexDirection="column" gap={2}>
      {/* Mode Indicator */}
      <Typography variant="h6" sx={{ color: 'var(--ai-text-primary)' }}>
        {objectId ? 'Edit Object' : 'Create Object'}
      </Typography>
      
      {/* Validation Progress */}
      {isValidating && (
        <Box>
          <Typography variant="caption" color="textSecondary">Validating...</Typography>
          <LinearProgress sx={{ mt: 0.5 }} />
        </Box>
      )}
      
      {/* Validation Errors Summary */}
      {Object.keys(errors).length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="subtitle2">Please fix the following errors:</Typography>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            {Object.entries(errors).slice(0, 5).map(([key, message]) => (
              <li key={key}>{message}</li>
            ))}
            {Object.keys(errors).length > 5 && (
              <li>... and {Object.keys(errors).length - 5} more errors</li>
            )}
          </ul>
        </Alert>
      )}

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
        <Tab label="General" />
        <Tab label="Markdown" />
        <Tab label="Arguments" />
      </Tabs>

      {activeTab === 0 && (
        <Box display="grid" gap={2}>
          <TextField 
            label="ID" 
            value={formData.id || ''} 
            onChange={(e) => setFormData(p => ({ ...p, id: e.target.value }))} 
            fullWidth 
            error={!!errors.id}
            helperText={errors.id || 'Used for URL routing (e.g., /your-id)'}
            placeholder="Enter a unique identifier"
          />
          <TextField 
            label="Title" 
            value={formData.metadata?.title || ''} 
            onChange={(e)=>setFormData(p=>({...p, metadata:{
              ...p.metadata,
              title: e.target.value,
              created: p.metadata?.created || new Date().toISOString(),
              modified: new Date().toISOString(),
              fileReferences: p.metadata?.fileReferences || []
            }}))} 
            fullWidth 
            error={!!errors.title}
            helperText={errors.title}
          />
        </Box>
      )}

      {activeTab === 1 && (
        <Box display="grid" gap={2}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Import Markdown File</Typography>
            <input 
              type="file" 
              accept=".md,.markdown" 
              onChange={handleMarkdownImport}
              style={{ marginBottom: '16px' }}
            />
            {markdownFile && (
              <Typography variant="caption" color="textSecondary">
                Imported: {markdownFile.name}
              </Typography>
            )}
          </Box>
          <TextField 
            label="Markdown Content" 
            value={formData.markdownContent || ''} 
            onChange={(e) => setFormData(p => ({ ...p, markdownContent: e.target.value }))} 
            fullWidth 
            multiline 
            minRows={8}
            placeholder="Enter markdown content or import a .md file above"
          />
        </Box>
      )}

      {activeTab === 2 && (
        <Box display="grid" gap={2}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Import JSON Arguments</Typography>
            <input 
              type="file" 
              accept=".json" 
              onChange={handleJsonImport}
              style={{ marginBottom: '16px' }}
            />
            {jsonFile && (
              <Typography variant="caption" color="textSecondary">
                Imported: {jsonFile.name} ({formData.zflnJson?.arguments?.length || 0} arguments)
              </Typography>
            )}
          </Box>
          {formData.zflnJson?.arguments?.length === 0 && (
            <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
              No arguments loaded. Import a JSON file above to populate argument data for visualizations.
            </Typography>
          )}
          {formData.zflnJson?.arguments?.map((arg, i) => (
            <Accordion key={i}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>{arg.core.name || `Argument ${i+1}`}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box display="grid" gap={2}>
                  <TextField label="Core Name" value={arg.core.name} onChange={(e)=>handleArgChange(i, a=>({...a, core:{...a.core, name:e.target.value}}))} fullWidth />
                  <TextField label="Summary" value={arg.core.summary} onChange={(e)=>handleArgChange(i, a=>({...a, core:{...a.core, summary:e.target.value}}))} fullWidth multiline />
                  <Select value={arg.core.layoutMode} onChange={(e)=>handleArgChange(i, a=>({...a, core:{...a.core, layoutMode:e.target.value as any}}))} fullWidth>
                    <MenuItem value="network">Network</MenuItem>
                    <MenuItem value="hierarchical">Hierarchical</MenuItem>
                    <MenuItem value="circular">Circular</MenuItem>
                    <MenuItem value="force-directed">Force-Directed</MenuItem>
                  </Select>
                  <Box>
                    <Typography variant="subtitle2">Mode Config</Typography>
                    <Box display="grid" gap={1}>
                      <Checkbox checked={!!arg.core.mode?.zlfMode} onChange={(e)=>handleArgChange(i, a=>({...a, core:{...a.core, mode:{...a.core.mode, zlfMode:e.target.checked}}}))} /> ZLF
                      <Checkbox checked={!!arg.core.mode?.atnMode} onChange={(e)=>handleArgChange(i, a=>({...a, core:{...a.core, mode:{...a.core.mode, atnMode:e.target.checked}}}))} /> ATN
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2">Zones</Typography>
                    {arg.zones.map((z, zi)=>(
                      <Box key={zi} display="grid" gap={1} p={1} border={1} borderColor="divider">
                        <TextField label="Zone Name" value={z.name} onChange={(e)=>handleArgChange(i, a=>({
                          ...a,
                          zones: a.zones.map((zz, idx)=> idx===zi ? { ...zz, name:e.target.value } : zz)
                        }))} />
                        {z.nodes.map((n, ni)=>(
                          <Box key={ni} display="grid" gap={1} p={1} border={1} borderColor="divider">
                            <TextField label="Node ID" value={n.id} onChange={(e)=>handleArgChange(i, a=>({
                              ...a,
                              zones: a.zones.map((zz, idx)=> idx===zi ? { ...zz, nodes: zz.nodes.map((nn, k)=> k===ni ? { ...nn, id:e.target.value } : nn) } : zz)
                            }))} />
                            <TextField label="Node Name" value={n.name} onChange={(e)=>handleArgChange(i, a=>({
                              ...a,
                              zones: a.zones.map((zz, idx)=> idx===zi ? { ...zz, nodes: zz.nodes.map((nn, k)=> k===ni ? { ...nn, name:e.target.value } : nn) } : zz)
                            }))} />
                            <Select value={n.state || 'T'} onChange={(e)=>handleArgChange(i, a=>({
                              ...a,
                              zones: a.zones.map((zz, idx)=> idx===zi ? { ...zz, nodes: zz.nodes.map((nn, k)=> k===ni ? { ...nn, state:e.target.value as any } : nn) } : zz)
                            }))}>
                              <MenuItem value="T">True</MenuItem>
                              <MenuItem value="F">False</MenuItem>
                              <MenuItem value="B">Both</MenuItem>
                            </Select>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="caption">Weight</Typography>
                              <Slider value={n.weight ?? 50} min={0} max={100} onChange={(_, v)=>handleArgChange(i, a=>({
                                ...a,
                                zones: a.zones.map((zz, idx)=> idx===zi ? { ...zz, nodes: zz.nodes.map((nn, k)=> k===ni ? { ...nn, weight: v as number } : nn) } : zz)
                              }))} />
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    ))}
                  </Box>
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      <Box display="flex" gap={1} justifyContent="space-between">
        <Box display="flex" gap={1}>
          <Button variant="outlined" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSubmit} 
            disabled={isSubmitting || Object.keys(errors).length > 0}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </Box>
        
        {objectId && (
          <Button 
            variant="outlined" 
            color="error" 
            onClick={handleDelete}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Deleting...' : 'Delete'}
          </Button>
        )}
      </Box>

      <Snackbar open={!!error} message={error} onClose={()=>setError('')} autoHideDuration={6000} />
    </Box>
  )
}


