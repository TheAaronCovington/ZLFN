import React, { useEffect, useState, useMemo } from 'react'
import { 
  Drawer, 
  IconButton, 
  List, 
  ListItemButton, 
  ListItemText, 
  Toolbar, 
  Box, 
  TextField, 
  ListSubheader, 
  Chip, 
  Button, 
  Stack,
  Typography,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  Tooltip,
  Badge,
  CircularProgress
} from '@mui/material'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import PushPinIcon from '@mui/icons-material/PushPin'
import RefreshIcon from '@mui/icons-material/Refresh'
import EditIcon from '@mui/icons-material/Edit'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import SearchIcon from '@mui/icons-material/Search'
import { Link as RouterLink } from 'react-router-dom'
import { getDocumentList } from '../../services/docs'
import type { DocMeta } from '../../services/docs'
import { storage } from '../../services/storage'
import { useLogicShared } from '../../context/LogicSharedContext'

const PINS_KEY = 'xv_pins'
const RECENTS_KEY = 'xv_recents'
const COLLAPSE_KEY = 'xv_sidebar_collapse'
const ONLY_PINS_KEY = 'xv_sidebar_onlypins'

interface TagEditDialogProps {
  open: boolean
  onClose: () => void
  documentId: string
  currentTags: string[]
  allTags: string[]
  onSave: (documentId: string, newTags: string[]) => void
}

const TagEditDialog: React.FC<TagEditDialogProps> = ({ open, onClose, documentId, currentTags, allTags, onSave }) => {
  const [tags, setTags] = useState<string[]>(currentTags)

  useEffect(() => {
    setTags(currentTags)
  }, [currentTags, open])

  const handleSave = () => {
    onSave(documentId, tags)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Tags</DialogTitle>
      <DialogContent>
        <Autocomplete
          multiple
          freeSolo
          value={tags}
          onChange={(_, newValue) => setTags(newValue)}
          options={allTags}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip
                variant="outlined"
                label={option}
                {...getTagProps({ index })}
                key={option}
              />
            ))
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Tags"
              placeholder="Add tags..."
              helperText="Press Enter to add new tags"
            />
          )}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  )
}

export const LibrarySidebar: React.FC = () => {
  const { unifiedData } = useLogicShared()
  const [open, setOpen] = useState(false)
  const [docs, setDocs] = useState<DocMeta[]>([])
  const [query, setQuery] = useState('')
  const [pins, setPins] = useState<Set<string>>(() => storage.getSet(PINS_KEY))
  const [recents, setRecents] = useState<Set<string>>(() => storage.getSet(RECENTS_KEY))
  const [showPinned, setShowPinned] = useState<boolean>(() => {
    const collapseState = storage.getJSON<{pinned?: boolean}>(COLLAPSE_KEY, {})
    return collapseState?.pinned !== false
  })
  const [showRecent, setShowRecent] = useState<boolean>(() => {
    const collapseState = storage.getJSON<{recent?: boolean}>(COLLAPSE_KEY, {})
    return collapseState?.recent !== false
  })
  const [showAll, setShowAll] = useState<boolean>(() => {
    const collapseState = storage.getJSON<{all?: boolean}>(COLLAPSE_KEY, {})
    return collapseState?.all !== false
  })
  const [showUnified, setShowUnified] = useState<boolean>(() => {
    const collapseState = storage.getJSON<{unified?: boolean}>(COLLAPSE_KEY, {})
    return collapseState?.unified !== false
  })
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [onlyPins, setOnlyPins] = useState<boolean>(() => storage.getItem(ONLY_PINS_KEY) === '1')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [tagEditDialog, setTagEditDialog] = useState<{
    open: boolean
    documentId: string
    currentTags: string[]
  }>({ open: false, documentId: '', currentTags: [] })

	useEffect(() => {
		getDocumentList().then(setDocs).catch(() => setDocs([]))
	}, [])

	useEffect(() => { storage.setSet(PINS_KEY, pins) }, [pins])
	useEffect(() => { storage.setSet(RECENTS_KEY, recents) }, [recents])
	useEffect(() => {
		const unsubscribePins = storage.onStorageChange(PINS_KEY, () => {
			setPins(storage.getSet(PINS_KEY))
		})
		const unsubscribeRecents = storage.onStorageChange(RECENTS_KEY, () => {
			setRecents(storage.getSet(RECENTS_KEY))
		})
		return () => {
			unsubscribePins()
			unsubscribeRecents()
		}
	}, [])
	useEffect(() => {
		storage.setJSON(COLLAPSE_KEY, { pinned: showPinned, recent: showRecent, all: showAll, unified: showUnified })
	}, [showPinned, showRecent, showAll, showUnified])
    useEffect(() => {
		storage.setItem(ONLY_PINS_KEY, onlyPins ? '1' : '0')
	}, [onlyPins])

  // Refresh function with loading state
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await getDocumentList().then(setDocs)
    } catch (error) {
      console.error('Failed to refresh library:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Tag editing functionality
  const handleEditTags = (documentId: string, currentTags: string[]) => {
    setTagEditDialog({
      open: true,
      documentId,
      currentTags
    })
  }

  const handleSaveTags = async (documentId: string, newTags: string[]) => {
    // Update local docs state
    setDocs(prevDocs => 
      prevDocs.map(doc => 
        doc.id === documentId 
          ? { ...doc, tags: newTags }
          : doc
      )
    )
    
    // Here you could also update the backend if needed
    // await updateDocumentTags(documentId, newTags)
    
    console.log(`Updated tags for ${documentId}:`, newTags)
  }

	const allTags = useMemo(() => {
		const s = new Set<string>()
		docs.forEach(d => (d.tags || []).forEach((t: string) => s.add(t)))
		// Note: unified data arguments don't currently have tags in markdown
		return Array.from(s).sort()
	}, [docs])

	// Combined data from docs and unified arguments
	const combinedData = useMemo(() => {
		const docItems = docs.map(d => ({
			...d,
			type: 'document' as const,
			hasGraph: false
		}))
		
		const argumentItems = unifiedData.arguments.map(arg => ({
			id: arg.id,
			label: arg.title || arg.id || 'Untitled Argument',
			tags: [], // Tags not currently supported in unified data
			type: 'argument' as const,
			hasGraph: !!arg.zlfnGraph
		}))
		
		return [...docItems, ...argumentItems]
	}, [docs, unifiedData.arguments])

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase()
		const hasTagFilter = selectedTags.size > 0
		return combinedData.filter(d => {
			const label = d.label || d.id || ''
			const matchesQuery = !q || label.toLowerCase().includes(q) || (d.id || '').toLowerCase().includes(q)
			const matchesTags = !hasTagFilter || (d.tags || []).some(t => selectedTags.has(t))
			const matchesPins = !onlyPins || pins.has(d.id)
			return matchesQuery && matchesTags && matchesPins
		})
	}, [combinedData, query, selectedTags, onlyPins, pins])

	const pinnedDocs = filtered.filter(d => pins.has(d.id)).sort((a,b)=>(a.label || '').localeCompare(b.label || ''))
	const recentDocs = filtered.filter(d => recents.has(d.id) && !pins.has(d.id)).sort((a,b)=>(a.label || '').localeCompare(b.label || ''))
	const otherDocs = filtered.filter(d => !pins.has(d.id) && !recents.has(d.id)).sort((a,b)=>(a.label || '').localeCompare(b.label || ''))

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
			<Tooltip title="Library">
				<IconButton color="inherit" onClick={() => setOpen(true)} sx={{ ml: 1 }}>
					<Badge badgeContent={unifiedData.arguments.length} color="primary" max={99}>
						<MenuBookIcon />
					</Badge>
				</IconButton>
			</Tooltip>
			<Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
				<Box sx={{ width: 400 }} role="presentation" onClick={() => setOpen(false)}>
					<Toolbar>
						<Typography variant="h6" sx={{ flexGrow: 1 }}>
							Library
						</Typography>
						<Tooltip title="Refresh Library">
							<IconButton 
								onClick={(e) => { 
									e.stopPropagation(); 
									handleRefresh(); 
								}}
								disabled={isRefreshing}
								size="small"
							>
								{isRefreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
							</IconButton>
						</Tooltip>
					</Toolbar>
					<Divider />
					
					{/* Enhanced Search Section */}
					<Box sx={{ px: 2, py: 1 }}>
						<TextField 
							fullWidth 
							size="small" 
							label="Search Library" 
							value={query} 
							onChange={e => setQuery(e.target.value)}
							InputProps={{
								startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
							}}
						/>
						
						{/* Statistics */}
						<Stack direction="row" spacing={2} sx={{ mt: 1, mb: 1 }}>
							<Typography variant="caption" color="text.secondary">
								{filtered.length} items ({docs.length} docs, {unifiedData.arguments.length} args)
							</Typography>
						</Stack>
						
						{/* Tag Filters */}
						{allTags.length > 0 && (
							<Box sx={{ mt: 1 }}>
								<Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
									<LocalOfferIcon sx={{ fontSize: 14, mr: 0.5 }} />
									Filter by Tags
								</Typography>
								<Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
									{allTags.slice(0, 8).map(t => {
										const active = selectedTags.has(t)
										return (
											<Chip 
												key={t} 
												size="small" 
												label={t} 
												color={active ? 'primary' : 'default'} 
												variant={active ? 'filled' : 'outlined'} 
												onClick={(e) => { 
													e.stopPropagation(); 
													const next = new Set(selectedTags); 
													if (active) next.delete(t); 
													else next.add(t); 
													setSelectedTags(next) 
												}} 
											/>
										)
									})}
									{allTags.length > 8 && (
										<Typography variant="caption" color="text.secondary">
											+{allTags.length - 8} more
										</Typography>
									)}
								</Stack>
								<Stack direction="row" spacing={1} sx={{ mt: 1 }}>
									<Button size="small" onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setSelectedTags(new Set()) }}>
										Clear Tags
									</Button>
									<Button 
										size="small" 
										variant={onlyPins ? 'contained' : 'outlined'} 
										onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setOnlyPins(v=>!v) }}
									>
										{onlyPins ? 'Only Pinned: On' : 'Only Pinned: Off'}
									</Button>
								</Stack>
							</Box>
						)}
					</Box>
					<Divider />
					{/* Unified Arguments Section */}
					{unifiedData.arguments.length > 0 && (
						<List subheader={
							<ListSubheader 
								disableSticky 
								onClick={(e)=>{e.preventDefault(); e.stopPropagation(); setShowUnified(s=>!s)}} 
								sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
							>
								<Box sx={{ display: 'flex', alignItems: 'center' }}>
									Arguments {showUnified ? '▾' : '▸'}
									<Chip size="small" label={unifiedData.arguments.length} sx={{ ml: 1 }} />
								</Box>
							</ListSubheader>
						}>
							{unifiedData.arguments
								.filter(arg => {
									const q = query.trim().toLowerCase()
									const hasTagFilter = selectedTags.size > 0
									const title = arg.title || arg.id || ''
									const matchesQuery = !q || title.toLowerCase().includes(q) || (arg.id || '').toLowerCase().includes(q)
									const matchesTags = !hasTagFilter // No tag filtering for arguments currently
									const matchesPins = !onlyPins || pins.has(arg.id)
									return matchesQuery && matchesTags && matchesPins
								})
								.map(arg => (
								<ListItemButton 
									key={arg.id} 
									component={RouterLink} 
									to={`/viz/zlfn?argument=${arg.id}`} 
									onClick={() => onOpenDoc(arg.id)} 
									sx={{ display: showUnified ? 'flex' : 'none', pl: 3 }}
								>
									<ListItemText 
										primary={
											<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
												<span>{arg.title}</span>
												{arg.zlfnGraph && <Chip size="small" label="Graph" color="success" />}
												{pins.has(arg.id) && <Chip size="small" label="Pinned" />}
											</Box>
										} 
										secondary={arg.id} 
									/>
									<Tooltip title={pins.has(arg.id) ? "Unpin" : "Pin"}>
										<IconButton 
											edge="end" 
											size="small" 
											onClick={(e) => { 
												e.preventDefault(); 
												e.stopPropagation(); 
												togglePin(arg.id) 
											}}
										>
											<PushPinIcon fontSize="small" color={pins.has(arg.id) ? "primary" : "inherit"} />
										</IconButton>
									</Tooltip>
								</ListItemButton>
							))}
						</List>
					)}

					{pinnedDocs.length > 0 && (
						<List subheader={
							<ListSubheader 
								disableSticky 
								onClick={(e)=>{e.preventDefault(); e.stopPropagation(); setShowPinned(s=>!s)}} 
								sx={{ cursor: 'pointer' }}
							>
								Pinned Documents {showPinned ? '▾' : '▸'}
							</ListSubheader>
						}>
							{pinnedDocs.filter(d => d.type === 'document').map(d => (
								<ListItemButton 
									key={d.id} 
									component={RouterLink} 
									to={`/document/${d.id}`} 
									onClick={() => onOpenDoc(d.id)} 
									sx={{ display: showPinned ? 'flex' : 'none' }}
								>
									<ListItemText 
										primary={
											<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
												<span>{d.label}</span>
												<Chip size="small" label="Doc" color="info" />
											</Box>
										} 
										secondary={<>{d.id}{(d.tags && d.tags.length) ? <> • {d.tags.join(', ')}</> : null}</>} 
									/>
									<Stack direction="row" spacing={0.5}>
										<Tooltip title="Edit Tags">
											<IconButton 
												edge="end" 
												size="small" 
												onClick={(e) => { 
													e.preventDefault(); 
													e.stopPropagation(); 
													handleEditTags(d.id, d.tags || []) 
												}}
											>
												<EditIcon fontSize="small" />
											</IconButton>
										</Tooltip>
										<Tooltip title="Unpin">
											<IconButton 
												edge="end" 
												size="small" 
												onClick={(e) => { 
													e.preventDefault(); 
													e.stopPropagation(); 
													togglePin(d.id) 
												}}
											>
												<PushPinIcon fontSize="small" color="primary" />
											</IconButton>
										</Tooltip>
									</Stack>
								</ListItemButton>
							))}
						</List>
					)}
					{recentDocs.length > 0 && (
						<List subheader={
							<ListSubheader 
								disableSticky 
								onClick={(e)=>{e.preventDefault(); e.stopPropagation(); setShowRecent(s=>!s)}} 
								sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
							>
								Recent Documents {showRecent ? '▾' : '▸'}
								<Button 
									size="small" 
									onClick={(e) => { 
										e.preventDefault(); 
										e.stopPropagation(); 
										setRecents(new Set()) 
									}} 
									sx={{ ml: 1 }}
								>
									Clear
								</Button>
							</ListSubheader>
						}>
							{recentDocs.filter(d => d.type === 'document').map(d => (
								<ListItemButton 
									key={d.id} 
									component={RouterLink} 
									to={`/document/${d.id}`} 
									onClick={() => onOpenDoc(d.id)} 
									sx={{ display: showRecent ? 'flex' : 'none' }}
								>
									<ListItemText 
										primary={
											<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
												<span>{d.label}</span>
												<Chip size="small" label="Doc" color="info" />
											</Box>
										} 
										secondary={<>{d.id}{(d.tags && d.tags.length) ? <> • {d.tags.join(', ')}</> : null}</>} 
									/>
									<Stack direction="row" spacing={0.5}>
										<Tooltip title="Edit Tags">
											<IconButton 
												edge="end" 
												size="small" 
												onClick={(e) => { 
													e.preventDefault(); 
													e.stopPropagation(); 
													handleEditTags(d.id, d.tags || []) 
												}}
											>
												<EditIcon fontSize="small" />
											</IconButton>
										</Tooltip>
										<Tooltip title="Pin">
											<IconButton 
												edge="end" 
												size="small" 
												onClick={(e) => { 
													e.preventDefault(); 
													e.stopPropagation(); 
													togglePin(d.id) 
												}}
											>
												<PushPinIcon fontSize="small" />
											</IconButton>
										</Tooltip>
									</Stack>
								</ListItemButton>
							))}
						</List>
					)}
					
					<List subheader={
						<ListSubheader 
							disableSticky 
							onClick={(e)=>{e.preventDefault(); e.stopPropagation(); setShowAll(s=>!s)}} 
							sx={{ cursor: 'pointer' }}
						>
							All Documents {showAll ? '▾' : '▸'}
						</ListSubheader>
					}>
						{otherDocs.filter(d => d.type === 'document').map(d => (
							<ListItemButton 
								key={d.id} 
								component={RouterLink} 
								to={`/document/${d.id}`} 
								onClick={() => onOpenDoc(d.id)} 
								sx={{ display: showAll ? 'flex' : 'none' }}
							>
								<ListItemText 
									primary={
										<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
											<span>{d.label}</span>
											<Chip size="small" label="Doc" color="info" />
										</Box>
									} 
									secondary={<>{d.id}{(d.tags && d.tags.length) ? <> • {d.tags.join(', ')}</> : null}</>} 
								/>
								<Stack direction="row" spacing={0.5}>
									<Tooltip title="Edit Tags">
										<IconButton 
											edge="end" 
											size="small" 
											onClick={(e) => { 
												e.preventDefault(); 
												e.stopPropagation(); 
												handleEditTags(d.id, d.tags || []) 
											}}
										>
											<EditIcon fontSize="small" />
										</IconButton>
									</Tooltip>
									<Tooltip title="Pin">
										<IconButton 
											edge="end" 
											size="small" 
											onClick={(e) => { 
												e.preventDefault(); 
												e.stopPropagation(); 
												togglePin(d.id) 
											}}
										>
											<PushPinIcon fontSize="small" />
										</IconButton>
									</Tooltip>
								</Stack>
							</ListItemButton>
						))}
					</List>
				</Box>
			</Drawer>
			
			{/* Tag Edit Dialog */}
			<TagEditDialog
				open={tagEditDialog.open}
				onClose={() => setTagEditDialog({ open: false, documentId: '', currentTags: [] })}
				documentId={tagEditDialog.documentId}
				currentTags={tagEditDialog.currentTags}
				allTags={allTags}
				onSave={handleSaveTags}
			/>
		</>
	)
}

export default LibrarySidebar


