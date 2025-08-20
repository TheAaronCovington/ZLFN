
import React from 'react'
import { Alert, Box, Button, Chip, Divider, List, ListItem, ListItemText, Paper, Typography } from '@mui/material'
import { api } from '../../services/zlfnAPI'
import type { ZLFNObject } from '../../types/zlfn'
import { useMemo } from 'react'

interface DiffItem {
  type: 'added' | 'removed' | 'modified'
  category: 'node' | 'edge' | 'note' | 'metadata'
  id: string
  details: string
  oldValue?: any
  newValue?: any
}

interface LayoutDiffItem {
  type: 'added' | 'removed' | 'moved'
  id: string
  from?: { x: number; y: number }
  to?: { x: number; y: number }
  dx?: number
  dy?: number
  dist?: number
}

interface DiffViewerProps {
  objectId: string
  baseVersionId: string
  compareVersionId: string
  onClose: () => void
}

export default function DiffViewer({ objectId, baseVersionId, compareVersionId, onClose }: DiffViewerProps) {
  const [baseObj, setBaseObj] = React.useState<ZLFNObject | null>(null)
  const [compareObj, setCompareObj] = React.useState<ZLFNObject | null>(null)
  const [diffs, setDiffs] = React.useState<DiffItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [onlyNotes, setOnlyNotes] = React.useState(false)
  const [onlyLayout, setOnlyLayout] = React.useState(false)
  const [layoutDiffs, setLayoutDiffs] = React.useState<LayoutDiffItem[]>([])

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const objRes = await api.getObject(objectId)
        if (!objRes.success || !objRes.data) throw new Error(objRes.error || 'Failed to load object')
        const vhRes = await api.getVersionHistory(objectId)
        const baseData = objRes.data as ZLFNObject
        const versions = (vhRes.success && vhRes.data) ? vhRes.data : (baseData.versionHistory || [])
        const baseIdx = Number(baseVersionId)
        const compareIdx = Number(compareVersionId)
        const pick = (idx: number): ZLFNObject => ({
          ...baseData,
          zflnJson: versions[idx]?.zflnJson || baseData.zflnJson,
          notes: versions[idx]?.notes || baseData.notes,
          metadata: { ...baseData.metadata, modified: versions[idx]?.timestamp || baseData.metadata.modified }
        })
        const safeBaseIdx = Number.isNaN(baseIdx) ? 0 : baseIdx
        const safeCmpIdx = Number.isNaN(compareIdx) ? 0 : compareIdx
        const base = pick(safeBaseIdx)
        const cmp = pick(safeCmpIdx)
        if (!cancelled) {
          setBaseObj(base)
          setCompareObj(cmp)
        }

        // Compute layout diffs if versions carry layout snapshots
        try {
          const baseLayout = (versions?.[safeBaseIdx]?.layout || {}) as Record<string, { x: number; y: number }>
          const cmpLayout = (versions?.[safeCmpIdx]?.layout || {}) as Record<string, { x: number; y: number }>
          const ids = new Set<string>([...Object.keys(baseLayout), ...Object.keys(cmpLayout)])
          const changes: LayoutDiffItem[] = []
          ids.forEach((id) => {
            const a = baseLayout[id]
            const b = cmpLayout[id]
            if (a && !b) {
              changes.push({ type: 'removed', id, from: a })
            } else if (!a && b) {
              changes.push({ type: 'added', id, to: b })
            } else if (a && b) {
              const dx = b.x - a.x
              const dy = b.y - a.y
              const dist = Math.hypot(dx, dy)
              if (dist > 0.5) changes.push({ type: 'moved', id, from: a, to: b, dx, dy, dist: Math.round(dist) })
            }
          })
          if (!cancelled) setLayoutDiffs(changes)
        } catch {}
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [objectId, baseVersionId, compareVersionId])

  React.useEffect(() => {
    if (!baseObj || !compareObj) return
    const newDiffs: DiffItem[] = []

    const collect = (obj: ZLFNObject) => ({
      nodes: obj.zflnJson.arguments.flatMap(a => a.zones.flatMap(z => z.nodes)).map(n => ({ id: (n as any).id, raw: n })),
      edges: obj.zflnJson.arguments.flatMap(a => a.dependencies).map(d => ({ id: (d as any).id || `${(d as any).source}->${(d as any).target}`, raw: d })),
      notes: obj.notes
    })
    const b = collect(baseObj)
    const c = collect(compareObj)

    const mapById = (arr: Array<{ id: string; raw: any }>) => new Map(arr.map(x => [x.id, x.raw]))
    const bn = mapById(b.nodes), cn = mapById(c.nodes)
    const be = mapById(b.edges), ce = mapById(c.edges)

    const diffMaps = (base: Map<string, any>, cmp: Map<string, any>, category: DiffItem['category']) => {
      for (const id of new Set([...base.keys(), ...cmp.keys()])) {
        const v1 = base.get(id)
        const v2 = cmp.get(id)
        if (v1 && !v2) newDiffs.push({ type: 'removed', category, id, details: `${category} removed`, oldValue: v1 })
        else if (!v1 && v2) newDiffs.push({ type: 'added', category, id, details: `${category} added`, newValue: v2 })
        else if (v1 && v2 && JSON.stringify(v1) !== JSON.stringify(v2)) newDiffs.push({ type: 'modified', category, id, details: `${category} modified`, oldValue: v1, newValue: v2 })
      }
    }
    diffMaps(bn, cn, 'node')
    diffMaps(be, ce, 'edge')

    // notes
    for (const id of new Set([...Object.keys(b.notes), ...Object.keys(c.notes)])) {
      const v1 = b.notes[id]
      const v2 = c.notes[id]
      if (v1 && !v2) newDiffs.push({ type: 'removed', category: 'note', id, details: 'note removed', oldValue: v1 })
      else if (!v1 && v2) newDiffs.push({ type: 'added', category: 'note', id, details: 'note added', newValue: v2 })
      else if (v1 !== v2) newDiffs.push({ type: 'modified', category: 'note', id, details: 'note modified', oldValue: v1, newValue: v2 })
    }

    // metadata timestamp change
    if (baseObj.metadata.modified !== compareObj.metadata.modified) {
      newDiffs.push({ type: 'modified', category: 'metadata', id: 'modified', details: 'modified timestamp changed', oldValue: baseObj.metadata.modified, newValue: compareObj.metadata.modified })
    }

    setDiffs(newDiffs)
  }, [baseObj, compareObj])

  if (loading) return <Alert severity="info">Loading version comparison...</Alert>
  if (error) return <Alert severity="error">{error}</Alert>

  const added = diffs.filter(d => d.type === 'added').length
  const removed = diffs.filter(d => d.type === 'removed').length
  const modified = diffs.filter(d => d.type === 'modified').length
  const noteDiffs = useMemo(() => diffs.filter(d => d.category === 'note'), [diffs])
  const noteByNode = useMemo(() => {
    const map: Record<string, DiffItem[]> = {}
    noteDiffs.forEach(d => { (map[d.id] ||= []).push(d) })
    return map
  }, [noteDiffs])
  const visibleDiffs = onlyNotes ? noteDiffs : diffs

  return (
    <Paper sx={{ p: 3, bgcolor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(64, 196, 255, 0.3)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: '#40c4ff' }}>Version Comparison</Typography>
        <Button variant="outlined" onClick={onClose}>Close</Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Chip label={`${added} added`} color="success" />
        <Chip label={`${removed} removed`} color="error" />
        <Chip label={`${modified} modified`} color="warning" />
        <Chip label={`${diffs.length} total`} color="info" />
        <Chip label={`Notes: ${diffs.filter(d=> d.category==='note').length}`} color="warning" variant="outlined" />
        <Chip label={`Layout: ${layoutDiffs.length}`} color="info" variant="outlined" />
        <Button size="small" variant={onlyNotes ? 'contained' : 'outlined'} onClick={()=> { const next=!onlyNotes; setOnlyNotes(next); if(next) setOnlyLayout(false); try{localStorage.setItem(`zv_diff_only_notes_${objectId}`, next?'1':'0')}catch{}}}>Only notes</Button>
        <Button size="small" variant={onlyLayout ? 'contained' : 'outlined'} onClick={()=> { const next=!onlyLayout; setOnlyLayout(next); if(next) setOnlyNotes(false); try{localStorage.setItem(`zv_diff_only_layout_${objectId}`, next?'1':'0')}catch{}}}>Only layout</Button>
      </Box>

      <Divider sx={{ my: 2 }} />
      {/* Layout changes summary */}
      {!onlyNotes && (
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ color: '#8ad7ff', mb: 1 }}>Layout changes</Typography>
        {layoutDiffs.length === 0 ? (
          <Typography variant="body2" sx={{ color: '#b0bec5' }}>No layout changes captured.</Typography>
        ) : (
          <List>
            {layoutDiffs.map((c, i) => (
              <ListItem key={i} alignItems="flex-start" sx={{ border: '1px solid rgba(64,196,255,0.2)', borderRadius: 1, mb: 1 }}>
                <ListItemText
                  primary={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip size="small" label={c.type} color={c.type==='added'?'success':c.type==='removed'?'error':'warning'} />
                    <Typography variant="subtitle2" sx={{ color: '#e0f2ff' }}>Node {c.id}</Typography>
                    <Button size="small" variant="outlined" onClick={() => {
                      try { window.dispatchEvent(new CustomEvent('zlfn:center-node', { detail: { objectId, nodeId: c.id } })) } catch {}
                    }}>Center in graph</Button>
                  </Box>}
                  secondary={<Box sx={{ mt: 1, fontFamily: 'monospace' }}>
                    {c.type==='moved' && <div>Δx={Math.round(c.dx||0)}, Δy={Math.round(c.dy||0)}, dist={c.dist}</div>}
                    {c.from && <div>from: ({Math.round(c.from.x)}, {Math.round(c.from.y)})</div>}
                    {c.to && <div>to: ({Math.round(c.to.x)}, {Math.round(c.to.y)})</div>}
                  </Box>}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
      )}
      <Divider sx={{ my: 2 }} />
      {/* Notes-focused summary */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ color: '#8ad7ff', mb: 1 }}>Notes changes</Typography>
        {noteDiffs.length === 0 ? (
          <Typography variant="body2" sx={{ color: '#b0bec5' }}>No note changes.</Typography>
        ) : (
          <List>
            {Object.entries(noteByNode).map(([nodeId, items]) => {
              const status = items[0]?.type
              const color = status === 'added' ? 'success' : status === 'removed' ? 'error' : 'warning'
              const sample = items[0]
              const oldPreview = (sample.oldValue ?? '').toString().slice(0, 180)
              const newPreview = (sample.newValue ?? '').toString().slice(0, 180)
              return (
                <ListItem key={nodeId} alignItems="flex-start" sx={{ border: '1px solid rgba(64,196,255,0.2)', borderRadius: 1, mb: 1 }}>
                  <ListItemText
                    primary={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip size="small" label={String(status)} color={color as any} />
                      <Typography variant="subtitle2" sx={{ color: '#e0f2ff' }}>Node {nodeId}</Typography>
                      <Button size="small" variant="outlined" onClick={() => {
                        try {
                          const evt = new CustomEvent('zlfn:center-node', { detail: { objectId, nodeId } })
                          window.dispatchEvent(evt)
                        } catch {}
                      }}>Center in graph</Button>
                    </Box>}
                    secondary={<Box sx={{ mt: 1, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                      {status !== 'added' && (
                        <>
                          <Typography variant="caption" sx={{ color: '#b0bec5' }}>Old:</Typography>
                          <div>{oldPreview}</div>
                        </>
                      )}
                      {status !== 'removed' && (
                        <>
                          <Typography variant="caption" sx={{ color: '#b0bec5' }}>New:</Typography>
                          <div>{newPreview}</div>
                        </>
                      )}
                    </Box>}
                  />
                </ListItem>
              )
            })}
          </List>
        )}
      </Box>
      <Divider sx={{ my: 2 }} />
      {visibleDiffs.length === 0 ? (
        <Alert severity="success">No differences detected.</Alert>
      ) : (
        <List>
          {visibleDiffs.map((d, i) => (
            <ListItem key={i} alignItems="flex-start">
              <ListItemText
                primary={`${d.category} ${d.id} — ${d.details}`}
                secondary={
                  <Box sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {d.type === 'modified' && (
                      <>
                        <Typography variant="caption" sx={{ color: '#b0bec5' }}>Old:</Typography>
                        <div>{JSON.stringify(d.oldValue)?.slice(0, 320)}</div>
                        <Typography variant="caption" sx={{ color: '#b0bec5' }}>New:</Typography>
                        <div>{JSON.stringify(d.newValue)?.slice(0, 320)}</div>
                      </>
                    )}
                    {d.type !== 'modified' && (
                      <div>{JSON.stringify(d.newValue ?? d.oldValue)?.slice(0, 320)}</div>
                    )}
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  )
}
