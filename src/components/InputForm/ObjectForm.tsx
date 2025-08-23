import React from 'react'
import { Box, Tabs, Tab, TextField, Button, Accordion, AccordionSummary, AccordionDetails, Typography, Select, MenuItem, Snackbar, Slider, Checkbox } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { ZLFNArgument, ZLFNObject } from '../../types/zlfn'
import { createEmptyZLFNObject } from '../../types/zlfn'
import { getCurrentAPI, apiConfig } from '../../services/apiConfig'
import realAPI from '../../services/realAPI'

interface ObjectFormProps {
  objectId?: string
  onClose: () => void
  initialData?: any
}

export default function ObjectForm({ objectId, onClose, initialData }: ObjectFormProps) {
  const [activeTab, setActiveTab] = React.useState(0)
  const [error, setError] = React.useState('')
  const [formData, setFormData] = React.useState<ZLFNObject>(() => createEmptyZLFNObject(objectId || `zlfn_${Date.now()}`))

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

  // Handle imported data
  React.useEffect(() => {
    if (initialData && !objectId) {
      // Convert imported data to ZLFNObject format
      const importedObject = createEmptyZLFNObject(`imported_${Date.now()}`)
      
      if (initialData.arguments && initialData.arguments.length > 0) {
        // Use the first argument from imported data
        const firstArg = initialData.arguments[0]
        importedObject.zflnJson.arguments = [firstArg]
        importedObject.metadata.title = firstArg.title || 'Imported Argument'
        importedObject.markdown = firstArg.markdown?.content || ''
      }
      
      setFormData(importedObject)
    }
  }, [initialData, objectId])

  const handleSubmit = async () => {
    const api = getCurrentAPI()
    try {
      if (objectId) {
        const res = await api.updateObject(objectId, formData)
        if (!res.success) throw new Error(res.error || 'Update failed')
      } else {
        const useReal = apiConfig.getConfig().useRealBackend
        const res = useReal 
          ? await realAPI.createObject(formData)
          : await api.createObject(formData.markdown, formData.zflnJson)
        if (!res.success) throw new Error(res.error || 'Create failed')
      }
      onClose()
    } catch (e: any) {
      setError(e.message || 'Submission failed')
    }
  }

  const handleArgChange = (i: number, updater: (arg: ZLFNArgument) => ZLFNArgument) => {
    setFormData(prev => ({
      ...prev,
      zflnJson: {
        ...prev.zflnJson,
        arguments: prev.zflnJson.arguments.map((a, idx) => idx === i ? updater(a) : a)
      }
    }))
  }

  return (
    <Box p={2} display="flex" flexDirection="column" gap={2}>
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
        <Tab label="General" />
        <Tab label="Markdown" />
        <Tab label="Arguments" />
      </Tabs>

      {activeTab === 0 && (
        <Box display="grid" gap={2}>
          <TextField label="ID" value={formData.id} disabled fullWidth />
          <TextField label="Title" value={formData.metadata.title || ''} onChange={(e)=>setFormData(p=>({...p, metadata:{...p.metadata, title: e.target.value}}))} fullWidth />
        </Box>
      )}

      {activeTab === 1 && (
        <Box display="grid" gap={2}>
          <TextField label="Markdown" value={formData.markdown} onChange={(e)=>setFormData(p=>({...p, markdown: e.target.value}))} fullWidth multiline minRows={8} />
        </Box>
      )}

      {activeTab === 2 && (
        <Box display="grid" gap={2}>
          {formData.zflnJson.arguments.map((arg, i) => (
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

      <Box display="flex" gap={1}>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit}>Submit</Button>
      </Box>

      <Snackbar open={!!error} message={error} onClose={()=>setError('')} autoHideDuration={6000} />
    </Box>
  )
}


