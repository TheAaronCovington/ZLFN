import React, { useEffect, useState, useMemo } from 'react'
import { Drawer, IconButton, List, ListItemButton, ListItemText, Toolbar, Box, TextField, ListSubheader, Chip, Button, Stack } from '@mui/material'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import PushPinIcon from '@mui/icons-material/PushPin'
import { Link as RouterLink } from 'react-router-dom'
import { getDocumentList } from '../../services/docs'
import type { DocMeta } from '../../services/docs'

const PINS_KEY = 'xv_pins'
const RECENTS_KEY = 'xv_recents'
const COLLAPSE_KEY = 'xv_sidebar_collapse'
const ONLY_PINS_KEY = 'xv_sidebar_onlypins'

function loadSet(key: string): Set<string> {
	try {
		const raw = localStorage.getItem(key)
		return new Set<string>(raw ? JSON.parse(raw) : [])
	} catch { return new Set() }
}
function saveSet(key: string, set: Set<string>) {
	localStorage.setItem(key, JSON.stringify(Array.from(set)))
}

export const LibrarySidebar: React.FC = () => {
	const [open, setOpen] = useState(false)
	const [docs, setDocs] = useState<DocMeta[]>([])
	const [query, setQuery] = useState('')
	const [pins, setPins] = useState<Set<string>>(() => loadSet(PINS_KEY))
	const [recents, setRecents] = useState<Set<string>>(() => loadSet(RECENTS_KEY))
    const [showPinned, setShowPinned] = useState<boolean>(() => { try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}')?.pinned !== false } catch { return true } })
    const [showRecent, setShowRecent] = useState<boolean>(() => { try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}')?.recent !== false } catch { return true } })
    const [showAll, setShowAll] = useState<boolean>(() => { try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}')?.all !== false } catch { return true } })
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
    const [onlyPins, setOnlyPins] = useState<boolean>(() => { try { return localStorage.getItem(ONLY_PINS_KEY) === '1' } catch { return false } })

	useEffect(() => {
		getDocumentList().then(setDocs).catch(() => setDocs([]))
	}, [])

	useEffect(() => saveSet(PINS_KEY, pins), [pins])
	useEffect(() => saveSet(RECENTS_KEY, recents), [recents])
	useEffect(() => {
		const onStorage = (e: StorageEvent) => {
			if (e.key === PINS_KEY) setPins(loadSet(PINS_KEY))
			if (e.key === RECENTS_KEY) setRecents(loadSet(RECENTS_KEY))
		}
		window.addEventListener('storage', onStorage)
		return () => window.removeEventListener('storage', onStorage)
	}, [])
	useEffect(() => {
		try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify({ pinned: showPinned, recent: showRecent, all: showAll })) } catch {}
	}, [showPinned, showRecent, showAll])
    useEffect(() => { try { localStorage.setItem(ONLY_PINS_KEY, onlyPins ? '1' : '0') } catch {} }, [onlyPins])

	const allTags = useMemo(() => {
		const s = new Set<string>()
		docs.forEach(d => (d.tags || []).forEach(t => s.add(t)))
		return Array.from(s).sort()
	}, [docs])

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase()
		const hasTagFilter = selectedTags.size > 0
		return docs.filter(d => {
			const matchesQuery = !q || d.label.toLowerCase().includes(q) || d.id.toLowerCase().includes(q)
			const matchesTags = !hasTagFilter || (d.tags || []).some(t => selectedTags.has(t))
			const matchesPins = !onlyPins || pins.has(d.id)
			return matchesQuery && matchesTags && matchesPins
		})
	}, [docs, query, selectedTags, onlyPins, pins])

	const pinnedDocs = filtered.filter(d => pins.has(d.id)).sort((a,b)=>a.label.localeCompare(b.label))
	const recentDocs = filtered.filter(d => recents.has(d.id) && !pins.has(d.id)).sort((a,b)=>a.label.localeCompare(b.label))
	const otherDocs = filtered.filter(d => !pins.has(d.id) && !recents.has(d.id)).sort((a,b)=>a.label.localeCompare(b.label))

	const onOpenDoc = (id: string) => {
		const next = new Set<string>(recents)
		next.delete(id)
		next.add(id)
		while (next.size > 10) {
			const first = next.values().next().value as string | undefined
			if (!first) break
			next.delete(first)
		}
		setRecents(next)
	}

	const togglePin = (id: string) => {
		const next = new Set<string>(pins)
		if (next.has(id)) next.delete(id)
		else next.add(id)
		setPins(next)
	}

	return (
		<>
			<IconButton color="inherit" onClick={() => setOpen(true)} sx={{ ml: 1 }} title="Library">
				<MenuBookIcon />
			</IconButton>
			<Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
				<Box sx={{ width: 360 }} role="presentation" onClick={() => setOpen(false)}>
					<Toolbar />
					<Box sx={{ px: 2, py: 1 }}>
						<TextField fullWidth size="small" label="Search" value={query} onChange={e => setQuery(e.target.value)} />
						{allTags.length > 0 && (
							<Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
								{allTags.map(t => {
									const active = selectedTags.has(t)
									return (
										<Chip key={t} size="small" label={t} color={active ? 'primary' : 'default'} variant={active ? 'filled' : 'outlined'} onClick={(e) => { e.stopPropagation(); const next = new Set(selectedTags); if (active) next.delete(t); else next.add(t); setSelectedTags(next) }} />
									)
								})}
								<Button size="small" onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setSelectedTags(new Set()) }}>Clear Tags</Button>
								<Button size="small" variant={onlyPins ? 'contained' : 'outlined'} onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setOnlyPins(v=>!v) }}>{onlyPins ? 'Only Pinned: On' : 'Only Pinned: Off'}</Button>
							</Stack>
						)}
					</Box>
					{pinnedDocs.length > 0 && (
						<List subheader={<ListSubheader disableSticky onClick={(e)=>{e.preventDefault(); e.stopPropagation(); setShowPinned(s=>!s)}} sx={{ cursor: 'pointer' }}>Pinned {showPinned ? '▾' : '▸'}</ListSubheader>}>
							{pinnedDocs.map(d => (
								<ListItemButton key={d.id} component={RouterLink} to={`/document/${d.id}`} onClick={() => onOpenDoc(d.id)} sx={{ display: showPinned ? 'flex' : 'none' }}>
									<ListItemText primary={<><span>{d.label}</span> <Chip size="small" label="Pinned" sx={{ ml: 1 }} /></>} secondary={<>{d.id}{(d.tags && d.tags.length) ? <> • {d.tags.join(', ')}</> : null}</>} />
									<IconButton edge="end" size="small" onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(d.id) }}><PushPinIcon fontSize="small" /></IconButton>
								</ListItemButton>
							))}
						</List>
					)}
					{recentDocs.length > 0 && (
						<List subheader={<ListSubheader disableSticky onClick={(e)=>{e.preventDefault(); e.stopPropagation(); setShowRecent(s=>!s)}} sx={{ cursor: 'pointer' }}>Recent {showRecent ? '▾' : '▸'} <Button size="small" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRecents(new Set()) }} sx={{ ml: 1 }}>Clear</Button></ListSubheader>}>
							{recentDocs.map(d => (
								<ListItemButton key={d.id} component={RouterLink} to={`/document/${d.id}`} onClick={() => onOpenDoc(d.id)} sx={{ display: showRecent ? 'flex' : 'none' }}>
									<ListItemText primary={d.label} secondary={<>{d.id}{(d.tags && d.tags.length) ? <> • {d.tags.join(', ')}</> : null}</>} />
									<IconButton edge="end" size="small" onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(d.id) }}><PushPinIcon fontSize="small" /></IconButton>
								</ListItemButton>
							))}
						</List>
					)}
					<List subheader={<ListSubheader disableSticky onClick={(e)=>{e.preventDefault(); e.stopPropagation(); setShowAll(s=>!s)}} sx={{ cursor: 'pointer' }}>All {showAll ? '▾' : '▸'}</ListSubheader>}>
						{otherDocs.map(d => (
							<ListItemButton key={d.id} component={RouterLink} to={`/document/${d.id}`} onClick={() => onOpenDoc(d.id)} sx={{ display: showAll ? 'flex' : 'none' }}>
								<ListItemText primary={d.label} secondary={<>{d.id}{(d.tags && d.tags.length) ? <> • {d.tags.join(', ')}</> : null}</>} />
								<IconButton edge="end" size="small" onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(d.id) }}><PushPinIcon fontSize="small" /></IconButton>
							</ListItemButton>
						))}
					</List>
				</Box>
			</Drawer>
		</>
	)
}

export default LibrarySidebar


