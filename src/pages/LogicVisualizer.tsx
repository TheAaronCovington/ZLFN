import React from 'react'
import { Box, Snackbar, Alert, Dialog, DialogTitle, DialogContent } from '@mui/material'
import { ZlfnGraphWithNotes } from '../components/Visualizations/ZlfnGraphWithNotes'
import SemanticTableau from '../components/Visualizations/SemanticTableau'
import type { ZlfnNode, ZlfnEdge } from '../components/Visualizations/ZlfnGraph'
import type { VennDiagramData, NecessarySufficientExample } from '../components/Visualizations/VennDiagram'
import { parseExpressionToAst, astToZlfnGraph, toNNF, toCNF, astToString, type AstNodeRec } from '../services/logic'
import { type DocumentGraphData } from '../services/documentParser'
import { useLogicShared } from '../context/LogicSharedContext'
import { downloadJson, readJsonFile } from '../services/io'
import { CommandBar, ControlsDrawer, InspectorDrawer, StatusBar } from '../components/Visualizer'
import AdvancedSearch from '../components/Search/AdvancedSearch'
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor'

const LogicVisualizer: React.FC = () => {
	const { 
		selectedNodeId, 
		setSelectedNodeId, 
		currentExpression, 
		setCurrentExpression, 
 
		modes, 
		setModes,
		simulationMode,
		setSimulationMode,
		resetStates
	} = useLogicShared()

	// UI State (default drawers closed unless explicitly stored as 'true')
	const [controlsDrawerOpen, setControlsDrawerOpen] = React.useState(() => 
		localStorage.getItem('xv_controls_drawer') === 'true'
	)
	const [inspectorDrawerOpen, setInspectorDrawerOpen] = React.useState(() => 
		localStorage.getItem('xv_inspector_drawer') === 'true'
	)
	const [showPerformanceOverlay, setShowPerformanceOverlay] = React.useState(() => 
		localStorage.getItem('xv_performance_overlay') === 'true'
	)
	const [shortcutsOpen, setShortcutsOpen] = React.useState(false)
	const [advancedSearchOpen, setAdvancedSearchOpen] = React.useState(false)

	// View mode: graph (ZLFN) | tableau (STN)
	const [viewMode, setViewMode] = React.useState<'graph' | 'tableau'>(() => {
		try { return (localStorage.getItem('xv_view_mode') as any) || 'graph' } catch { return 'graph' }
	})
	React.useEffect(() => { try { localStorage.setItem('xv_view_mode', viewMode) } catch {} }, [viewMode])

	// Persist drawer states
	React.useEffect(() => {
		localStorage.setItem('xv_controls_drawer', String(controlsDrawerOpen))
	}, [controlsDrawerOpen])
	
	React.useEffect(() => {
		localStorage.setItem('xv_inspector_drawer', String(inspectorDrawerOpen))
	}, [inspectorDrawerOpen])
	
	React.useEffect(() => {
		localStorage.setItem('xv_performance_overlay', String(showPerformanceOverlay))
	}, [showPerformanceOverlay])

	// Logic processing
	const ast = React.useMemo<AstNodeRec | null>(() => parseExpressionToAst(currentExpression), [currentExpression])
	const graph = React.useMemo(() => (ast ? astToZlfnGraph(ast) : null), [ast])
	
	// Demo and document data
	const [showDemoExtras, setShowDemoExtras] = React.useState<boolean>(() => 
		localStorage.getItem('xv_demo_extras') === '1'
	)
	const [documentGraphData] = React.useState<DocumentGraphData | null>(null)
	const [useDocumentData, setUseDocumentData] = React.useState<boolean>(() => 
		localStorage.getItem('xv_use_document') === '1'
	)
	
	React.useEffect(() => { 
		try { localStorage.setItem('xv_demo_extras', showDemoExtras ? '1' : '0') } 
		catch {} 
	}, [showDemoExtras])
	
	React.useEffect(() => { 
		try { localStorage.setItem('xv_use_document', useDocumentData ? '1' : '0') } 
		catch {} 
	}, [useDocumentData])

	// Determine active data source
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

	// Add demo extras if enabled
	if (showDemoExtras && (!graph || (Array.isArray(graph.nodes) && graph.nodes.length <= 6))) {
		if (!nodes.find(n => n.id === 'C2')) {
			nodes = nodes.concat({ id: 'C2', label: 'C2', color: '#8e7cc3', type: 'conclusion', size: { width: 100, height: 30 }, argumentId: 'Demo' })
		}
		if (!nodes.find(n => n.id === 'F1')) {
			nodes = nodes.concat({ id: 'F1', label: 'F1', color: '#DC143C', type: 'fallacy', size: { width: 100, height: 30 }, argumentId: 'Demo' })
		}
		if (!edges.find(e => e.from === 'T1' && e.to === 'C2')) {
			edges = edges.concat({ from: 'T1', to: 'C2', weight: 60, style: 'dotted', rule: 'Weak Inference' })
		}
		if (!edges.find(e => e.from === 'P1' && e.to === 'F1')) {
			edges = edges.concat({ from: 'P1', to: 'F1', weight: 30, style: 'dashed', rule: 'Ad Hominem' })
		}
	}

	// Selection state
	const selectedNode = React.useMemo(() => 
		selectedNodeId ? nodes.find(n => n.id === selectedNodeId) || null : null, 
		[selectedNodeId, nodes]
	)
	const [selectedEdge, setSelectedEdge] = React.useState<any>(null)
	const [truthAst, setTruthAst] = React.useState<AstNodeRec | null>(null)

	// Search state
	const [searchId, setSearchId] = React.useState<string>('')
	const [searchTrigger, setSearchTrigger] = React.useState<number>(0)
	const nodeIdOptions = React.useMemo(() => nodes.map(n => n.id), [nodes])

	// Snackbar state
	const [snackbar, setSnackbar] = React.useState<{
		open: boolean
		msg: string
		severity?: 'success' | 'info' | 'warning' | 'error'
	}>({ open: false, msg: '' })

	const showInfo = (msg: string, severity: 'success' | 'info' | 'warning' | 'error' = 'info') => {
		setSnackbar({ open: true, msg, severity })
	}

	// Performance monitoring
	const performanceMonitor = usePerformanceMonitor({
		enabled: showPerformanceOverlay,
		sampleInterval: 100
	})

	// Venn diagram data
	const vennData: VennDiagramData = React.useMemo(() => ({
		sets: [
			{ label: 'Premises', items: nodes.filter(n => n.type === 'premise').map(n => n.label || n.id), color: '#20B2AA' },
			{ label: 'Conclusions', items: nodes.filter(n => n.type === 'conclusion').map(n => n.label || n.id), color: '#9370DB' }
		],
		intersection: []
	}), [nodes])

	const vennExamples: NecessarySufficientExample[] = [
		{ id: '1', title: 'Sufficient Example', necessary: 'All humans are mortal', sufficient: 'Socrates is mortal' },
		{ id: '2', title: 'Necessary Example', necessary: 'If it rains, the ground gets wet', sufficient: 'The ground is wet' }
	]

	// Event handlers
	const handleSearchChange = (value: string) => {
		setSearchId(value)
	}

	const handleSearchSelect = (value: string) => {
		if (value && nodes.find(n => n.id === value)) {
			setSearchId(value)
			setSelectedNodeId(value)
			setSearchTrigger(t => t + 1)
			showInfo(`Centering on ${value}`, 'success')
		}
	}



	const handleEdgeSelect = (edge: any) => {
		setSelectedEdge(edge)
	}

	const handleExpressionChange = (value: string) => {
		setCurrentExpression(value)
	}

	const handleResetExpression = () => {
		setCurrentExpression('(A ∧ B) → C')
		showInfo('Expression reset', 'success')
	}

	const handleCopyExpression = async () => {
		try {
			await navigator.clipboard.writeText(currentExpression)
			showInfo('Expression copied', 'success')
		} catch {
			showInfo('Failed to copy', 'error')
		}
	}

	const handleConvertToNNF = () => {
		const a = parseExpressionToAst(currentExpression)
		if (!a) return
		const s = astToString(toNNF(a))
		setCurrentExpression(s)
		showInfo('Converted to NNF', 'success')
	}

	const handleConvertToCNF = () => {
		const a = parseExpressionToAst(currentExpression)
		if (!a) return
		const s = astToString(toCNF(a))
		setCurrentExpression(s)
		showInfo('Converted to CNF', 'success')
	}

	const handleModeChange = (mode: string, checked: boolean) => {
		setModes((prev: any) => ({ ...prev, [mode]: checked }))
	}

	const handleToggleDocumentData = () => {
		setUseDocumentData(v => !v)
	}

	const handleToggleDemoExtras = () => {
		setShowDemoExtras(v => !v)
	}

	const handleExport = () => {
		const data = {
			expression: currentExpression,
			ast: ast ?? undefined,
			graph: graph ?? undefined,
			selectedNodeId,
			modes,
			useDocumentData,
			showDemoExtras
		}
		downloadJson(data, `logic-export-${Date.now()}.json`)
		showInfo('Exported successfully', 'success')
	}

	const handleImport = () => {
		const input = document.createElement('input')
		input.type = 'file'
		input.accept = 'application/json'
		input.onchange = async (e) => {
			const file = (e.target as HTMLInputElement).files?.[0]
			if (!file) return
			try {
				const data = await readJsonFile(file)
				if (data.expression) setCurrentExpression(data.expression)
				if (data.selectedNodeId) setSelectedNodeId(data.selectedNodeId)
				if (data.modes) setModes(data.modes)
				if (typeof data.useDocumentData === 'boolean') setUseDocumentData(data.useDocumentData)
				if (typeof data.showDemoExtras === 'boolean') setShowDemoExtras(data.showDemoExtras)
				showInfo('Imported successfully', 'success')
			} catch {
				showInfo('Import failed', 'error')
			}
		}
		input.click()
	}

	const handleOpenTruthTable = (expr: string) => {
		const ta = parseExpressionToAst(expr)
		if (ta) {
			setTruthAst(ta)
			setInspectorDrawerOpen(true)
			showInfo('Opened Truth Table', 'success')
		}
	}

	const handleCopyNode = async () => {
		if (!selectedNode) return
		try {
			await navigator.clipboard.writeText(`${selectedNode.id}: ${selectedNode.label || ''}`)
			showInfo('Node copied', 'success')
		} catch {
			showInfo('Failed to copy', 'error')
		}
	}

	const handleCopyEdge = async () => {
		if (!selectedEdge) return
		try {
			await navigator.clipboard.writeText(`${selectedEdge.from ?? selectedEdge.source} --${selectedEdge.rule ?? selectedEdge.label ?? ''}--> ${selectedEdge.to ?? selectedEdge.target}`)
			showInfo('Edge copied', 'success')
		} catch {
			showInfo('Failed to copy', 'error')
		}
	}

	// Keyboard shortcuts
	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
			
			const k = e.key.toLowerCase()
			if (e.ctrlKey || e.metaKey) {
				if (k === 'k') {
					e.preventDefault()
					setAdvancedSearchOpen(true)
				}
				return
			}
			
			if (k === 'g') { 
				showInfo('View: Graph', 'info') 
			}
			if (k === 'f') { 
				// Fit graph - would need to be implemented in graph component
				showInfo('Fit Graph', 'info') 
			}
			if (k === 'c') { 
				// Center graph - would need to be implemented in graph component
				showInfo('Center Graph', 'info') 
			}
			if (k === '?') {
				setShortcutsOpen(true)
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [])

	// Window size state for responsive drawer widths
	const [windowWidth, setWindowWidth] = React.useState(() => 
		typeof window !== 'undefined' ? window.innerWidth : 1200
	)

	React.useEffect(() => {
		const handleResize = () => setWindowWidth(window.innerWidth)
		window.addEventListener('resize', handleResize)
		return () => window.removeEventListener('resize', handleResize)
	}, [])

	// Calculate layout margins based on drawer states and screen size
	const getDrawerWidth = (type: 'controls' | 'inspector') => {
		if (windowWidth < 600) { // xs
			return type === 'controls' ? 280 : 300
		} else if (windowWidth < 960) { // sm
			return type === 'controls' ? 320 : 350
		} else { // md+
			return type === 'controls' ? 360 : 400
		}
	}
	
	const leftMargin = controlsDrawerOpen ? getDrawerWidth('controls') : 0
	const rightMargin = inspectorDrawerOpen ? getDrawerWidth('inspector') : 0
	// Second toolbar height if args row present
	const topOffset = 48

	return (
		<Box sx={{ 
			display: 'flex', 
			flexDirection: 'column', 
			height: '100vh',
			backgroundColor: '#0a0a0f'
		}}>
			{/* Command Bar */}
			<CommandBar
				searchValue={searchId}
				searchOptions={nodeIdOptions}
				onSearchChange={handleSearchChange}
				onSearchSelect={handleSearchSelect}
				onAdvancedSearch={() => setAdvancedSearchOpen(true)}
				simulationMode={simulationMode}
				onToggleSimulation={() => setSimulationMode(!simulationMode)}
				onResetStates={resetStates}
				onFitGraph={() => showInfo('Fit Graph', 'info')}
				onCenterGraph={() => showInfo('Center Graph', 'info')}
				onSaveLayout={() => showInfo('Layout Saved', 'success')}
				onClearLayout={() => showInfo('Layout Cleared', 'success')}
				onExport={handleExport}
				onImport={handleImport}
				onTogglePerformance={() => setShowPerformanceOverlay(!showPerformanceOverlay)}
				onShowShortcuts={() => setShortcutsOpen(true)}
				onShowHelp={() => showInfo('Help coming soon', 'info')}
				isPerformanceVisible={showPerformanceOverlay}
				controlsOpen={controlsDrawerOpen}
				inspectorOpen={inspectorDrawerOpen}
				onToggleControls={() => setControlsDrawerOpen(v => !v)}
				onToggleInspector={() => setInspectorDrawerOpen(v => !v)}
				argumentIds={Array.from(new Set(nodes.map(n => n.argumentId).filter(Boolean) as string[]))}
				selectedArgumentId={(() => { try { return localStorage.getItem(`xv_argument_${currentExpression}`) || null } catch { return null } })()}
				onSelectArgument={(id) => {
					// Persist and dispatch an event so the graph updates its filter
					try {
						if (id) localStorage.setItem(`xv_argument_${currentExpression}`, id)
						else localStorage.removeItem(`xv_argument_${currentExpression}`)
					} catch {}
					// Fire a custom event that graph listens to via key handler already; we add a bespoke event
					const ev = new CustomEvent('zlfn:set-argument', { detail: { id } })
					window.dispatchEvent(ev as any)
				}}
				viewMode={viewMode}
				onChangeViewMode={(m) => setViewMode(m)}
			/>

			{/* Main Content Area */}
			<Box sx={{ 
				display: 'flex', 
				flexGrow: 1,
				position: 'relative',
				overflow: 'hidden',
				width: '100vw',
				maxWidth: '100vw'
			}}>
				{/* Controls Drawer */}
				<ControlsDrawer
					open={controlsDrawerOpen}
					onClose={() => setControlsDrawerOpen(false)}
					topOffset={topOffset}
					expression={currentExpression}
					onExpressionChange={handleExpressionChange}
					onResetExpression={handleResetExpression}
					onCopyExpression={handleCopyExpression}
					onConvertToNNF={handleConvertToNNF}
					onConvertToCNF={handleConvertToCNF}
					modes={modes}
					onModeChange={handleModeChange}
					useDocumentData={useDocumentData}
					onToggleDocumentData={handleToggleDocumentData}
					documentArguments={documentGraphData?.arguments}
					showDemoExtras={showDemoExtras}
					onToggleDemoExtras={handleToggleDemoExtras}
				/>

				{/* Graph Canvas */}
				<Box sx={{ 
					flexGrow: 1,
					marginLeft: leftMargin,
					marginRight: rightMargin,
					transition: 'margin 0.3s ease',
					position: 'relative',
					height: `calc(100vh - ${topOffset}px - 32px)`,
					minWidth: 0,
					overflow: 'hidden'
				}}>
					{/* Drawer Toggle Buttons */}
					{!controlsDrawerOpen && (
						<Box sx={{ 
							position: 'absolute', 
							left: 8, 
							bottom: 8, 
							zIndex: 1000,
							backgroundColor: 'rgba(25, 25, 35, 0.9)',
							borderRadius: 1,
							border: '1px solid rgba(64, 196, 255, 0.2)'
						}}>
							<button 
								onClick={() => setControlsDrawerOpen(true)}
								style={{
									background: 'none',
									border: 'none',
									color: '#40c4ff',
									padding: '8px 12px',
									cursor: 'pointer',
									fontSize: '12px',
									fontWeight: 500
								}}
							>
								Controls ›
							</button>
						</Box>
					)}
					
					{!inspectorDrawerOpen && (
						<Box sx={{ 
							position: 'absolute', 
							right: 8, 
							bottom: 8, 
							zIndex: 1000,
							backgroundColor: 'rgba(25, 25, 35, 0.9)',
							borderRadius: 1,
							border: '1px solid rgba(64, 196, 255, 0.2)'
						}}>
							<button 
								onClick={() => setInspectorDrawerOpen(true)}
								style={{
									background: 'none',
									border: 'none',
									color: '#40c4ff',
									padding: '8px 12px',
									cursor: 'pointer',
									fontSize: '12px',
									fontWeight: 500
								}}
							>
								‹ Inspector
							</button>
						</Box>
					)}

					{/* Graph Component */}
					<Box sx={{ 
						width: '100%', 
						height: '100%', 
						position: 'relative',
						overflow: 'hidden'
					}}>
						{viewMode === 'graph' ? (
							<ZlfnGraphWithNotes
								nodes={nodes}
								edges={edges}
								storageKey={currentExpression}
								onInfo={showInfo}
								centerOnNodeId={searchId || undefined}
								centerOnNodeTrigger={searchTrigger}
								onEdgeSelect={handleEdgeSelect}
								onOpenTruthTable={handleOpenTruthTable}
								objectId="main-visualizer"
								showNotesIndicators={true}
							/>
						) : (
							<SemanticTableau expression={currentExpression} ast={ast} />
						)}
					</Box>
				</Box>

				{/* Inspector Drawer */}
				<InspectorDrawer
					open={inspectorDrawerOpen}
					onClose={() => setInspectorDrawerOpen(false)}
					topOffset={topOffset}
					selectedNode={selectedNode}
					selectedEdge={selectedEdge}
					truthTableAst={truthAst}
					onCloseTruthTable={() => setTruthAst(null)}
					vennData={vennData}
					vennExamples={vennExamples}
					nodeCount={nodes.length}
					edgeCount={edges.length}
					fps={performanceMonitor.metrics.fps}
					memoryUsage={performanceMonitor.metrics.memoryUsage}
					onCopyNode={handleCopyNode}
					onCopyEdge={handleCopyEdge}
					onOpenNodeNotes={() => showInfo('Notes coming soon', 'info')}
					onEditNode={() => showInfo('Edit coming soon', 'info')}
					onCenterOnNode={() => {
						if (selectedNode) {
							setSearchId(selectedNode.id)
							setSearchTrigger(t => t + 1)
							showInfo(`Centered on ${selectedNode.id}`, 'success')
						}
					}}
					onCenterOnEdge={() => showInfo('Center on edge coming soon', 'info')}
				/>
			</Box>

			{/* Status Bar */}
			<StatusBar
				nodeCount={nodes.length}
				edgeCount={edges.length}
				selectedCount={selectedNode || selectedEdge ? 1 : 0}
				fps={showPerformanceOverlay ? performanceMonitor.metrics.fps : undefined}
				memoryUsage={showPerformanceOverlay ? performanceMonitor.metrics.memoryUsage : undefined}
				isPerformanceVisible={showPerformanceOverlay}
				statusMessage={snackbar.open ? snackbar.msg : undefined}
				statusType={snackbar.severity}
			/>

			{/* Advanced Search Dialog */}
			<Dialog 
				open={advancedSearchOpen} 
				onClose={() => setAdvancedSearchOpen(false)}
				maxWidth="md"
				fullWidth
				PaperProps={{
					sx: {
						backgroundColor: 'rgba(25, 25, 35, 0.95)',
						backdropFilter: 'blur(8px)',
						border: '1px solid rgba(64, 196, 255, 0.2)'
					}
				}}
			>
				<DialogTitle sx={{ color: '#40c4ff' }}>Advanced Search</DialogTitle>
				<DialogContent>
					<AdvancedSearch
						open={advancedSearchOpen}
						onClose={() => setAdvancedSearchOpen(false)}
						onSelectResult={(_objectId: any, nodeId: any) => {
							if (nodeId && nodes.find(n => n.id === nodeId)) {
								setSearchId(nodeId)
								setSelectedNodeId(nodeId)
								setSearchTrigger(t => t + 1)
								showInfo(`Found and centered on ${nodeId}`, 'success')
							}
							setAdvancedSearchOpen(false)
						}}
						currentNodes={nodes}
					/>
				</DialogContent>
			</Dialog>

			{/* Keyboard Shortcuts Dialog */}
			<Dialog 
				open={shortcutsOpen} 
				onClose={() => setShortcutsOpen(false)}
				PaperProps={{
					sx: {
						backgroundColor: 'rgba(25, 25, 35, 0.95)',
						backdropFilter: 'blur(8px)',
						border: '1px solid rgba(64, 196, 255, 0.2)'
					}
				}}
			>
				<DialogTitle sx={{ color: '#40c4ff' }}>Keyboard Shortcuts</DialogTitle>
				<DialogContent sx={{ color: '#ffffff' }}>
					<Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 1, fontSize: 14 }}>
						<strong>Ctrl/Cmd + K</strong><span>Open Advanced Search</span>
						<strong>G</strong><span>Graph View</span>
						<strong>F</strong><span>Fit Graph</span>
						<strong>C</strong><span>Center Graph</span>
						<strong>?</strong><span>Show Shortcuts</span>
					</Box>
				</DialogContent>
			</Dialog>

			{/* Snackbar */}
			<Snackbar 
				open={snackbar.open} 
				autoHideDuration={3000} 
				onClose={() => setSnackbar(s => ({ ...s, open: false }))} 
				anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
				sx={{ mb: 4 }} // Above status bar
			>
				<Alert 
					severity={snackbar.severity || 'info'} 
					variant="filled" 
					sx={{ width: '100%' }}
				>
					{snackbar.msg}
				</Alert>
			</Snackbar>
		</Box>
	)
}

export default LogicVisualizer
