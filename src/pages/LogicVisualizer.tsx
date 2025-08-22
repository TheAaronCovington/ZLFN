import React from 'react'
import { Box, Snackbar, Alert, Dialog, DialogTitle, DialogContent, CircularProgress } from '@mui/material'

// Lazy load heavy visualization components
const ZlfnGraphWithNotes = React.lazy(() => import('../components/Visualizations/ZlfnGraphWithNotes').then(module => ({ default: module.ZlfnGraphWithNotes })))
const SemanticTableau = React.lazy(() => import('../components/Visualizations/SemanticTableau'))
const ArgumentTableau = React.lazy(() => import('../components/Visualizations/ArgumentTableau'))
import type { ZlfnNode } from '../components/Visualizations/ZlfnGraph/types'
import type { VennDiagramData, NecessarySufficientExample } from '../components/Visualizations/VennDiagram'
import { parseExpressionToAst, toNNF, toCNF, astToString, sanitizeExpressionForParser, type AstNodeRec } from '../services/logic'
import { useLogicShared } from '../context/LogicSharedContext'
import { parseAstInWorker } from '../services/astWorkerClient'
import { downloadJson, readJsonFile } from '../services/io'
import { CommandBar, ControlsDrawer, InspectorDrawer, StatusBar } from '../components/Visualizer'
import AdvancedSearch from '../components/Search/AdvancedSearch'
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor'
import { useGlobalShortcuts, createShortcut } from '../hooks/useGlobalShortcuts'
import type { ImportedJSON } from '../services/argumentNormalizer'

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
		resetStates,
		// Unified data access
		unifiedData,
		setUnifiedData,
		getAstFor,
		getZlfnGraphFor,
		getAtnDataFor
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

	// View mode: graph (ZLFN) | tableau (STN) | argument (ATN)
	const [viewMode, setViewMode] = React.useState<'graph' | 'tableau' | 'argument'>(() => {
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

	// Get data from shared context based on selected argument (async to keep UI responsive)
	const selectedArgumentId = unifiedData.selectedArgumentId
	const [ast, setAst] = React.useState<any>(null)
	const [graph, setGraph] = React.useState<any>(null)
	const [atnData, setAtnData] = React.useState<any>(null)

	React.useEffect(() => {
		let cancelled = false
		setAst(null)
		if (viewMode === 'tableau') {
			const id = selectedArgumentId
			const arg = unifiedData.arguments.find(a => a.id === id)
			const expr = (arg?.expressions && arg.expressions[0]) || currentExpression
			// Keep the UI's expression label in sync with the active argument
			if (expr && expr !== currentExpression) {
				setCurrentExpression(expr)
			}
			if (arg?.ast) {
				setAst(arg.ast)
			} else if (expr) {
				const sanitized = sanitizeExpressionForParser(expr)
				parseAstInWorker(sanitized).then(astResult => {
					if (cancelled) return
					if (!astResult) {
						// Fallback: parse synchronously if worker produced no AST
						const syncAst = parseExpressionToAst(sanitized)
						if (syncAst) {
							setAst(syncAst)
							if (arg) {
								setUnifiedData(prev => ({
									...prev,
									arguments: prev.arguments.map(a => a.id === arg.id ? { ...a, ast: syncAst } : a)
								}))
							}
							return
						}
						// Final fallback: synthesize from graph via shared accessor
						const out = getAstFor(id)
						setAst(out)
						return
					}
					setAst(astResult)
					if (astResult && arg) {
						setUnifiedData(prev => ({
							...prev,
							arguments: prev.arguments.map(a => a.id === arg.id ? { ...a, ast: astResult } : a)
						}))
					}
				}).catch(() => {
					const out = getAstFor(id)
					if (!cancelled) setAst(out)
				})
			} else {
				const out = getAstFor(id)
				if (!cancelled) setAst(out)
			}
		}
		return () => { cancelled = true }
	}, [viewMode, selectedArgumentId, unifiedData.arguments, setUnifiedData, getAstFor, currentExpression, setCurrentExpression])

	React.useEffect(() => {
		let cancelled = false
		setGraph(null)
		if (viewMode === 'graph') {
			const id = selectedArgumentId
			setTimeout(() => {
				if (cancelled) return
				const out = getZlfnGraphFor(id)
				if (!cancelled) setGraph(out)
			}, 0)
		}
		return () => { cancelled = true }
	}, [viewMode, selectedArgumentId, getZlfnGraphFor])

	React.useEffect(() => {
		let cancelled = false
		setAtnData(null)
		if (viewMode === 'argument') {
			const id = selectedArgumentId
			setTimeout(() => {
				if (cancelled) return
				const out = getAtnDataFor(id)
				if (!cancelled) setAtnData(out)
			}, 0)
		}
		return () => { cancelled = true }
	}, [viewMode, selectedArgumentId, getAtnDataFor])
	
	// Demo extras and document data (kept for backward compatibility)
	const [showDemoExtras, setShowDemoExtras] = React.useState<boolean>(() => 
		localStorage.getItem('xv_demo_extras') === '1'
	)
	const [useDocumentData, setUseDocumentData] = React.useState<boolean>(() => 
		localStorage.getItem('xv_use_document') === '1'
	)

	// Advanced Features State
	const [showRivers, setShowRivers] = React.useState<boolean>(() => 
		localStorage.getItem('xv_rivers') !== '0'
	)
	const [bayesianEnabled, setBayesianEnabled] = React.useState<boolean>(() => 
		localStorage.getItem('xv_bayesian') === '1'
	)

	// Persist advanced features state
	React.useEffect(() => {
		try { localStorage.setItem('xv_rivers', showRivers ? '1' : '0') } catch {}
	}, [showRivers])
	
	React.useEffect(() => {
		try { localStorage.setItem('xv_bayesian', bayesianEnabled ? '1' : '0') } catch {}
	}, [bayesianEnabled])
	
	React.useEffect(() => { 
		try { localStorage.setItem('xv_demo_extras', showDemoExtras ? '1' : '0') } 
		catch {} 
	}, [showDemoExtras])
	
	React.useEffect(() => { 
		try { localStorage.setItem('xv_use_document', useDocumentData ? '1' : '0') } 
		catch {} 
	}, [useDocumentData])

	// Active data is now always from the shared context
	const activeData = graph
	
	// Document graph data (for backward compatibility)
	const documentGraphData = React.useMemo(() => {
		const currentArgument = unifiedData.arguments.find(arg => arg.id === selectedArgumentId)
		return currentArgument ? {
			nodes: graph?.nodes || [],
			edges: graph?.edges || [],
			arguments: [{
				id: currentArgument.id,
				title: currentArgument.title,
				type: 'formal',
				premises: currentArgument.expressions,
				conclusions: []
			}],
			documentId: currentArgument.id
		} : null
	}, [unifiedData.arguments, selectedArgumentId, graph])
	
	let nodes: ZlfnNode[] = activeData?.nodes || [
		{ id: 'P1', label: 'P1', color: '#20B2AA', type: 'premise', size: { width: 100, height: 30 }, argumentId: 'Demo' },
		{ id: 'T1', label: 'T1', color: '#4169E1', type: 'term', size: { radius: 20 }, argumentId: 'Demo' },
		{ id: 'C', label: 'C', color: '#9370DB', type: 'conclusion', size: { width: 100, height: 30 }, argumentId: 'Demo' },
	]
	let edges = (activeData?.edges || [
		{ from: 'P1', to: 'T1', weight: 85, style: 'solid', rule: 'Modus Ponens' },
		{ from: 'T1', to: 'C', weight: 75, style: 'dashed', rule: 'Hypothetical Syllogism' },
	]) as any[]

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
				// If payload contains shared arguments, dispatch to shared context via window event
				if ((data as ImportedJSON)?.arguments) {
					const ev = new CustomEvent('xv:add-imported-json', { detail: data as ImportedJSON })
					window.dispatchEvent(ev)
				} else {
					// Legacy UI state import
					const legacy: any = data
					if (legacy.expression) setCurrentExpression(legacy.expression)
					if (legacy.selectedNodeId) setSelectedNodeId(legacy.selectedNodeId)
					if (legacy.modes) setModes(legacy.modes)
					if (typeof legacy.useDocumentData === 'boolean') setUseDocumentData(legacy.useDocumentData)
					if (typeof legacy.showDemoExtras === 'boolean') setShowDemoExtras(legacy.showDemoExtras)
				}
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

	// Keyboard shortcuts using global shortcuts hook
	const shortcuts = React.useMemo(() => [
		createShortcut('k', () => setAdvancedSearchOpen(true), 'Open Advanced Search', { ctrl: true }),
		createShortcut('g', () => showInfo('View: Graph', 'info'), 'Graph View'),
		createShortcut('f', () => showInfo('Fit Graph', 'info'), 'Fit Graph'),
		createShortcut('c', () => showInfo('Center Graph', 'info'), 'Center Graph'),
		createShortcut('?', () => setShortcutsOpen(true), 'Show Shortcuts')
	], [])

	useGlobalShortcuts(shortcuts, {
		disableInInputs: true,
		disableInDialogs: true,
		debugLogging: false,
		componentName: 'LogicVisualizer'
	})

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
	// Main toolbar (48px) + Second toolbar (36px) + border
	const topOffset = 48 + 36 + 2

	// Graph control handlers
	const handleFitGraph = React.useCallback(() => {
		// Dispatch custom event for graph components to handle
		const event = new CustomEvent('zlfn:fit-graph')
		window.dispatchEvent(event)
		showInfo('Graph fitted to view', 'success')
	}, [showInfo])

	const handleCenterGraph = React.useCallback(() => {
		// Dispatch custom event for graph components to handle
		const event = new CustomEvent('zlfn:center-graph')
		window.dispatchEvent(event)
		showInfo('Graph centered', 'success')
	}, [showInfo])

	// Auto-fit on dataset changes (Phase 1)
	React.useEffect(() => {
		if (viewMode === 'graph' && (nodes.length > 0 || edges.length > 0)) {
			// Small delay to allow graph to render before fitting
			const timer = setTimeout(() => {
				const event = new CustomEvent('zlfn:fit-graph')
				window.dispatchEvent(event)
			}, 300)
			return () => clearTimeout(timer)
		}
	}, [viewMode, nodes.length, edges.length, selectedArgumentId])

	return (
		<Box sx={{ 
			display: 'flex', 
			flexDirection: 'column', 
			height: '100vh',
			backgroundColor: 'var(--ai-bg-primary)'
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
				onFitGraph={handleFitGraph}
				onCenterGraph={handleCenterGraph}
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
				viewMode={viewMode}
				onChangeViewMode={(m) => setViewMode(m)}
				showRivers={showRivers}
				onToggleRivers={() => setShowRivers(v => !v)}
				bayesianEnabled={bayesianEnabled}
				onToggleBayesian={() => setBayesianEnabled(v => !v)}
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
					height: `calc(100vh - ${topOffset}px - 60px)`, // Account for bottom navigation
					minWidth: 0,
					overflow: 'hidden',
					width: `calc(100vw - ${leftMargin}px - ${rightMargin}px)`
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
						<React.Suspense fallback={
							<Box display="flex" justifyContent="center" alignItems="center" height="100%">
								<CircularProgress size={60} />
							</Box>
						}>
							{							viewMode === 'graph' ? (
								<ZlfnGraphWithNotes
									nodes={nodes}
									edges={edges}
									storageKey={selectedArgumentId || 'default'}
									onInfo={showInfo}
									centerOnNodeId={searchId || undefined}
									centerOnNodeTrigger={searchTrigger}
									onEdgeSelect={handleEdgeSelect}
									onOpenTruthTable={handleOpenTruthTable}
									objectId="main-visualizer"
									showNotesIndicators={true}
									showRivers={showRivers}
									bayesianEnabled={bayesianEnabled}
								/>
							) : viewMode === 'tableau' ? (
								<SemanticTableau 
									expression={currentExpression} 
									ast={ast} 
								/>
							) : (
								<ArgumentTableau 
									expression={currentExpression} 
									ast={ast}
									argument={atnData as any}
									onNodeSelect={(node) => {
										// Handle ATN node selection
										showInfo(`Selected argument node: ${node.name || node.label}`)
									}}
									onEdgeSelect={(edge) => {
										// Handle ATN edge selection
										showInfo(`Selected relationship: ${edge.scheme}`)
									}}
								/>
							)}
						</React.Suspense>
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
