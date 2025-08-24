import React from 'react'
import { Box, Tabs, Tab, TextField, Button, Accordion, AccordionSummary, AccordionDetails, Typography, Select, MenuItem, Snackbar, Slider, Checkbox, Alert, LinearProgress } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { debounce } from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import type { ZLFNArgument, ZLFNObject, ZLFNStructure } from '../../types/zlfn'
// import { createEmptyZLFNObject } from '../../types/zlfn'
import { getCurrentAPI, apiConfig } from '../../services/apiConfig'
import realAPI from '../../services/realAPI'
import { zlfnObjectManager } from '../../services/zlfnObjectManager'

interface ObjectFormProps {
  objectId?: string
  onClose: () => void
  initialData?: any
}

export default function ObjectForm({ objectId, onClose, initialData }: ObjectFormProps) {
  // Debug toggles
  const DBG = false
  const log = (...args: any[]) => { if (DBG) console.log('[ObjectForm]', ...args) }
  const logState = (tag: string, md?: string) => {
    if (!DBG) return
    console.log('[ObjectForm]', tag, {
      id: formData.id,
      title: formData.metadata?.title,
      mdLen: (formData.markdownContent || '').length,
      mdPreview: (md !== undefined ? md : (formData.markdownContent || '')).slice(0, 80),
      argsLen: formData.zflnJson?.arguments?.length || 0,
      lastAction: lastActionRef.current
    })
  }
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
  
  // Add a ref to track the current markdown content to prevent loss
  const markdownContentRef = React.useRef<string>('')
  // Track last action for diagnostics
  const lastActionRef = React.useRef<string>('INIT')
  // Apply initialData only when it actually changes
  const lastInitialDataRef = React.useRef<any>(null)
  
  // Update ref whenever markdown content changes
  React.useEffect(() => {
    markdownContentRef.current = formData.markdownContent || ''
    log('markdownContentRef updated', { mdLen: markdownContentRef.current.length })
  }, [formData.markdownContent])

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!objectId) return
      lastActionRef.current = 'LOAD_OBJECT'
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
    if (initialData && !objectId && initialData !== lastInitialDataRef.current) {
      lastActionRef.current = 'INIT_FROM_INITIALDATA'
      lastInitialDataRef.current = initialData
      log('initialData received', { keys: Object.keys(initialData || {}), isArray: Array.isArray(initialData) })

      let importedArgs: any[] = []
      let importedTitle: string | undefined
      let importedMarkdown: string | undefined

      // NOTE: Per requirement, importing JSON must NOT change markdownContent.
      // We will only map JSON into arguments and title hints unless markdownContent is explicitly provided.

      if (typeof (initialData as any).markdownContent === 'string') {
        importedMarkdown = (initialData as any).markdownContent
      }

      if (Array.isArray(initialData)) {
        // initialData is likely SharedArgument[] from normalizeImportedJSON
        importedArgs = mapSharedArgumentsToZlfnArgs(initialData as any[])
        const first = (initialData as any[])[0]
        if (first?.title) importedTitle = first.title
        log('mapped SharedArgument[]', { importedArgsLen: importedArgs.length })
      } else if ((initialData as any).arguments) {
        // Raw JSON with expected shape
        importedArgs = ((initialData as any).arguments || []).map((a: any) => sanitizeArgument(a))
        const firstArg = importedArgs[0]
        if (firstArg?.core?.name) importedTitle = firstArg.core.name
        log('mapped raw JSON arguments', { importedArgsLen: importedArgs.length })
      }

      if (importedArgs.length > 0 || importedMarkdown !== undefined) {
        setFormData(prev => {
          const nextMeta = {
            ...prev.metadata,
            title: prev.metadata?.title || importedTitle || prev.metadata?.title,
            created: prev.metadata?.created || new Date().toISOString(),
            modified: new Date().toISOString(),
            fileReferences: prev.metadata?.fileReferences || []
          }
          return {
            ...prev,
            ...(importedMarkdown !== undefined ? { markdownContent: importedMarkdown } : {}),
            zflnJson: {
              ...prev.zflnJson,
              arguments: importedArgs.length > 0 ? importedArgs : prev.zflnJson?.arguments || []
            },
            metadata: nextMeta
          }
        })
        log('applied initialData mapping', { argsLen: importedArgs.length, title: importedTitle, md: importedMarkdown?.length })
      }
    }
  }, [initialData, objectId])

  // Markdown file import handler (reverted to working behavior)
  const handleMarkdownImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setMarkdownFile(file)
      const id = file.name.replace(/\.md$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        lastActionRef.current = 'MARKDOWN_IMPORT'
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
          lastActionRef.current = 'JSON_IMPORT'
          log('JSON_IMPORT read', { file: file.name, size: content.length, keys: Object.keys(json || {}) })
          setFormData(prev => {
            // Explicitly preserve markdown content from ref to prevent loss
            const preservedMarkdownContent = markdownContentRef.current || prev.markdownContent || ''
            
            return {
              ...prev,
              markdownContent: preservedMarkdownContent, // Explicitly preserve markdown
              zflnJson: { 
                ...prev.zflnJson, 
                arguments: json.arguments || [] 
              }
            }
          })
          setTimeout(() => logState('after JSON_IMPORT state set'), 0)
        } catch (error) {
          setError('Invalid JSON file format')
          lastActionRef.current = 'JSON_IMPORT_ERROR'
          log('JSON_IMPORT parse error', error)
        }
      }
      reader.onerror = () => {
        setError('Failed to read JSON file')
      }
      reader.readAsText(file)
    }
  }

  // Watchdog: if a JSON import just occurred and markdown emptied, restore from ref once (silent)
  const restoreGuardRef = React.useRef<number>(0)
  React.useEffect(() => {
    if (lastActionRef.current === 'JSON_IMPORT') {
      const isEmpty = !formData.markdownContent || formData.markdownContent.length === 0
      const canRestore = markdownContentRef.current && markdownContentRef.current.length > 0
      if (isEmpty && canRestore && restoreGuardRef.current < 1) {
        restoreGuardRef.current += 1
        setFormData(prev => ({ ...prev, markdownContent: markdownContentRef.current }))
        log('watchdog restored markdown from ref', { len: markdownContentRef.current.length })
      }
    } else {
      restoreGuardRef.current = 0
    }
  }, [formData.markdownContent])

  // Diagnostics: compact, actionable
  React.useEffect(() => {
    log('state change', {
      lastAction: lastActionRef.current,
      mdLen: formData.markdownContent ? formData.markdownContent.length : 0,
      argsLen: formData.zflnJson?.arguments?.length || 0,
      tab: activeTab
    })
  }, [formData.markdownContent, formData.zflnJson?.arguments?.length, activeTab])

  // --- Import utilities: sanitize & map ---
  function sanitizeDependencies(rawDeps: any[] | undefined): any[] {
    const deps = Array.isArray(rawDeps) ? rawDeps : []
    const cleaned = deps
      .map(d => ({
        id: d.id || '',
        source: d.source || d.sourceId || '',
        target: d.target || d.targetId || '',
        type: d.type || '',
        rule: d.rule || '',
        weight: typeof d.weight === 'number' ? d.weight : undefined,
        priority: typeof d.priority === 'number' ? d.priority : undefined
      }))
      .filter(d => d.type && d.target) // matches validator expectations
    return cleaned
  }

  function ensureModes(raw: any): any {
    const m = raw && typeof raw === 'object' ? raw : {}
    return {
      propositional: !!m.propositional,
      predicate: !!m.predicate,
      epistemic: !!m.epistemic,
      deontic: !!m.deontic,
      temporal: !!m.temporal,
      informal: !!m.informal,
      paraconsistent: !!m.paraconsistent,
      fuzzy: !!m.fuzzy
    }
  }

  function sanitizeArgument(raw: any): any {
    const core = raw.core || {}
    const safeCore = {
      name: core.name || 'Imported Argument',
      summary: core.summary || '',
      layoutMode: core.layoutMode || 'network',
      variables: core.variables || {},
      mode: core.mode || {}
    }
    return {
      core: safeCore,
      zones: Array.isArray(raw.zones) ? raw.zones : [],
      dependencies: sanitizeDependencies(raw.dependencies),
      modes: ensureModes(raw.modes),
      counterarguments: Array.isArray(raw.counterarguments) ? raw.counterarguments : [],
      subarguments: Array.isArray(raw.subarguments) ? raw.subarguments : [],
      validation: raw.validation || { isValid: true, errors: [], warnings: [] },
      pagination: raw.pagination || { currentPage: 1, totalPages: 1 }
    }
  }

  function mapSharedArgumentsToZlfnArgs(shared: any[]): any[] {
    return (shared || []).map((sa: any) => sanitizeArgument({
      core: {
        name: sa.title || 'Imported Argument',
        summary: (sa.expressions && sa.expressions[0]) || '' ,
        layoutMode: 'network',
        variables: {},
        mode: { zlfMode: false, atnMode: false }
      },
      zones: [],
      dependencies: [],
      modes: {},
      counterarguments: [],
      subarguments: [],
      validation: { isValid: true, errors: [], warnings: [] },
      pagination: { currentPage: 1, totalPages: 1 }
    }))
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
              key="markdown-import"
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
              key="json-import"
              id="arguments-json-file-input"
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


