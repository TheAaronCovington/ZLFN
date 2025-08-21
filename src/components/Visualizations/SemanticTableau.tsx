import React from 'react'
import * as d3 from 'd3'
import { Box, ToggleButton, ToggleButtonGroup, Tooltip, Button, LinearProgress, Snackbar, Alert, Select, MenuItem, FormControl, InputLabel, Chip, Slider, Typography, Switch, FormControlLabel } from '@mui/material'
import { astToString, type AstNodeRec } from '../../services/logic'
import { validateRule, type LogicMode } from '../../services/inference'
import { downloadJson, readJsonFile, type ExportPayload } from '../../services/io'
import { createFacetIcons } from '../../vis'
import { VennDiagramDialog, TruthTableDialog, TimelineDialog, CounterargumentsDialog } from '../Enhanced'

export interface SemanticTableauProps {
	// Prefer reusing the current expression/AST from the visualizer
	expression: string
	ast: AstNodeRec | null
}

type TableauNode = {
	id: string
	label: string
	type: 'root' | 'open' | 'closed' | 'intermediate'
	children?: TableauNode[]
	ast?: AstNodeRec
	decomposed?: boolean
}

// Very lightweight AST → Tableau scaffold. This purposefully reuses the parsed AST
// and maps it to a simple tree so we can render a usable STN without duplicating logic.
function astToTableau(ast: AstNodeRec): TableauNode {
	const map = (node: AstNodeRec, depth: number): TableauNode => {
		const label = node.label || node.id || '?'
		const isLeaf = !node.children || node.children.length === 0
		const t: TableauNode = {
			id: node.id || `${label}-${depth}-${Math.random().toString(36).slice(2, 7)}`,
			label,
			type: depth === 0 ? 'root' : (isLeaf ? 'open' : 'intermediate'),
			ast: node
		}
		// Stepped expansion: do not attach children initially; they are created via Decompose (D)
		return t
	}
	return map(ast, 0)
}

export const SemanticTableau: React.FC<SemanticTableauProps> = ({ expression, ast }) => {
	const containerRef = React.useRef<HTMLDivElement | null>(null)
	const svgRef = React.useRef<SVGSVGElement | null>(null)
	const [layoutMode, setLayoutMode] = React.useState<'tree' | 'hierarchy'>('tree')
	const initialFitDoneRef = React.useRef<boolean>(false)
	
	// Logic mode for advanced reasoning
	const [logicMode, setLogicMode] = React.useState<LogicMode>(() => {
		try { return (localStorage.getItem('xv_stn_logic_mode') as LogicMode) || 'classical' } catch { return 'classical' }
	})
	React.useEffect(() => { 
		try { localStorage.setItem('xv_stn_logic_mode', logicMode) } catch {} 
	}, [logicMode])
	
	// Step controls
	const [stepMode, setStepMode] = React.useState<boolean>(() => {
		try { return localStorage.getItem('xv_stn_step_mode') === 'true' } catch { return false }
	})
	const [maxDepth, setMaxDepth] = React.useState<number>(() => {
		try { return parseInt(localStorage.getItem('xv_stn_max_depth') || '5') } catch { return 5 }
	})
	const [currentStep, setCurrentStep] = React.useState<number>(0)
	
	React.useEffect(() => { 
		try { localStorage.setItem('xv_stn_step_mode', stepMode.toString()) } catch {} 
	}, [stepMode])
	
	React.useEffect(() => { 
		try { localStorage.setItem('xv_stn_max_depth', maxDepth.toString()) } catch {} 
	}, [maxDepth])
	
	// Local tableau state derived from AST (moved here to be available for proof validation)
	const [root, setRoot] = React.useState<TableauNode | null>(ast ? astToTableau(ast) : null)
	
	// Node selection and path highlighting
	const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null)
	
	// Proof validation
	const [proofStatus, setProofStatus] = React.useState<{
		isComplete: boolean
		isValid: boolean
		openBranches: number
		closedBranches: number
		errors: string[]
	}>({ isComplete: false, isValid: true, openBranches: 0, closedBranches: 0, errors: [] })
	
	// Validate tableau completeness and correctness
	const validateTableau = React.useCallback(() => {
		if (!root) {
			setProofStatus({ isComplete: false, isValid: true, openBranches: 0, closedBranches: 0, errors: [] })
			return
		}
		
		const errors: string[] = []
		let openBranches = 0
		let closedBranches = 0
		let hasDecomposableNodes = false
		
		// Check all branches for completeness
		const validateBranch = (node: TableauNode, path: TableauNode[] = []): void => {
			const currentPath = [...path, node]
			
			// Check if this node can be decomposed
			if (!node.decomposed && node.ast && (isAlpha(node.ast) || isBeta(node.ast) || isImplication(node.ast) || isDoubleNeg(node.ast))) {
				hasDecomposableNodes = true
			}
			
			// If this is a leaf node, check if branch is closed
			if (!node.children || node.children.length === 0) {
				if (node.type === 'closed') {
					closedBranches++
				} else {
					openBranches++
					// Check if this branch should be closed (contains contradiction)
					const formulas = currentPath.map(n => serialize(n.ast)).filter(Boolean)
					const hasContradiction = formulas.some(f => formulas.includes(complementOf(f)))
					if (hasContradiction && node.type === 'open') {
						errors.push(`Branch ending at "${node.label}" contains contradiction but is not marked closed`)
					}
				}
			} else {
				// Recurse into children
				node.children.forEach(child => validateBranch(child, currentPath))
			}
		}
		
		validateBranch(root)
		
		const isComplete = !hasDecomposableNodes && openBranches === 0
		const isValid = errors.length === 0
		
		setProofStatus({
			isComplete,
			isValid,
			openBranches,
			closedBranches,
			errors
		})
	}, [root])
	
	// Auto-validate when tableau changes
	React.useEffect(() => {
		validateTableau()
	}, [validateTableau])
	
	// Export/Import functionality
	const exportTableau = () => {
		const payload: ExportPayload = {
			expression,
			ast: ast || undefined,
			tableau: {
				root,
				logicMode,
				selectedNodeId,
				layoutMode
			},
			viewMode: 'tableau'
		}
		downloadJson(payload, `tableau-${expression.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.json`)
	}
	
	const importTableau = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (!file) return
		
		try {
			const data = await readJsonFile(file)
			if (data.tableau) {
				setRoot(data.tableau.root)
				if (data.tableau.logicMode) setLogicMode(data.tableau.logicMode)
				if (data.tableau.selectedNodeId) setSelectedNodeId(data.tableau.selectedNodeId)
				if (data.tableau.layoutMode) setLayoutMode(data.tableau.layoutMode)
			}
		} catch (error) {
			console.error('Failed to import tableau:', error)
		}
		
		// Reset file input
		event.target.value = ''
	}
	const prevSizeRef = React.useRef<{ width: number; height: number } | null>(null)
	const renderEpochRef = React.useRef<number>(0)
	const prevExpressionRef = React.useRef<string | null>(null)
	const prevAstIdRef = React.useRef<string | null>(null)

	// Facet dialogs (reusing enhanced dialogs from ZLFN)
	const [selectedNodeForDialog, setSelectedNodeForDialog] = React.useState<any | null>(null)
	const [vennOpen, setVennOpen] = React.useState(false)
	const [truthOpen, setTruthOpen] = React.useState(false)
	const [timelineOpen, setTimelineOpen] = React.useState(false)
	const [counterOpen, setCounterOpen] = React.useState(false)

	// (State declarations moved above for proper dependency order)
	// State persistence per expression
	const getStorageKey = (expr: string) => `xv_stn_${expr.replace(/[^a-zA-Z0-9]/g, '_')}`
	
	const saveTableauState = React.useCallback(() => {
		if (!expression) return
		try {
			// Only save UI preferences, not the expanded tableau structure
			// This ensures tableaux always start fresh and collapsed
			const state = {
				logicMode,
				layoutMode,
				timestamp: Date.now()
				// Removed: root, selectedNodeId to prevent auto-expansion on reload
			}
			localStorage.setItem(getStorageKey(expression), JSON.stringify(state))
		} catch (error) {
			console.warn('Failed to save tableau state:', error)
		}
	}, [expression, logicMode, layoutMode])
	
	const loadTableauState = React.useCallback((expr: string) => {
		try {
			const saved = localStorage.getItem(getStorageKey(expr))
			if (saved) {
				const state = JSON.parse(saved)
				return state
			}
		} catch (error) {
			console.warn('Failed to load tableau state:', error)
		}
		return null
	}, [])
	
	// Reset root when expression/AST changes, always start fresh
	React.useEffect(() => {
		if (!ast) {
			setRoot(null)
			return
		}
		
		// Always start with fresh tableau from AST (don't restore expanded state)
		// This ensures tableaux always start collapsed and require manual expansion
		setRoot(astToTableau(ast))
		
		// Clear any selection when switching expressions
		setSelectedNodeId(null)
		
		// Only restore UI preferences, not the tableau structure
		const savedState = loadTableauState(expression)
		if (savedState) {
			if (savedState.logicMode) setLogicMode(savedState.logicMode)
			if (savedState.layoutMode) setLayoutMode(savedState.layoutMode)
			// Don't restore selectedNodeId or root structure to keep tableaux collapsed
		}
	}, [ast, expression, loadTableauState])
	
	// Auto-save state when it changes
	React.useEffect(() => {
		const timeoutId = setTimeout(saveTableauState, 1000) // Debounce saves
		return () => clearTimeout(timeoutId)
	}, [saveTableauState])
	
	// Keyboard shortcuts (reusing ZLFN pattern)
	React.useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const active = (document.activeElement as HTMLElement | null) || (e.target as HTMLElement | null)
			if (active) {
				const tag = active.tagName
				const inDialog = !!active.closest('[role="dialog"], .MuiDialog-root, .MuiModal-root, .MuiPopover-root, [data-notes-dialog="true"]')
				const role = active.getAttribute?.('role')
				const isEditable = (active as any).isContentEditable || role === 'textbox'
				
				if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || isEditable || inDialog) {
					return // Skip shortcuts in input fields or dialogs
				}
			}
			
			// STN-specific shortcuts
			if (e.key.toLowerCase() === 'd' && selectedNodeId && root) {
				e.preventDefault()
				// Decompose selected node
				const findAndExpand = (node: TableauNode): boolean => {
					if (node.id === selectedNodeId) {
						return expandBranch(node)
					}
					if (node.children) {
						for (const child of node.children) {
							if (findAndExpand(child)) return true
						}
					}
					return false
				}
				if (findAndExpand(root)) {
					setRoot(prev => prev ? cloneTableau(prev) : prev)
				}
			}
			
			if (e.key.toLowerCase() === 'x' && selectedNodeId && root) {
				e.preventDefault()
				// Close selected branch
				setRoot(prev => {
					if (!prev) return prev
					const newRoot = cloneTableau(prev)
					markNodeAsClosed(selectedNodeId, newRoot)
					return newRoot
				})
			}
			
			if (e.key.toLowerCase() === 'a' && !e.ctrlKey) {
				e.preventDefault()
				autoExpand()
			}
			
			if (e.key.toLowerCase() === 'c' && !e.ctrlKey) {
				e.preventDefault()
				autoClose()
			}
			
			if (e.key.toLowerCase() === 'e' && e.ctrlKey) {
				e.preventDefault()
				exportTableau()
			}
			
			// Arrow keys for node navigation
			if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
				e.preventDefault()
				// TODO: Implement node navigation
			}
		}
		
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [selectedNodeId, root, autoExpand, autoClose, exportTableau])
	
	// Helper to find path from selected node to root
	function findPathToRoot(nodeId: string, currentNode: TableauNode, path: string[] = []): string[] | null {
		const currentPath = [...path, currentNode.id]
		if (currentNode.id === nodeId) return currentPath
		if (currentNode.children) {
			for (const child of currentNode.children) {
				const result = findPathToRoot(nodeId, child, currentPath)
				if (result) return result
			}
		}
		return null
	}
	
	const pathToRoot = selectedNodeId && root ? findPathToRoot(selectedNodeId, root) || [] : []

	// Resize observer to keep the canvas responsive, reusing our typical pattern
	const [size, setSize] = React.useState({ width: 1000, height: 600 })
	React.useEffect(() => {
		const el = containerRef.current
		if (!el) return
		const ro = new ResizeObserver(() => {
			setSize({ width: el.clientWidth || 1000, height: el.clientHeight || 600 })
		})
		ro.observe(el)
		return () => ro.disconnect()
	}, [])

	// Helpers for rules and closure
	const isAlpha = (n: AstNodeRec | undefined) => !!n && (n.label === '∧')
	const isBeta = (n: AstNodeRec | undefined) => !!n && (n.label === '∨' || n.label === '⊻')
	const isDoubleNeg = (n: AstNodeRec | undefined) => !!n && n.label === '¬' && n.children && (n.children[0] as any)?.label === '¬'
	const isImplication = (n: AstNodeRec | undefined) => !!n && (n.label === '→' || n.label === '⇒' || n.label === '⊃')
	const serialize = (n: AstNodeRec | undefined): string => (n ? astToString(n) : '')
	const complementOf = (s: string) => s.startsWith('¬') ? s.slice(1) : `¬${s}`
	
	// Helper to get rule badge for a node
	function getRuleBadge(node: TableauNode): { text: string; color: string; tooltip: string } | null {
		if (!node.ast) return null
		
		if (isAlpha(node.ast)) return { text: 'α', color: '#2196f3', tooltip: 'Alpha rule (conjunction)' }
		if (isBeta(node.ast)) return { text: 'β', color: '#ff9800', tooltip: 'Beta rule (disjunction)' }
		if (isImplication(node.ast)) return { text: '→', color: '#9c27b0', tooltip: 'Implication rule' }
		if (isDoubleNeg(node.ast)) return { text: '¬¬', color: '#4caf50', tooltip: 'Double negation elimination' }
		
		// Check for negated complex formulas
		if (node.ast.label === '¬' && node.ast.children) {
			const inner = (node.ast.children as any)[0] as AstNodeRec
			if (inner.label === '∧') return { text: '¬α', color: '#ff5722', tooltip: 'Negated conjunction (De Morgan)' }
			if (inner.label === '∨' || inner.label === '⊻') return { text: '¬β', color: '#795548', tooltip: 'Negated disjunction (De Morgan)' }
			if (isImplication(inner)) return { text: '¬→', color: '#607d8b', tooltip: 'Negated implication' }
		}
		
		return null
	}

	function cloneTableau(node: TableauNode): TableauNode {
		return {
			...node,
			children: node.children ? node.children.map(cloneTableau) : undefined
		}
	}

	function expandBranch(target: TableauNode): boolean {
		if (!target.ast || target.decomposed) return false
		
		// Create logic mode context for rule validation
		const modes: Partial<Record<LogicMode, boolean>> = { [logicMode]: true }
		
		// helper to build node from AST
		const nodeFromAst = (n: AstNodeRec): TableauNode => ({
			id: n.id || Math.random().toString(36),
			label: n.label || 'P',
			type: (!n.children || (n.children as any).length === 0) ? 'open' : 'intermediate',
			ast: n
		})
		// Double negation
		if (isDoubleNeg(target.ast) && validateRule('Double Negation', modes)) {
			const inner = (target.ast.children![0] as any).children![0] as AstNodeRec
			target.ast = inner
			target.label = inner.label || target.label
			target.decomposed = true
			return true
		}
		
		// Negation rules
		if (target.ast.label === '¬' && target.ast.children && (target.ast.children as any)[0]) {
			const inner = (target.ast.children as any)[0] as AstNodeRec
			// ¬(A ∧ B) -> ¬A | ¬B (β)
			if (inner.label === '∧' && inner.children && (inner.children as any).length === 2 && validateRule('De Morgan', modes)) {
				const [a, b] = inner.children as AstNodeRec[]
				const notA: AstNodeRec = { id: `neg-${a.id || Math.random().toString(36).slice(2,7)}`, label: '¬', children: [a] as any }
				const notB: AstNodeRec = { id: `neg-${b.id || Math.random().toString(36).slice(2,7)}`, label: '¬', children: [b] as any }
				target.children = [nodeFromAst(notA), nodeFromAst(notB)]
				target.decomposed = true
				return true
			}
			// ¬(A ∨ B) -> ¬A & ¬B (α) — chain them so both on same branch
			if ((inner.label === '∨' || inner.label === '⊻') && inner.children && (inner.children as any).length === 2 && validateRule('De Morgan', modes)) {
				const [a, b] = inner.children as AstNodeRec[]
				const notA: AstNodeRec = { id: `neg-${a.id || Math.random().toString(36).slice(2,7)}`, label: '¬', children: [a] as any }
				const notB: AstNodeRec = { id: `neg-${b.id || Math.random().toString(36).slice(2,7)}`, label: '¬', children: [b] as any }
				const childA = nodeFromAst(notA)
				const childB = nodeFromAst(notB)
				childA.children = [childB]
				target.children = [childA]
				target.decomposed = true
				return true
			}
			// ¬(A → B) -> A & ¬B (α) — chain
			if (isImplication(inner) && inner.children && (inner.children as any).length === 2) {
				const [a, b] = inner.children as AstNodeRec[]
				const notB: AstNodeRec = { id: `neg-${b.id || Math.random().toString(36).slice(2,7)}`, label: '¬', children: [b] as any }
				const childA = nodeFromAst(a)
				const childNotB = nodeFromAst(notB)
				childA.children = [childNotB]
				target.children = [childA]
				target.decomposed = true
				return true
			}
		}
		// Standard α/β and implication
		if (isAlpha(target.ast) || isBeta(target.ast) || isImplication(target.ast)) {
			const [a, b] = target.ast.children as AstNodeRec[]
			let left: AstNodeRec = a
			let right: AstNodeRec = b
			if (isImplication(target.ast)) {
				// P → Q expands to (¬P) | Q (β rule)
				left = { id: `neg-${a.id || Math.random().toString(36).slice(2,7)}`, label: '¬', children: [a] as any }
			}
			if (isAlpha(target.ast)) {
				// Chain for alpha so both end up on the same branch
				const childLeft = nodeFromAst(left)
				const childRight = nodeFromAst(right)
				childLeft.children = [childRight]
				target.children = [childLeft]
			} else {
				// Beta split
				target.children = [nodeFromAst(left), nodeFromAst(right)]
			}
			target.decomposed = true
			return true
		}
		return false
	}

	function walkAncestors(node: d3.HierarchyNode<TableauNode>): TableauNode[] {
		const out: TableauNode[] = []
		let p: d3.HierarchyNode<TableauNode> | null = node.parent
		while (p) { out.push(p.data); p = p.parent }
		return out
	}

	function detectClosureFor(hnode: d3.HierarchyNode<TableauNode>): boolean {
		const s = serialize(hnode.data.ast)
		if (!s) return false
		const comp = complementOf(s)
		const ancestorHit = walkAncestors(hnode).some(a => serialize(a.ast) === comp)
		if (ancestorHit) {
			hnode.data.type = 'closed'
			return true
		}
		return false
	}

	// Helper to find and update a node in the root data structure
	function markNodeAsClosed(nodeId: string, rootNode: TableauNode): boolean {
		if (rootNode.id === nodeId) {
			rootNode.type = 'closed'
			return true
		}
		if (rootNode.children) {
			for (const child of rootNode.children) {
				if (markNodeAsClosed(nodeId, child)) return true
			}
		}
		return false
	}

	// Auto operations with batching
	const [busy, setBusy] = React.useState<{ mode: 'expand' | 'close' | null; progress: number }>({ mode: null, progress: 0 })
	const [snack, setSnack] = React.useState<string | null>(null)

	// Optional: auto-expand once if user enabled STN simulation via persisted flag
	React.useEffect(() => {
		try {
			if (localStorage.getItem('xv_stn_sim') === '1') {
				setTimeout(() => autoExpand(), 0)
			}
		} catch {}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	function collectDecomposable(n: TableauNode, acc: TableauNode[]) {
		if (n.ast && (isAlpha(n.ast) || isBeta(n.ast) || isDoubleNeg(n.ast) || isImplication(n.ast)) && !n.decomposed) acc.push(n)
		n.children?.forEach(c => collectDecomposable(c, acc))
	}
	
	function collectDecomposableToDepth(n: TableauNode, acc: TableauNode[], maxDepth: number, currentDepth: number = 0) {
		if (currentDepth >= maxDepth) return
		if (n.ast && (isAlpha(n.ast) || isBeta(n.ast) || isDoubleNeg(n.ast) || isImplication(n.ast)) && !n.decomposed) acc.push(n)
		n.children?.forEach(c => collectDecomposableToDepth(c, acc, maxDepth, currentDepth + 1))
	}

	function collectLeaves(h: d3.HierarchyNode<TableauNode>, acc: d3.HierarchyNode<TableauNode>[]) {
		if (!h.children || h.children.length === 0) acc.push(h)
		else h.children.forEach(c => collectLeaves(c, acc))
	}

	// Step-by-step expansion
	const stepExpand = () => {
		if (!root) return
		const draft = cloneTableau(root)
		const batch: TableauNode[] = []
		collectDecomposable(draft, batch)
		
		if (batch.length === 0) {
			setSnack('No more decomposable nodes')
			return
		}
		
		// Expand only the first decomposable node
		if (expandBranch(batch[0])) {
			setRoot(cloneTableau(draft))
			setCurrentStep(prev => prev + 1)
			try { window.dispatchEvent(new CustomEvent('stn-request-refit')) } catch {}
		}
	}
	
	// Auto expand with depth limit
	const autoExpandToDepth = (targetDepth: number) => {
		if (!root) return
		const draft = cloneTableau(root)
		setBusy({ mode: 'expand', progress: 5 })
		let expandedAny = false
		let iteration = 0
		
		const step = () => {
			const batch: TableauNode[] = []
			collectDecomposableToDepth(draft, batch, targetDepth)
			
			if (batch.length === 0) {
				setRoot(cloneTableau(draft))
				setBusy({ mode: null, progress: 0 })
				setSnack(expandedAny ? `Auto Expand to depth ${targetDepth} completed` : 'No decomposable nodes at target depth')
				if (expandedAny) { try { window.dispatchEvent(new CustomEvent('stn-request-refit')) } catch {} }
				return
			}
			batch.slice(0, 100).forEach(n => { if (expandBranch(n)) expandedAny = true })
			setRoot(cloneTableau(draft))
			setBusy(prev => ({ mode: 'expand', progress: Math.min(95, (prev.progress || 5) + 10) }))
			try { window.dispatchEvent(new CustomEvent('stn-request-refit')) } catch {}
			iteration += 1
			requestAnimationFrame(step)
		}
		requestAnimationFrame(step)
	}
	
	function autoExpand() {
		if (stepMode) {
			autoExpandToDepth(maxDepth)
		} else {
			// Original unlimited expansion
			if (!root) return
			const draft = cloneTableau(root)
			setBusy({ mode: 'expand', progress: 5 })
			let expandedAny = false
			let iteration = 0
			const step = () => {
				const batch: TableauNode[] = []
				collectDecomposable(draft, batch)
				
				if (batch.length === 0) {
					setRoot(cloneTableau(draft))
					setBusy({ mode: null, progress: 0 })
					setSnack(expandedAny ? 'Auto Expand completed' : 'No decomposable nodes')
					if (expandedAny) { try { window.dispatchEvent(new CustomEvent('stn-request-refit')) } catch {} }
					return
				}
				batch.slice(0, 100).forEach(n => { if (expandBranch(n)) expandedAny = true })
				setRoot(cloneTableau(draft))
				setBusy(prev => ({ mode: 'expand', progress: Math.min(95, (prev.progress || 5) + 10) }))
				try { window.dispatchEvent(new CustomEvent('stn-request-refit')) } catch {}
				iteration += 1
				requestAnimationFrame(step)
			}
			requestAnimationFrame(step)
		}
	}

	function autoClose() {
		if (!root) return
		const draft = cloneTableau(root)
		setBusy({ mode: 'close', progress: 5 })
		let anyClosed = false
		const h = d3.hierarchy<TableauNode>(draft)
		const leaves: d3.HierarchyNode<TableauNode>[] = []
		collectLeaves(h, leaves)
		let index = 0
		
		const step = () => {
			const end = Math.min(index + 100, leaves.length)
			let closedThisBatch = false
			for (let i = index; i < end; i++) {
				if (detectClosureFor(leaves[i])) { anyClosed = true; closedThisBatch = true }
			}
			index = end
			setRoot(cloneTableau(draft))
			const progress = leaves.length === 0 ? 100 : Math.max(10, Math.floor((index / leaves.length) * 100))
			setBusy({ mode: 'close', progress })
			if (closedThisBatch) {
				
				try { window.dispatchEvent(new CustomEvent('stn-request-refit')) } catch {}
			} else { }
			if (index < leaves.length) {
				requestAnimationFrame(step)
			} else {
				setBusy({ mode: null, progress: 0 })
				setSnack(anyClosed ? 'Branches closed' : 'No contradictions found')
				if (anyClosed) { try { window.dispatchEvent(new CustomEvent('stn-request-refit')) } catch {} }
			}
		}
		requestAnimationFrame(step)
	}

	// Listen for external refit requests (e.g., after auto ops)
	React.useEffect(() => {
		function onRefit() {
			const svg = d3.select(svgRef.current)
			const zoomRootSel = svg.select<SVGGElement>('g.zoom-root')
			const contentSel = svg.select<SVGGElement>('g.content')
			if (zoomRootSel.empty() || contentSel.empty()) return
			const doRefit = (attempt: number) => {
				const nodeSel = contentSel.selectAll<SVGGElement, any>('g.node')
				const nodes = nodeSel.nodes()
				
				if (nodes.length < 2 && attempt < 8) {
					return requestAnimationFrame(() => doRefit(attempt + 1))
				}
				if (!nodes.length) return
				// compute using the content group's bbox for accuracy
				let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
				nodeSel.each(function(d: any){
					if (d && typeof d.x === 'number' && typeof d.y === 'number') {
						const r = d.depth === 0 ? 16 : 12
						const top = d.y - 18
						const bottom = d.y + (d.children && d.children.length > 0 ? 22 : 26)
						minX = Math.min(minX, d.x - r)
						maxX = Math.max(maxX, d.x + r)
						minY = Math.min(minY, top)
						maxY = Math.max(maxY, bottom)
					} else {
						const bb = (this as SVGGElement).getBBox()
						minX = Math.min(minX, bb.x); minY = Math.min(minY, bb.y); maxX = Math.max(maxX, bb.x + bb.width); maxY = Math.max(maxY, bb.y + bb.height)
					}
				})
				if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return
				const width = Math.max(1, maxX - minX)
				const height = Math.max(1, maxY - minY)
				const pad = 60
				const k0 = Math.min(size.width / (width + pad), size.height / (height + pad))
				const k = Math.min(1, k0)
				const cx = minX + width / 2
				const cy = minY + height / 2
				const tx = (size.width / 2) - cx * k
				const ty = (size.height / 2) - cy * k
				// Skip if current transform is already close (tolerance 2px)
				const current = d3.zoomTransform(svg.node() as any)
				if (Math.abs((current.x ?? 0) - tx) < 2 && Math.abs((current.y ?? 0) - ty) < 2 && Math.abs((current.k ?? 1) - k) < 0.001) {
					
					return
				}
				
				const zoomBehavior = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.4, 4])
				svg.call(zoomBehavior as any)
				svg.call(zoomBehavior.transform as any, d3.zoomIdentity.translate(tx, ty).scale(k))
			}
			doRefit(0)
		}
		window.addEventListener('stn-request-refit', onRefit)
		return () => window.removeEventListener('stn-request-refit', onRefit)
	}, [size.width, size.height])

	// Render the tableau using d3.tree()
	React.useEffect(() => {
		const svg = d3.select(svgRef.current)
		svg.selectAll('*').remove()
		
		// AI theme visual enhancements
		const defs = svg.append('defs')
		
		// Glow filter for nodes
		const glowFilter = defs.append('filter')
			.attr('id', 'glow')
			.attr('x', '-50%')
			.attr('y', '-50%')
			.attr('width', '200%')
			.attr('height', '200%')
		
		glowFilter.append('feGaussianBlur')
			.attr('stdDeviation', '3')
			.attr('result', 'coloredBlur')
		
		const feMerge = glowFilter.append('feMerge')
		feMerge.append('feMergeNode').attr('in', 'coloredBlur')
		feMerge.append('feMergeNode').attr('in', 'SourceGraphic')
		
		// AI theme gradients
		const nodeGradient = defs.append('radialGradient')
			.attr('id', 'nodeGradient')
			.attr('cx', '30%')
			.attr('cy', '30%')
		nodeGradient.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(64,196,255,0.8)')
		nodeGradient.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(64,196,255,0.3)')
		
		const selectedGradient = defs.append('radialGradient')
			.attr('id', 'selectedGradient')
			.attr('cx', '30%')
			.attr('cy', '30%')
		selectedGradient.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(255,193,7,0.9)')
		selectedGradient.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(255,193,7,0.4)')
		
		const closedGradient = defs.append('radialGradient')
			.attr('id', 'closedGradient')
			.attr('cx', '30%')
			.attr('cy', '30%')
		closedGradient.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(255,82,82,0.8)')
		closedGradient.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(255,82,82,0.3)')
		
		// Only reset initial fit when expression/AST actually changes, not on internal state updates
		const prevExpr = prevExpressionRef.current
		const prevAst = prevAstIdRef.current
		const astId = ast?.id || null
		if (expression !== prevExpr || astId !== prevAst) {
			initialFitDoneRef.current = false
			prevExpressionRef.current = expression
			prevAstIdRef.current = astId
			
		}
		// Track size separately (rare resizes)
		const prevSize = prevSizeRef.current
		if (!prevSize || Math.abs(prevSize.width - size.width) > 20 || Math.abs(prevSize.height - size.height) > 20) {
			prevSizeRef.current = { ...size }
		}

		if (!root) {
			// Empty state
			svg
				.append('text')
				.attr('x', size.width / 2)
				.attr('y', size.height / 2)
				.attr('text-anchor', 'middle')
				.attr('fill', 'rgba(255,255,255,0.6)')
				.text('Enter a logical expression to render a Semantic Tableau')
			return
		}

		const hroot = d3.hierarchy<TableauNode>(root)
		// compute depth/height to support rendering even without children yet
		hroot.each((d:any)=>{ d.height = d.children ? d.children.length : 0 })
		
		// Different layouts based on mode
		let treeLayout: d3.TreeLayout<TableauNode>
		if (layoutMode === 'hierarchy') {
			// Hierarchy mode: More compact, emphasizes levels, horizontal layout
			treeLayout = d3.tree<TableauNode>()
				.nodeSize([50, 150]) // Wider horizontal spacing
				.separation((a, b) => (a.parent === b.parent ? 0.7 : 1.2))
		} else {
			// Tree mode: More spaced out, emphasizes individual nodes, vertical layout
			treeLayout = d3.tree<TableauNode>()
				.nodeSize([28, 110]) // Original spacing
				.separation((a, b) => (a.parent === b.parent ? 1 : 1.8))
		}
		
		const tree = treeLayout(hroot)

		const thisEpoch = ++renderEpochRef.current
		

		// Zoomable container (preserve existing transform if any)
		const previousTransform = d3.zoomTransform(svg.node() as any)
		
		const zoomRoot = svg.append('g').attr('class', 'zoom-root')
		const g = zoomRoot
			.append('g')
			.attr('class', 'content')
			.attr('transform', null as any)

		// Zoom/pan behavior
		const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.4, 4])
			.on('zoom', (event) => {
				zoomRoot.attr('transform', event.transform.toString())
			})
		svg.call(zoomBehavior as any)
		// apply previous transform so view does not jump on rerender
		zoomRoot.attr('transform', previousTransform.toString())
		svg.call(zoomBehavior.transform as any, previousTransform)

		// Links (branches) - highlight path to selected node
		g.selectAll('path.link')
			.data(tree.links())
			.enter()
			.append('path')
			.attr('class', 'link')
			.attr('fill', 'none')
			.attr('stroke', (d: any) => {
				const sourceInPath = pathToRoot.includes(d.source.data.id)
				const targetInPath = pathToRoot.includes(d.target.data.id)
				return (sourceInPath && targetInPath) ? 'rgba(255,193,7,0.8)' : 'rgba(255,255,255,0.3)'
			})
			.attr('stroke-width', (d: any) => {
				const sourceInPath = pathToRoot.includes(d.source.data.id)
				const targetInPath = pathToRoot.includes(d.target.data.id)
				return (sourceInPath && targetInPath) ? 2.5 : 1.5
			})
			.attr('d', (d: any) => {
				if (layoutMode === 'hierarchy') {
					// Hierarchy mode: Straight lines for cleaner look
					return `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`
				} else {
					// Tree mode: Curved lines for organic feel
					return `M${d.source.x},${d.source.y} C ${d.source.x},${(d.source.y + d.target.y) / 2} ${d.target.x},${(d.source.y + d.target.y) / 2} ${d.target.x},${d.target.y}`
				}
			})

		// Nodes
		const node = g
			.selectAll('g.node')
			.data(tree.descendants())
			.enter()
			.append('g')
			.attr('class', 'node')
			.attr('transform', (d: any) => `translate(${d.x}, ${d.y})`)

		// Helper: extents from data positions; fallback to DOM bbox
		function computeDataExtentsFromTree() {
			const desc = tree.descendants() as any[]
			let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
			desc.forEach(d => {
				const r = d.depth === 0 ? 16 : 12
				const top = d.y - 18
				const bottom = d.y + (d.children && d.children.length > 0 ? 22 : 26)
				minX = Math.min(minX, d.x - r)
				maxX = Math.max(maxX, d.x + r)
				minY = Math.min(minY, top)
				maxY = Math.max(maxY, bottom)
			})
			return { minX, minY, maxX, maxY }
		}

		node
			.append('circle')
			.attr('r', (d: any) => {
				if (layoutMode === 'hierarchy') {
					// Hierarchy mode: Smaller, more uniform nodes
					return d.depth === 0 ? 14 : 10
				} else {
					// Tree mode: Larger, more prominent nodes
					return d.depth === 0 ? 16 : 12
				}
			})
			.attr('fill', (d: any) => {
				const t = d.data.type
				const isSelected = d.data.id === selectedNodeId
				const isInPath = pathToRoot.includes(d.data.id)
				
				if (isSelected) return 'url(#selectedGradient)'
				if (isInPath) return 'rgba(255,193,7,0.3)'
				if (t === 'root') return 'url(#nodeGradient)'
				if (t === 'closed') return 'url(#closedGradient)'
				if (t === 'open') return 'rgba(76,175,80,0.35)'
				return 'rgba(255,255,255,0.18)'
			})
			.attr('filter', (d: any) => {
				const isSelected = d.data.id === selectedNodeId
				const isInPath = pathToRoot.includes(d.data.id)
				return (isSelected || isInPath) ? 'url(#glow)' : null
			})
			.attr('stroke', (d: any) => {
				const isSelected = d.data.id === selectedNodeId
				const isInPath = pathToRoot.includes(d.data.id)
				
				if (isSelected) return '#ffc107'
				if (isInPath) return 'rgba(255,193,7,0.7)'
				return 'rgba(255,255,255,0.45)'
			})
			.attr('stroke-width', (d: any) => {
				const isSelected = d.data.id === selectedNodeId
				const isInPath = pathToRoot.includes(d.data.id)
				
				if (isSelected) return 3
				if (isInPath) return 2
				return d.depth === 0 ? 2 : 1
			})
			.style('cursor', 'pointer')
			.on('click', (event: any, d: any) => {
				event.stopPropagation()
				setSelectedNodeId(d.data.id === selectedNodeId ? null : d.data.id)
			})

		node
			.append('text')
			.attr('y', -18)
			.attr('text-anchor', 'middle')
			.attr('fill', 'rgba(255,255,255,0.85)')
			.attr('font-size', (d: any) => {
				if (layoutMode === 'hierarchy') {
					// Hierarchy mode: Smaller, more compact text
					return d.depth === 0 ? 10 : 9
				} else {
					// Tree mode: Larger, more readable text
					return d.depth === 0 ? 12 : 11
				}
			})
			.text((d: any) => d.data.label)

		node
			.append('text')
			.attr('y', (d: any) => {
				const isLeaf = !d.children || d.children.length === 0
				return isLeaf ? 26 : 22
			})
			.attr('text-anchor', 'middle')
			.attr('fill', 'rgba(255,255,255,0.45)')
			.attr('font-size', 9)
			.text((d: any) => (d.depth === 0 ? '' : d.data.type))

		// Rule badges for decomposable nodes
		const ruleBadges = node.filter((d: any) => !!getRuleBadge(d.data))
		ruleBadges
			.append('circle')
			.attr('cx', (d: any) => (d.depth === 0 ? 12 : 9))
			.attr('cy', (d: any) => (d.depth === 0 ? -12 : -9))
			.attr('r', 8)
			.attr('fill', (d: any) => getRuleBadge(d.data)?.color || '#666')
			.attr('stroke', 'rgba(255,255,255,0.8)')
			.attr('stroke-width', 1)
		
		ruleBadges
			.append('text')
			.attr('x', (d: any) => (d.depth === 0 ? 12 : 9))
			.attr('y', (d: any) => (d.depth === 0 ? -8 : -5))
			.attr('text-anchor', 'middle')
			.attr('fill', 'white')
			.attr('font-size', 10)
			.attr('font-weight', 'bold')
			.text((d: any) => getRuleBadge(d.data)?.text || '')
			.append('title')
			.text((d: any) => getRuleBadge(d.data)?.tooltip || '')

		// Node menu replaces per-node D/X controls; actions are accessible via the panel

		// Initial fit to contents after first render only (prevents flicker during auto ops)
		if (!initialFitDoneRef.current) {
			const fitWithRetries = (attempt: number) => {
				try {
					if (thisEpoch !== renderEpochRef.current) { return }
					const nodes = g.selectAll<SVGGElement, any>('g.node').nodes()
					if (!nodes.length) {
						
						if (attempt < 10) return requestAnimationFrame(() => fitWithRetries(attempt + 1))
						return
					}
					const { minX, minY, maxX, maxY } = computeDataExtentsFromTree()
					if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY) || maxX - minX === 0 || maxY - minY === 0) {
						
						if (attempt < 10) return requestAnimationFrame(() => fitWithRetries(attempt + 1))
						return
					}
					const width = Math.max(1, maxX - minX)
					const height = Math.max(1, maxY - minY)
					const pad = 60
					const k0 = Math.min(size.width / (width + pad), size.height / (height + pad))
					const k = Math.min(1, k0)
					const cx = minX + width / 2
					const cy = minY + height / 2
					const tx = (size.width / 2) - cx * k
					const ty = (size.height / 2) - cy * k
					
					svg.call(zoomBehavior.transform as any, d3.zoomIdentity.translate(tx, ty).scale(k))
					initialFitDoneRef.current = true
				} catch (e) {
					
					if (attempt < 10) return requestAnimationFrame(() => fitWithRetries(attempt + 1))
				}
			}
			requestAnimationFrame(() => fitWithRetries(0))
		}

		// Compact node menu: trigger + panel with D/X + facet icons
		const menuTrigger = node.append('g').attr('class', 'node-menu-trigger').style('cursor', 'pointer')
		menuTrigger.append('circle').attr('r', 3).attr('fill', '#40c4ff').attr('stroke', '#2aa4f4').append('title').text('Open node menu')
		// Dock trigger to top-left corner with minimal padding
		menuTrigger.attr('transform', (d: any) => { const r = d.depth === 0 ? 16 : 12; return `translate(${-r}, ${-r})` })

		const panel = node.append('g').attr('class', 'node-menu-panel').style('display', 'none')
		// Panel near top-left corner, close to node
		panel.attr('transform', (d: any) => { const r = d.depth === 0 ? 16 : 12; return `translate(${-r - 104}, ${-r - 6})` })
		panel.append('rect').attr('width', 110).attr('height', 24).attr('rx', 6).attr('fill', 'rgba(25,25,35,0.95)').attr('stroke', 'rgba(64,196,255,0.4)')

		const pDecomp = panel.append('g').datum((d:any)=>d).attr('transform', 'translate(6,6)').style('cursor','pointer')
		pDecomp.append('rect').attr('width', 14).attr('height', 12).attr('rx', 3).attr('fill', 'rgba(64,196,255,0.18)').attr('stroke', '#40c4ff')
		pDecomp.append('text').attr('x', 7).attr('y', 9).attr('text-anchor', 'middle').attr('font-size', 8).attr('fill', '#40c4ff').text('D')
		pDecomp.append('title').text('Decompose (apply α/β)')
		pDecomp.on('click', (event: any, d: any) => { event.stopPropagation(); const h = d as d3.HierarchyNode<TableauNode>; expandBranch(h.data); setRoot(prev => (prev ? cloneTableau(prev) : prev)) })

		const pClose = panel.append('g').datum((d:any)=>d).attr('transform', 'translate(24,6)').style('cursor','pointer')
		pClose.append('rect').attr('width', 14).attr('height', 12).attr('rx', 3).attr('fill', 'rgba(255,82,82,0.18)').attr('stroke', '#ff5252')
		pClose.append('text').attr('x', 7).attr('y', 9).attr('text-anchor', 'middle').attr('font-size', 8).attr('fill', '#ff8a80').text('X')
		pClose.append('title').text('Close Branch (mark as contradictory/closed - turns node red)')
		pClose.on('click', (event: any, d: any) => { 
			event.stopPropagation(); 
			const h = d as d3.HierarchyNode<TableauNode>; 
			
			// Try to detect logical contradiction first
			const shouldClose = detectClosureFor(h)
			if (shouldClose) {
				// Update the root data structure and trigger re-render
				setRoot(prev => {
					if (!prev) return prev
					const newRoot = cloneTableau(prev)
					markNodeAsClosed(h.data.id, newRoot)
					return newRoot
				})
			} else {
				// If no contradiction found, allow manual closure anyway (for testing/manual tableau construction)
				setRoot(prev => {
					if (!prev) return prev
					const newRoot = cloneTableau(prev)
					markNodeAsClosed(h.data.id, newRoot)
					return newRoot
				})
			}
		})

		const facetHost = panel.append('g').attr('transform', 'translate(46,4) scale(0.75)')
		createFacetIcons(facetHost as any, (type, _opts, d: any) => {
			setSelectedNodeForDialog(d)
			if (type === 'venn') setVennOpen(true)
			if (type === 'truth') setTruthOpen(true)
			if (type === 'timeline') setTimelineOpen(true)
			if (type === 'counter') setCounterOpen(true)
		})

		menuTrigger.on('click', function(event){
			event.stopPropagation()
			const group = d3.select(this.parentNode as SVGGElement)
			const pnl = group.select<SVGGElement>('.node-menu-panel')
			const current = pnl.style('display')
			// hide all other panels
			svg.selectAll('.node-menu-panel').filter(function(this: any){ return this !== pnl.node() }).style('display','none')
			// toggle this one
			const nextVis = current === 'none' ? 'inline' : 'none'
			pnl.style('display', nextVis)
			if (nextVis === 'inline') {
				// bring the active node (and its panel) to the front so it overlays others
				(group.node() as any)?.parentNode && group.raise()
				pnl.raise()
			}
		})
		svg.on('click', () => { 
			svg.selectAll('.node-menu-panel').style('display', 'none')
			setSelectedNodeId(null) // Clear selection when clicking empty canvas
		})
	}, [root, size.width, size.height, layoutMode, expression, selectedNodeId, pathToRoot])

	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }} ref={containerRef}>
			<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5 }}>
				<Tooltip title="Tree: Spaced layout with curved links, larger nodes. Hierarchy: Compact layout with straight links, smaller nodes.">
					<ToggleButtonGroup
						value={layoutMode}
						exclusive
						onChange={(_, v) => v && setLayoutMode(v)}
						size="small"
						color="primary"
					>
						<ToggleButton value="tree">Tree</ToggleButton>
						<ToggleButton value="hierarchy">Hierarchy</ToggleButton>
					</ToggleButtonGroup>
				</Tooltip>
				
				<FormControl size="small" sx={{ minWidth: 120 }}>
					<InputLabel>Logic Mode</InputLabel>
					<Select
						value={logicMode}
						label="Logic Mode"
						onChange={(e) => setLogicMode(e.target.value as LogicMode)}
					>
						<MenuItem value="classical">Classical</MenuItem>
						<MenuItem value="epistemic">Epistemic</MenuItem>
						<MenuItem value="deontic">Deontic</MenuItem>
						<MenuItem value="temporal">Temporal</MenuItem>
						<MenuItem value="informal">Informal</MenuItem>
						<MenuItem value="paraconsistent">Paraconsistent</MenuItem>
						<MenuItem value="fuzzy">Fuzzy</MenuItem>
					</Select>
				</FormControl>
				
				<Chip 
					label={logicMode} 
					size="small" 
					color="primary" 
					variant="outlined"
				/>
				
				<span style={{ fontSize: 12, opacity: 0.7 }}>Semantic Tableau • {expression || '—'}</span>
				
				<Tooltip title="Keyboard Shortcuts: D (decompose), X (close), A (auto expand), C (auto close), Ctrl+E (export)">
					<Chip label="⌨️" size="small" variant="outlined" />
				</Tooltip>
				
				{/* Proof Status */}
				<Tooltip title={
					proofStatus.errors.length > 0 
						? `Errors: ${proofStatus.errors.join(', ')}`
						: `Open: ${proofStatus.openBranches}, Closed: ${proofStatus.closedBranches}`
				}>
					<Chip 
						label={
							proofStatus.isComplete 
								? "✓ Complete" 
								: proofStatus.isValid 
									? `${proofStatus.openBranches}/${proofStatus.openBranches + proofStatus.closedBranches} Open`
									: "⚠ Invalid"
						}
						size="small" 
						color={
							proofStatus.isComplete 
								? "success" 
								: proofStatus.isValid 
									? "info" 
									: "error"
						}
						variant="outlined"
					/>
				</Tooltip>
			</Box>
			<Box sx={{ flex: 1, position: 'relative' }}>
				<svg ref={svgRef} width={size.width} height={size.height} />
			</Box>

			{/* Top-level auto operations and progress */}
			<Box sx={{ position: 'absolute', top: 40, right: 12, display: 'flex', gap: 1, flexDirection: 'column' }}>
				<Box sx={{ display: 'flex', gap: 1 }}>
					<Button size="small" variant="outlined" color="secondary" onClick={autoExpand} disabled={!!busy.mode}>
						{stepMode ? `Auto Expand (Depth ${maxDepth})` : 'Auto Expand'}
					</Button>
					<Button size="small" variant="outlined" color="secondary" onClick={autoClose} disabled={!!busy.mode}>Auto Close</Button>
				</Box>
				
				{stepMode && (
					<Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
						<Button size="small" variant="outlined" color="info" onClick={stepExpand} disabled={!!busy.mode}>
							Step ({currentStep})
						</Button>
						<Box sx={{ minWidth: 100 }}>
							<Typography variant="caption" sx={{ fontSize: 10 }}>Depth: {maxDepth}</Typography>
							<Slider
								size="small"
								value={maxDepth}
								onChange={(_, value) => setMaxDepth(value as number)}
								min={1}
								max={10}
								step={1}
								valueLabelDisplay="auto"
							/>
						</Box>
					</Box>
				)}
				
				<Box sx={{ display: 'flex', gap: 1 }}>
					<FormControlLabel
						control={
							<Switch
								size="small"
								checked={stepMode}
								onChange={(e) => {
									setStepMode(e.target.checked)
									setCurrentStep(0)
								}}
							/>
						}
						label={<Typography variant="caption">Step Mode</Typography>}
					/>
				</Box>
				
				<Box sx={{ display: 'flex', gap: 1 }}>
					<Button size="small" variant="outlined" color="primary" onClick={exportTableau}>Export</Button>
					<Button size="small" variant="outlined" color="primary" component="label">
						Import
						<input type="file" accept=".json" onChange={importTableau} style={{ display: 'none' }} />
					</Button>
				</Box>
				{selectedNodeId && (
					<Box sx={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
						Selected: {(() => {
							if (!root) return 'Node'
							const findNodeById = (node: TableauNode): TableauNode | null => {
								if (node.id === selectedNodeId) return node
								if (node.children) {
									for (const child of node.children) {
										const found = findNodeById(child)
										if (found) return found
									}
								}
								return null
							}
							const selectedNode = findNodeById(root)
							return selectedNode?.label || 'Node'
						})()}
						{pathToRoot.length > 1 && ` (Path: ${pathToRoot.length - 1} steps)`}
					</Box>
				)}
			</Box>
			{busy.mode && (
				<Box sx={{ position: 'absolute', top: 8, left: 0, right: 0, px: 4 }}>
					<LinearProgress variant="determinate" value={busy.progress} />
				</Box>
			)}

			<Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
				<Alert severity="info" variant="filled">{snack}</Alert>
			</Snackbar>

			{/* Enhanced facet dialogs (reused) */}
			{selectedNodeForDialog && (
				<>
					<VennDiagramDialog
						open={vennOpen}
						onClose={() => setVennOpen(false)}
						expression={expression}
						nodeId={selectedNodeForDialog?.data?.id || selectedNodeForDialog?.id || 'node'}
						// lightweight demo data for relevance testing
						data={{
							sets: [
								{ label: 'A', items: ['a1'], color: '#20B2AA' },
								{ label: 'B', items: ['b1'], color: '#9370DB' }
							],
							intersection: []
						}}
						examples={[{ id: 'ex1', title: 'Example', necessary: 'A', sufficient: 'B' }]}
					/>
					<TruthTableDialog
						open={truthOpen}
						onClose={() => setTruthOpen(false)}
						expression={expression}
						nodeId={selectedNodeForDialog?.data?.id || selectedNodeForDialog?.id || 'node'}
						ast={ast ?? { id: 'fallback', label: 'P', children: [] } as any}
					/>
					<TimelineDialog
						open={timelineOpen}
						onClose={() => setTimelineOpen(false)}
						expression={expression}
						nodeId={selectedNodeForDialog?.data?.id || selectedNodeForDialog?.id || 'node'}
					/>
					<CounterargumentsDialog
						open={counterOpen}
						onClose={() => setCounterOpen(false)}
						expression={expression}
						nodeId={selectedNodeForDialog?.data?.id || selectedNodeForDialog?.id || 'node'}
					/>
				</>
			)}
		</Box>
	)
}

export default SemanticTableau


