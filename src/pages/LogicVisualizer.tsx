import React from 'react'
import { Box, Typography, Stack, TextField, Button, ToggleButton, ToggleButtonGroup, Snackbar, Alert, Dialog, DialogTitle, DialogContent, Autocomplete, Checkbox, FormControlLabel, FormGroup } from '@mui/material'
import DocumentViewer from '../components/DocumentViewer/DocumentViewer'
import ZlfnGraph from '../components/Visualizations/ZlfnGraph'
import type { ZlfnNode, ZlfnEdge } from '../components/Visualizations/ZlfnGraph'
import VennDiagram from '../components/Visualizations/VennDiagram'
import type { VennDiagramData, NecessarySufficientExample } from '../components/Visualizations/VennDiagram'
import Heatmap from '../components/Visualizations/Heatmap'
import NeonCard from '../components/UI/NeonCard'
import { parseExpressionToAst, astToZlfnGraph, toNNF, toCNF, astToString } from '../services/logic'
import { parseDocumentToGraph, type DocumentGraphData } from '../services/documentParser'
import ASTTree from '../components/Visualizations/ASTTree'
import type { AstNodeRec } from '../components/Visualizations/ASTTree'
import { useLogicShared } from '../context/LogicSharedContext'
import NeonAccordion from '../components/Accordion/NeonAccordion'
import { downloadJson, readJsonFile, readSavedLayout } from '../services/io'
import TruthTable from '../components/Visualizations/TruthTable'

const LogicVisualizer: React.FC = () => {
	const { selectedNodeId, setSelectedNodeId, currentExpression, setCurrentExpression, bumpExpressionHighlight, modes, setModes } = useLogicShared()
	const [viewMode, setViewMode] = React.useState<'graph' | 'ast' | 'both'>(() => (localStorage.getItem('xv_view_mode') as 'graph'|'ast'|'both') || 'graph')
	React.useEffect(() => { try { localStorage.setItem('xv_view_mode', viewMode) } catch {} }, [viewMode])
	const [docId, setDocId] = React.useState<'TAG_Critique' | 'expressions_guide'>(() => (localStorage.getItem('xv_viz_doc') as any) || 'TAG_Critique')
	React.useEffect(() => { try { localStorage.setItem('xv_viz_doc', docId) } catch {} }, [docId])
	const [qsDismissed, setQsDismissed] = React.useState<boolean>(() => localStorage.getItem('xv_qs_dismissed') === '1')
	const dismissQS = () => { setQsDismissed(true); try { localStorage.setItem('xv_qs_dismissed', '1') } catch {} }
	const toggleQS = () => { const next = !qsDismissed; setQsDismissed(next); try { localStorage.setItem('xv_qs_dismissed', next ? '1' : '0') } catch {} }
	const ast = React.useMemo<AstNodeRec | null>(() => parseExpressionToAst(currentExpression), [currentExpression])
	const graph = React.useMemo(() => (ast ? astToZlfnGraph(ast) : null), [ast])
	const [showDemoExtras, setShowDemoExtras] = React.useState<boolean>(() => localStorage.getItem('xv_demo_extras') === '1')
	React.useEffect(() => { try { localStorage.setItem('xv_demo_extras', showDemoExtras ? '1' : '0') } catch {} }, [showDemoExtras])
	
	// Document-based graph data
	const [documentGraphData, setDocumentGraphData] = React.useState<DocumentGraphData | null>(null)
	const [useDocumentData, setUseDocumentData] = React.useState<boolean>(() => localStorage.getItem('xv_use_document') === '1')
	React.useEffect(() => { try { localStorage.setItem('xv_use_document', useDocumentData ? '1' : '0') } catch {} }, [useDocumentData])
	// Determine data source: document graph data takes precedence over AST graph
	const activeData = useDocumentData && documentGraphData ? documentGraphData : 
					   graph ? { nodes: graph.nodes as ZlfnNode[], edges: graph.edges as ZlfnEdge[] } : null
	
	let nodes: ZlfnNode[] = activeData?.nodes || [
		{ id: 'P1', label: 'P1', color: '#20B2AA', type: 'premise', size: { width: 100, height: 30 }, argumentId: 'Demo' },
		{ id: 'T1', label: 'T1', color: '#4169E1', type: 'term', size: { radius: 20 }, argumentId: 'Demo' },
		{ id: 'C', label: 'C', color: '#9370DB', type: 'conclusion', size: { width: 100, height: 30 }, argumentId: 'Demo' },
	]
	let edges: ZlfnEdge[] = activeData?.edges || [
		{ from: 'P1', to: 'T1', weight: 85, style: 'solid', rule: 'Modus Ponens' },
		{ from: 'T1', to: 'C', weight: 75, style: 'dashed', rule: 'Hypothetical Syllogism' },
	]
	if (showDemoExtras && (!graph || (Array.isArray(graph.nodes) && graph.nodes.length <= 6))) {
		// add extra conclusion and fallacy for boundary verification
		if (!nodes.find(n => n.id === 'C2')) nodes = nodes.concat({ id: 'C2', label: 'C2', color: '#8e7cc3', type: 'conclusion', size: { width: 100, height: 30 }, argumentId: 'Demo' })
		if (!nodes.find(n => n.id === 'F1')) nodes = nodes.concat({ id: 'F1', label: 'F1', color: '#DC143C', type: 'fallacy', size: { width: 100, height: 30 }, argumentId: 'Demo' })
		// add demo informal and temporal nodes
		if (!nodes.find(n => n.id === 'INF1')) nodes = nodes.concat({ id: 'INF1', label: 'Informal Note', color: '#ffb74d', type: 'informal', size: { width: 120, height: 26 }, argumentId: 'Demo' })
		if (!nodes.find(n => n.id === 'TMP1')) nodes = nodes.concat({ id: 'TMP1', label: 't0..t3', color: '#64b5f6', type: 'temporal', size: { width: 90, height: 26 }, argumentId: 'Demo' })
		// add Core component as central argument hub
		if (!nodes.find(n => n.id === 'CORE1')) {
			nodes = nodes.concat({ 
				id: 'CORE1', 
				label: 'Core Hub', 
				color: '#ffd700', 
				type: 'core', 
				layoutMode: 'radial',
				complexity: 'moderate',
				centralHub: true,
				connectedArguments: ['Demo', 'Secondary'],
				size: { radius: 30 }, 
				argumentId: 'Demo' 
			})
		}
		edges = edges.concat(
			{ from: nodes[1]?.id || 'T1', to: 'C2', weight: 72, style: 'solid', rule: 'Inference' },
			{ from: 'F1', to: nodes[1]?.id || 'T1', weight: 50, style: 'dotted', rule: 'Fallacy Link', type: 'counterexample' },
			{ from: 'CORE1', to: 'P1', weight: 90, style: 'solid', rule: 'Core Connection' },
			{ from: 'CORE1', to: 'C', weight: 88, style: 'solid', rule: 'Core Connection' },
			{ from: 'INF1', to: 'T1', weight: 40, style: 'dotted', rule: 'Informal Context', type: 'semantic' },
			{ from: 'TMP1', to: 'C', weight: 60, style: 'dashed', rule: 'Temporal Lead', type: 'semantic' },
		)
	}
	const examples: NecessarySufficientExample[] = [
		{ id: 'ex', title: 'If A then B', necessary: 'A', sufficient: 'B' },
	]
	const vennData: VennDiagramData = {
		description: 'Necessary & sufficient demo',
		sets: [
			{ label: 'A', items: ['a1', 'a2'], color: '#40c4ff' },
			{ label: 'B', items: ['b1'], color: '#00e676' },
		],
		intersection: ['a∧b'],
	}
	const selectedNode = React.useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [nodes, selectedNodeId])
	const [snackbar, setSnackbar] = React.useState<{ open: boolean; msg: string; severity?: 'success'|'info'|'warning'|'error' }>({ open: false, msg: '' })
	const showInfo = (msg: string, severity: 'success'|'info'|'warning'|'error' = 'info') => setSnackbar({ open: true, msg, severity })
	
	// Load document graph data when docId changes
	React.useEffect(() => {
		if (useDocumentData && docId) {
			parseDocumentToGraph(docId).then(data => {
				setDocumentGraphData(data)
				if (data && data.arguments.length > 0) {
					showInfo(`Loaded ${data.arguments.length} logical arguments from document`, 'success')
				}
			}).catch(error => {
				console.error('Failed to parse document:', error)
				showInfo('Failed to parse document for logical arguments', 'error')
			})
		} else {
			setDocumentGraphData(null)
		}
	}, [docId, useDocumentData, showInfo])
	
	const exprInputRef = React.useRef<HTMLInputElement | null>(null)
	const [searchId, setSearchId] = React.useState<string>('')
	const [searchTrigger, setSearchTrigger] = React.useState<number>(0)
    const [shortcutsOpen, setShortcutsOpen] = React.useState(false)
    const [truthAst, setTruthAst] = React.useState<AstNodeRec | null>(null)
	const searchInputRef = React.useRef<HTMLInputElement | null>(null)

	React.useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return
			const k = e.key.toLowerCase()
			if (k === 'g') { setViewMode('graph'); showInfo('View: Graph') }
			if (k === 'a') { setViewMode('ast'); showInfo('View: AST') }
			if (k === 'b') { setViewMode('both'); showInfo('View: Both') }
			if (e.key === '?') { setShortcutsOpen(true) }
			if (k === 'k') { searchInputRef.current?.focus() }
			if (k === 'escape') { setShortcutsOpen(false) }
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [showInfo])

	React.useEffect(() => {
		// bump highlight when selection changes (doc auto-scroll to active expr)
		bumpExpressionHighlight()
		// persist selected node per expression
		try { localStorage.setItem(`xv_sel_${currentExpression}`, selectedNodeId || '') } catch {}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedNodeId])

	React.useEffect(() => {
		// restore selection when expression changes
		try {
			const saved = localStorage.getItem(`xv_sel_${currentExpression}`)
			if (saved) setSelectedNodeId(saved)
			else setSelectedNodeId(null)
		} catch {}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentExpression])

	const selectionItems = React.useMemo(() => {
		if (!selectedNode) return []
		const outEdges = edges.filter(e => (e.from ?? e.source) === selectedNode.id)
		const inEdges = edges.filter(e => (e.to ?? e.target) === selectedNode.id)
		return [
			{ id: 'info', title: 'Info', content: (
				<Box sx={{ fontSize: 14 }}>
					<div><strong>ID:</strong> {selectedNode.id}</div>
					<div><strong>Label:</strong> {selectedNode.label}</div>
					{selectedNode.symbol && <div><strong>Symbol:</strong> {selectedNode.symbol}</div>}
					{selectedNode.name && <div><strong>Name:</strong> {selectedNode.name}</div>}
					{selectedNode.type && <div><strong>Type:</strong> {selectedNode.type}</div>}
					<Stack direction="row" spacing={1} sx={{ mt: 1 }}>
						<Button size="small" variant="outlined" onClick={() => setSelectedNodeId(null)}>Clear</Button>
						<Button size="small" variant="outlined" onClick={async () => {
							const outEdges = edges.filter(e => (e.from ?? e.source) === selectedNode.id)
							const inEdges = edges.filter(e => (e.to ?? e.target) === selectedNode.id)
							const lines: string[] = []
							lines.push(`Node ${selectedNode.id}`)
							if (selectedNode.label) lines.push(`Label: ${selectedNode.label}`)
							if (selectedNode.symbol) lines.push(`Symbol: ${selectedNode.symbol}`)
							if (selectedNode.name) lines.push(`Name: ${selectedNode.name}`)
							if (selectedNode.type) lines.push(`Type: ${selectedNode.type}`)
							if (inEdges.length) {
								lines.push('Incoming:')
								inEdges.forEach(e => lines.push(`  ${e.from ?? e.source} --${e.rule ?? e.label ?? ''}--> ${selectedNode.id}`))
							}
							if (outEdges.length) {
								lines.push('Outgoing:')
								outEdges.forEach(e => lines.push(`  ${selectedNode.id} --${e.rule ?? e.label ?? ''}--> ${e.to ?? e.target}`))
							}
							try { await navigator.clipboard.writeText(lines.join('\n')); showInfo('Copied selection details', 'success') } catch {}
						}}>Copy Details</Button>
					</Stack>
				</Box>
			) },
			{ id: 'out', title: `Outgoing (${outEdges.length})`, content: (
				<Box sx={{ fontSize: 13 }}>
					{outEdges.length ? outEdges.map((e, i) => <div key={i}>{e.rule || e.label || 'edge'} → {(e.to ?? e.target) as string}</div>) : <div>None</div>}
				</Box>
			)},
			{ id: 'in', title: `Incoming (${inEdges.length})`, content: (
				<Box sx={{ fontSize: 13 }}>
					{inEdges.length ? inEdges.map((e, i) => <div key={i}>{(e.from ?? e.source) as string} → {e.rule || e.label || 'edge'}</div>) : <div>None</div>}
				</Box>
			)},
		]
	}, [selectedNode, edges, setSelectedNodeId])

	const [preview, setPreview] = React.useState<any | null>(null)
	const exportAll = () => {
		const layout = readSavedLayout(currentExpression)
		const slug = currentExpression.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'logic'
		let pins: string[] = []
		let recents: string[] = []
		try { pins = JSON.parse(localStorage.getItem('xv_pins') || '[]') } catch {}
		try { recents = JSON.parse(localStorage.getItem('xv_recents') || '[]') } catch {}
		downloadJson({ expression: currentExpression, ast: ast ?? undefined, graph: graph ?? undefined, viewMode, selectedNodeId, layout: layout ?? undefined, pins, recents }, `logic-export-${slug}.json`)
		showInfo('Exported JSON', 'success')
	}
	const importFromFile = async (file?: File | null) => {
		if (!file) return
		try {
			const json = await readJsonFile(file)
			setPreview(json)
		} catch { showInfo('Import failed', 'error') }
	}
	const applyPreview = () => {
		if (!preview) return
		if (typeof preview?.expression === 'string') setCurrentExpression(preview.expression)
		if (preview?.viewMode === 'graph' || preview?.viewMode === 'ast' || preview?.viewMode === 'both') setViewMode(preview.viewMode)
		if (typeof preview?.selectedNodeId === 'string' || preview?.selectedNodeId === null) setSelectedNodeId(preview.selectedNodeId ?? null)
		if (preview?.layout && typeof preview.layout === 'object') {
			try { localStorage.setItem(`xv_layout_${preview.expression}`, JSON.stringify(preview.layout)) } catch {}
		}
		if (Array.isArray(preview?.pins)) { try { localStorage.setItem('xv_pins', JSON.stringify(preview.pins)) } catch {} }
		if (Array.isArray(preview?.recents)) { try { localStorage.setItem('xv_recents', JSON.stringify(preview.recents)) } catch {} }
		setPreview(null)
		showInfo('Imported JSON', 'success')
	}

	const copyExpr = async () => { try { await navigator.clipboard.writeText(currentExpression); showInfo('Copied expression', 'success') } catch {} }

	const nodeIdOptions = React.useMemo(() => nodes.map(n => n.id), [nodes])

	const [selectedEdge, setSelectedEdge] = React.useState<ZlfnEdge | null>(null)

	return (
		<div style={{ maxWidth: 1400, margin: '0 auto', padding: '1rem' }}>
			<Typography variant="h5" sx={{ mb: 2 }}>Logic Visualizer</Typography>
			<Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
				<Box>
					<NeonCard title="Document">
						<Stack direction="row" spacing={1} sx={{ mb: 1 }}>
							<Button size="small" variant={docId === 'TAG_Critique' ? 'contained' : 'outlined'} onClick={() => setDocId('TAG_Critique')}>Critique</Button>
							<Button size="small" variant={docId === 'expressions_guide' ? 'contained' : 'outlined'} onClick={() => setDocId('expressions_guide')}>Guide</Button>
						</Stack>
						<DocumentViewer filenameOverride={docId} />
					</NeonCard>
				</Box>
				<Box>
					<Stack spacing={2}>
						<NeonCard title="Expression">
							<Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
								<TextField inputRef={exprInputRef} autoFocus fullWidth label="Expression" size="small" value={currentExpression} onChange={e => setCurrentExpression(e.target.value)} />
								<Button variant="outlined" onClick={() => setCurrentExpression('(A ∧ B) → C')}>Reset</Button>
								<Button variant="outlined" onClick={copyExpr}>Copy</Button>
								<Button variant="outlined" onClick={exportAll}>Export</Button>
								<Button variant="outlined" onClick={() => { const a = parseExpressionToAst(currentExpression); if (!a) return; const s = astToString(toNNF(a)); setCurrentExpression(s); showInfo('Converted to NNF') }}>NNF</Button>
								<Button variant="outlined" onClick={() => { const a = parseExpressionToAst(currentExpression); if (!a) return; const s = astToString(toCNF(a)); setCurrentExpression(s); showInfo('Converted to CNF') }}>CNF</Button>
								<Button variant="outlined" component="label">
									Import
									<input hidden type="file" accept="application/json" onChange={e => importFromFile(e.target.files?.[0])} />
								</Button>
							</Stack>
						</NeonCard>
						<NeonCard title="Modes">
							<FormGroup row>
								{(['classical','epistemic','deontic','temporal','informal','paraconsistent','fuzzy'] as const).map(m => (
									<FormControlLabel key={m} control={<Checkbox checked={!!modes[m]} onChange={(_, checked)=> setModes((prev: any) => ({ ...prev, [m]: checked }))} />} label={m} />
								))}
							</FormGroup>
						</NeonCard>
						<NeonCard title="View">
							<ToggleButtonGroup
								color="primary"
								value={viewMode}
								exclusive
								onChange={(_, val) => val && setViewMode(val)}
								size="small"
							>
								<ToggleButton value="graph">Graph</ToggleButton>
								<ToggleButton value="ast">AST</ToggleButton>
								<ToggleButton value="both">Both</ToggleButton>
							</ToggleButtonGroup>
							<Button size="small" variant="outlined" sx={{ ml: 1 }} onClick={() => setShortcutsOpen(true)}>Shortcuts</Button>
							<Button size="small" variant="outlined" sx={{ ml: 1 }} onClick={toggleQS}>{qsDismissed ? 'Show Quick Start' : 'Hide Quick Start'}</Button>
							<Button size="small" variant={showDemoExtras ? 'contained' : 'outlined'} sx={{ ml: 1 }} onClick={() => setShowDemoExtras(v=>!v)}>Demo Extras</Button>
							<Button size="small" variant={useDocumentData ? 'contained' : 'outlined'} sx={{ ml: 1 }} onClick={() => setUseDocumentData(v=>!v)}>Document Mode</Button>
						</NeonCard>
						
						{/* Document Arguments Panel */}
						{useDocumentData && documentGraphData && documentGraphData.arguments.length > 0 && (
							<NeonCard title={`Logical Arguments (${documentGraphData.arguments.length})`}>
								<Stack spacing={1}>
									{documentGraphData.arguments.map((arg) => (
										<Box key={arg.id} sx={{ p: 1, border: '1px solid rgba(64,196,255,0.3)', borderRadius: 1, backgroundColor: 'rgba(25,25,35,0.5)' }}>
											<Typography variant="subtitle2" sx={{ color: '#40c4ff', mb: 0.5 }}>{arg.title}</Typography>
											<Typography variant="caption" sx={{ color: '#8ad7ff', textTransform: 'uppercase' }}>{arg.type} argument</Typography>
											{arg.premises.length > 0 && (
												<Box sx={{ mt: 1 }}>
													<Typography variant="caption" sx={{ color: '#20B2AA', fontWeight: 600 }}>Premises:</Typography>
													{arg.premises.map((premise, pIdx) => (
														<Box key={pIdx} sx={{ ml: 1, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
															{pIdx + 1}. {premise.length > 80 ? premise.substring(0, 80) + '...' : premise}
														</Box>
													))}
												</Box>
											)}
											{arg.conclusions.length > 0 && (
												<Box sx={{ mt: 1 }}>
													<Typography variant="caption" sx={{ color: '#9370DB', fontWeight: 600 }}>Conclusions:</Typography>
													{arg.conclusions.map((conclusion, cIdx) => (
														<Box key={cIdx} sx={{ ml: 1, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
															{cIdx + 1}. {conclusion.length > 80 ? conclusion.substring(0, 80) + '...' : conclusion}
														</Box>
													))}
												</Box>
											)}
											{arg.validity && (
												<Box sx={{ mt: 1 }}>
													<Typography variant="caption" sx={{ color: arg.validity === 'valid' ? '#00e676' : '#ff5252' }}>
														{arg.validity.toUpperCase()}
													</Typography>
												</Box>
											)}
										</Box>
									))}
								</Stack>
							</NeonCard>
						)}
						
						{(truthAst || ast) && (
							<NeonCard title={truthAst ? 'Truth Table (node expression)' : 'Truth Table'}>
								{truthAst && (
									<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
										<Typography variant="body2" color="text.secondary">Viewing table for selected node expression</Typography>
										<Button size="small" variant="outlined" onClick={()=> setTruthAst(null)}>Close</Button>
									</Box>
								)}
								<TruthTable ast={truthAst || ast!} />
							</NeonCard>
						)}
						<NeonCard title="Find Node">
							<Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
								<Autocomplete
									size="small"
									options={nodeIdOptions}
									value={searchId}
									onChange={(_, val) => setSearchId(val || '')}
									renderInput={(params) => <TextField {...params} inputRef={searchInputRef} onKeyDown={(e) => { if (e.key === 'Enter' && searchId) { setSearchTrigger(t => t + 1); setSelectedNodeId(searchId); showInfo(`Centering ${searchId}`) } }} label="Node ID" />}
									freeSolo
									fullWidth
								/>
								<Button variant="outlined" onClick={() => { if (searchId) { setSearchTrigger(t => t + 1); setSelectedNodeId(searchId); showInfo(`Centering ${searchId}`) } }}>Go</Button>
							</Stack>
						</NeonCard>
						{!qsDismissed && (
							<NeonCard title="Quick Start">
								<NeonAccordion items={[
									{ id: 'qs1', title: '1) Enter expression', content: <div>Use symbols or ASCII: {'`(A ∧ B) → C`'} , {'`A & B -> C`'} , {'`X <-> Y`'}.</div> },
									{ id: 'qs2', title: '2) Toggle views', content: <div>Switch Graph/AST or Both. Click nodes to select; use Fit/Center controls.</div> },
									{ id: 'qs3', title: '3) Save layout', content: <div>Drag nodes, then Save Layout to persist per expression.</div> },
								]} />
								<Box sx={{ textAlign: 'right', mt: 1 }}>
									<Button size="small" onClick={dismissQS}>Dismiss</Button>
								</Box>
							</NeonCard>
						)}
						<NeonCard title="Selection">
							{selectedNode ? (
								<NeonAccordion items={selectionItems} />
							) : (
								<Box sx={{ color: 'text.secondary', fontSize: 14 }}>No node selected.</Box>
							)}
						</NeonCard>
						{(viewMode === 'graph' || viewMode === 'both') && (
							<NeonCard title="ZLFN Graph">
								<ZlfnGraph
									nodes={nodes}
									edges={edges}
									storageKey={currentExpression}
									onInfo={msg => showInfo(msg, 'success')}
									centerOnNodeId={searchId || undefined}
									centerOnNodeTrigger={searchTrigger}
									onEdgeSelect={setSelectedEdge}
									onOpenTruthTable={(expr) => { const ta = parseExpressionToAst(expr); if (ta) { setTruthAst(ta); showInfo('Opened Truth Table for node expression') } }}
								/>
							</NeonCard>
						)}
						{(viewMode === 'ast' || viewMode === 'both') && (
							<NeonCard title="AST Tree">
								{ast ? <ASTTree roots={[ast]} /> : <div>Invalid expression.</div>}
							</NeonCard>
						)}
						<NeonCard title="Edge Details">
							{selectedEdge ? (
								<Box sx={{ fontSize: 13 }}>
									<div><strong>Rule:</strong> {selectedEdge.rule || selectedEdge.label || '(none)'}</div>
									<div><strong>From:</strong> {(selectedEdge.from ?? selectedEdge.source) as string}</div>
									<div><strong>To:</strong> {(selectedEdge.to ?? selectedEdge.target) as string}</div>
									{selectedEdge.type && <div><strong>Type:</strong> {selectedEdge.type}</div>}
									{typeof selectedEdge.weight === 'number' && <div><strong>Weight:</strong> {selectedEdge.weight}%</div>}
									<Stack direction="row" spacing={1} sx={{ mt: 1 }}>
										<Button size="small" variant="outlined" onClick={async ()=>{ try { await navigator.clipboard.writeText(`${selectedEdge.from ?? selectedEdge.source} --${selectedEdge.rule ?? selectedEdge.label ?? ''}--> ${selectedEdge.to ?? selectedEdge.target}`); showInfo('Copied edge', 'success') } catch {} }}>Copy</Button>
										<Button size="small" variant="outlined" onClick={()=>setSelectedEdge(null)}>Clear</Button>
									</Stack>
								</Box>
							) : (
								<Box sx={{ color: 'text.secondary', fontSize: 13 }}>Click an edge to see details.</Box>
							)}
						</NeonCard>
						<NeonCard title="Necessary & Sufficient">
							<VennDiagram title="" data={vennData} type="necessary-sufficient" examples={examples} />
						</NeonCard>
						<NeonCard title="Heatmap">
							<Heatmap data={Array.from({ length: 16 * 8 }, (_, i) => ({ x: i % 16, y: Math.floor(i / 16), value: Math.random() * 100 }))} xSize={16} ySize={8} />
						</NeonCard>
					</Stack>
				</Box>
			</Box>
			<Snackbar open={snackbar.open} autoHideDuration={2000} onClose={() => setSnackbar(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
				<Alert severity={snackbar.severity || 'info'} variant="filled" sx={{ width: '100%' }}>{snackbar.msg}</Alert>
			</Snackbar>
			<Dialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)}>
				<DialogTitle>Keyboard Shortcuts</DialogTitle>
				<DialogContent sx={{ fontSize: 14 }}>
					<div><strong>g</strong>: View Graph</div>
					<div><strong>a</strong>: View AST</div>
					<div><strong>b</strong>: View Both</div>
					<div><strong>f</strong>: Fit Graph</div>
					<div><strong>c</strong>: Center on Selection</div>
					<div><strong>p</strong>: Center on Path</div>
					<div><strong>s</strong>: Save Layout</div>
					<div><strong>m</strong>: Toggle Simulation</div>
					<div><strong>r</strong>: Reset States</div>
					<div><strong>h</strong>: Toggle Path Highlight</div>
					<div><strong>x</strong>: Freeze/Unfreeze Layout</div>
					<div><strong>l</strong>: Toggle Edge Labels</div>
					<div><strong>k</strong>: Focus Node Search</div>
					<div><strong>e</strong>: Clear Edge Selection</div>
					<div><strong>/</strong>: Focus Rule Filter</div>
					<div><strong>Esc</strong>: Close Shortcuts</div>
					<div><strong>Ctrl + Click</strong> (node): Pin/Unpin</div>
				</DialogContent>
			</Dialog>
			<Dialog open={!!preview} onClose={() => setPreview(null)}>
				<DialogTitle>Import Preview</DialogTitle>
				<DialogContent sx={{ fontSize: 13 }}>
					{preview ? (
						<Box sx={{ display: 'grid', gap: 1 }}>
							<div><strong>Expression:</strong> {String(preview.expression || '')}</div>
							<div><strong>View:</strong> {String(preview.viewMode || '')}</div>
							<div><strong>Selected:</strong> {String(preview.selectedNodeId || '')}</div>
							<div><strong>Pins:</strong> {Array.isArray(preview.pins) ? preview.pins.length : 0}</div>
							<div><strong>Recents:</strong> {Array.isArray(preview.recents) ? preview.recents.length : 0}</div>
							<Stack direction="row" spacing={1} sx={{ mt: 1 }}>
								<Button size="small" variant="contained" onClick={applyPreview}>Apply</Button>
								<Button size="small" variant="outlined" onClick={() => setPreview(null)}>Cancel</Button>
							</Stack>
						</Box>
					) : null}
				</DialogContent>
			</Dialog>
		<div
			onDragOver={(e)=>{ e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
			onDrop={async (e)=>{ e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) await importFromFile(f) }}
			style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}
		/>
	</div>
	)
}

export default LogicVisualizer


