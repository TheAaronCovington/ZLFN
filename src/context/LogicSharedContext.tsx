import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react'
import type { AstNodeRec } from '../services/logic'
import { parseExpressionToAst, astToZlfnGraph } from '../services/logic'
import type { ZlfnNode, ZlfnEdge } from '../components/Visualizations/ZlfnGraph/types'
import type { ArgumentData } from '../components/Visualizations/ArgumentTableau/types'
import { extractArgumentsFromMarkdown, updateArgumentFromMarkdown } from '../services/markdownToArgument'
import { normalizeExpression, normalizeDocument, type ImportedJSON, normalizeImportedJSON } from '../services/argumentNormalizer'

export type NodeIdToActive = Record<string, boolean>
export type LogicMode = 'classical' | 'epistemic' | 'deontic' | 'temporal' | 'informal' | 'paraconsistent' | 'fuzzy'
export type NodeState = { value: 'T' | 'F' | 'B' | number; weight?: number }

// Unified Data Model Types
export type Note = {
  id: string
  text: string
  createdAt: string
  updatedAt?: string
  author?: string
}

export type SharedArgument = {
  id: string
  title: string
  // Bundled markdown document
  markdown: { documentId: string; content: string }
  // Canonical expression(s) for the argument
  expressions: string[]
  // Lazy-derived representations (computed on demand)
  ast?: AstNodeRec
  zlfnGraph?: { nodes: ZlfnNode[]; edges: ZlfnEdge[] }
  atn?: ArgumentData
  // Optional cross-reference map (nodeId -> markdownRef)
  refs?: Record<string, string>
  // Per-node notes
  notes?: Record<string, Note[]>
}

export type UnifiedData = {
  activeSource: 'document' | 'expression' | 'imported'
  arguments: SharedArgument[]
  selectedArgumentId: string | null
}

type LogicSharedContextValue = {
	simulationMode: boolean
	setSimulationMode: (next: boolean) => void
	nodeIdToActive: NodeIdToActive
	setNodeIdToActive: React.Dispatch<React.SetStateAction<NodeIdToActive>>
	resetStates: () => void
    selectedNodeId: string | null
    setSelectedNodeId: (id: string | null) => void
	currentExpression: string
	setCurrentExpression: (expr: string) => void
	expressionHighlightNonce: number
	bumpExpressionHighlight: () => void
	modes: Partial<Record<LogicMode, boolean>>
	setModes: React.Dispatch<React.SetStateAction<Partial<Record<LogicMode, boolean>>>>
	nodeStates: Record<string, NodeState>
	setNodeStates: React.Dispatch<React.SetStateAction<Record<string, NodeState>>>
	
	// Unified Data Model
	unifiedData: UnifiedData
	setUnifiedData: React.Dispatch<React.SetStateAction<UnifiedData>>
	setSelectedArgumentId: (id: string | null) => void
	
	// Lazy accessors for view data
	getAstFor: (argumentId: string | null) => AstNodeRec | null
	getZlfnGraphFor: (argumentId: string | null) => { nodes: ZlfnNode[]; edges: ZlfnEdge[] } | null
	getAtnDataFor: (argumentId: string | null) => ArgumentData | null
	
	// Markdown document management
	loadMarkdownDocument: (documentId: string, content: string, title?: string) => void
	updateMarkdownDocument: (documentId: string, content: string) => void
	removeDocument: (documentId: string) => void
	setActiveSource: (source: 'document' | 'expression' | 'imported') => void

	// Normalization helpers
	addExpressionArgument: (expression: string, title?: string) => string
	addImportedJSONArguments: (json: ImportedJSON, selectFirst?: boolean) => string | null
}

const LogicSharedContext = createContext<LogicSharedContextValue | null>(null)

export const LogicSharedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [simulationMode, setSimulationMode] = useState<boolean>(false)
	const [nodeIdToActive, setNodeIdToActive] = useState<NodeIdToActive>({})
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
	const [currentExpression, setCurrentExpression] = useState<string>('(A ∧ B) → C')
	const [expressionHighlightNonce, setExpressionHighlightNonce] = useState<number>(0)
	const [modes, setModes] = useState<Partial<Record<LogicMode, boolean>>>({ classical: true })
	const [nodeStates, setNodeStates] = useState<Record<string, NodeState>>({})

	// Initialize unified data with default expression-based argument and URL param support
	const [unifiedData, setUnifiedData] = useState<UnifiedData>(() => {
		let savedSelectedArgumentId = localStorage.getItem('xv_selected_argument_id')
		try {
			const url = new URL(window.location.href)
			const argParam = url.searchParams.get('arg')
			if (argParam) savedSelectedArgumentId = argParam
		} catch (error) {
			console.warn('Failed to read URL parameters:', error)
		}
		const savedActiveSource = localStorage.getItem('xv_active_source') as 'document' | 'expression' | 'imported' || 'expression'
		
		return {
			activeSource: savedActiveSource,
			arguments: [{
				id: 'default-expression',
				title: 'Default Expression',
				markdown: { documentId: 'default', content: '' },
				expressions: ['(A ∧ B) → C']
			}],
			selectedArgumentId: savedSelectedArgumentId || 'default-expression'
		}
	})

	const resetStates = useCallback(() => {
        setNodeIdToActive({})
        setSelectedNodeId(null)
		setNodeStates({})
    }, [])

	const bumpExpressionHighlight = useCallback(() => {
		setExpressionHighlightNonce(n => n + 1)
	}, [])

	// Unified argument selection with persistence
	const setSelectedArgumentId = useCallback((id: string | null) => {
		setUnifiedData(prev => ({ ...prev, selectedArgumentId: id }))
		if (id) {
			localStorage.setItem('xv_selected_argument_id', id)
			// update URL param
			try {
				const url = new URL(window.location.href)
				url.searchParams.set('arg', id)
				window.history.replaceState({}, '', url.toString())
			} catch (error) {
				console.warn('Failed to update URL parameters:', error)
			}
		} else {
			localStorage.removeItem('xv_selected_argument_id')
			try {
				const url = new URL(window.location.href)
				url.searchParams.delete('arg')
				window.history.replaceState({}, '', url.toString())
			} catch (error) {
				console.warn('Failed to update URL parameters:', error)
			}
		}
	}, [])

	// Lazy accessors with memoization
	const getAstFor = useCallback((argumentId: string | null): AstNodeRec | null => {
		if (!argumentId) return null
		const argument = unifiedData.arguments.find(arg => arg.id === argumentId)
		if (!argument) return null
		
		// Return cached AST or compute from first expression
		if (argument.ast) return argument.ast
		if (argument.expressions.length === 0) return null
		
		const ast = parseExpressionToAst(argument.expressions[0])
		// Cache the result (mutate for performance)
		if (ast) argument.ast = ast
		return ast
	}, [unifiedData.arguments])

	const getZlfnGraphFor = useCallback((argumentId: string | null): { nodes: ZlfnNode[]; edges: ZlfnEdge[] } | null => {
		if (!argumentId) return null
		const argument = unifiedData.arguments.find(arg => arg.id === argumentId)
		if (!argument) return null
		
		// Return cached graph or compute from AST
		if (argument.zlfnGraph) return argument.zlfnGraph
		
		const ast = getAstFor(argumentId)
		if (!ast) return null
		
		const graph = astToZlfnGraph(ast)
		// Cache the result (with type assertion for compatibility)
		if (graph) argument.zlfnGraph = graph as { nodes: ZlfnNode[]; edges: ZlfnEdge[] }
		return graph as { nodes: ZlfnNode[]; edges: ZlfnEdge[] } | null
	}, [unifiedData.arguments, getAstFor])

	const getAtnDataFor = useCallback((argumentId: string | null): ArgumentData | null => {
		if (!argumentId) return null
		const argument = unifiedData.arguments.find(arg => arg.id === argumentId)
		if (!argument) return null
		
		// Return cached ATN data or compute from graph
		if (argument.atn) return argument.atn
		
		const graph = getZlfnGraphFor(argumentId)
		if (!graph) return null
		
		// Convert ZLFN graph to ATN data (simplified conversion for now)
		const atnData: ArgumentData = {
			id: argumentId,
			name: `Argument ${argumentId}`,
			core: {
				id: `${argumentId}-core`,
				argumentType: 'claim',
				argumentId: argumentId,
				scheme: 'Default'
			} as ArgumentData['core'],
			components: [],
			relationships: [],
			layoutMode: 'tree' as const
		}
		
		// Cache the result
		argument.atn = atnData
		return atnData
	}, [unifiedData.arguments, getZlfnGraphFor])

	// Persist active source changes
	useEffect(() => {
		localStorage.setItem('xv_active_source', unifiedData.activeSource)
	}, [unifiedData.activeSource])

    // (moved below after addImportedJSONArguments initialization)

	// Markdown document management methods - aligned with parseDocumentToGraph via normalizeDocument
	const loadMarkdownDocument = useCallback(async (documentId: string, content: string, title?: string) => {
		try {
			// Use normalizeDocument to align with parseDocumentToGraph workflow
			const normalizedArguments = await normalizeDocument(documentId, content)
			
			setUnifiedData(prev => {
				// Remove existing arguments from this document
				const filteredArguments = prev.arguments.filter(arg => 
					!arg.markdown.documentId || arg.markdown.documentId !== documentId
				)
				
				// Add new arguments from the document
				const newArguments = [...filteredArguments, ...normalizedArguments]
				
				// Select the first document argument if none selected or if current selection was from this document
				let newSelectedId = prev.selectedArgumentId
				if (!newSelectedId || prev.arguments.find(arg => arg.id === newSelectedId)?.markdown.documentId === documentId) {
					newSelectedId = normalizedArguments.length > 0 ? normalizedArguments[0].id : null
				}
				
				return {
					...prev,
					activeSource: 'document',
					arguments: newArguments,
					selectedArgumentId: newSelectedId
				}
			})
		} catch (error) {
			console.error('Failed to load markdown document:', error)
			// Fallback to the original extraction method
			const extraction = extractArgumentsFromMarkdown(documentId, content, title)
			
			setUnifiedData(prev => {
				const filteredArguments = prev.arguments.filter(arg => 
					!arg.markdown.documentId || arg.markdown.documentId !== documentId
				)
				const newArguments = [...filteredArguments, ...extraction.arguments]
				let newSelectedId = prev.selectedArgumentId
				if (!newSelectedId || prev.arguments.find(arg => arg.id === newSelectedId)?.markdown.documentId === documentId) {
					newSelectedId = extraction.arguments.length > 0 ? extraction.arguments[0].id : null
				}
				
				return {
					...prev,
					activeSource: 'document',
					arguments: newArguments,
					selectedArgumentId: newSelectedId
				}
			})
		}
	}, [])

	const updateMarkdownDocument = useCallback((documentId: string, content: string) => {
		setUnifiedData(prev => {
			const updatedArguments = prev.arguments.map(arg => {
				if (arg.markdown.documentId === documentId) {
					return updateArgumentFromMarkdown(arg, content)
				}
				return arg
			})
			
			return {
				...prev,
				arguments: updatedArguments
			}
		})
	}, [])

	const removeDocument = useCallback((documentId: string) => {
		setUnifiedData(prev => {
			const filteredArguments = prev.arguments.filter(arg => 
				!arg.markdown.documentId || arg.markdown.documentId !== documentId
			)
			
			// If selected argument was from removed document, select first remaining
			let newSelectedId = prev.selectedArgumentId
			if (prev.selectedArgumentId && !filteredArguments.find(arg => arg.id === prev.selectedArgumentId)) {
				newSelectedId = filteredArguments.length > 0 ? filteredArguments[0].id : null
			}
			
			return {
				...prev,
				arguments: filteredArguments,
				selectedArgumentId: newSelectedId
			}
		})
	}, [])

	const setActiveSource = useCallback((source: 'document' | 'expression' | 'imported') => {
		setUnifiedData(prev => ({
			...prev,
			activeSource: source
		}))
	}, [])

	// Add a new argument based on a single logic expression and select it
	const addExpressionArgument = useCallback((expression: string, title?: string): string => {
		const newArg = normalizeExpression(expression, title)
		setUnifiedData(prev => {
			return {
				...prev,
				activeSource: 'expression',
				arguments: [...prev.arguments, newArg],
				selectedArgumentId: newArg.id
			}
		})
		try { 
			localStorage.setItem('xv_selected_argument_id', newArg.id) 
		} catch (error) {
			console.warn('Failed to save selected argument ID to localStorage:', error)
		}
		return newArg.id
	}, [])

	// Add imported JSON arguments after normalization
	const addImportedJSONArguments = useCallback((json: ImportedJSON, selectFirst: boolean = true): string | null => {
		const args = normalizeImportedJSON(json)
		if (args.length === 0) return null
		const firstId = args[0].id
		setUnifiedData(prev => ({
			...prev,
			activeSource: 'imported',
			arguments: [...prev.arguments, ...args],
			selectedArgumentId: selectFirst ? firstId : prev.selectedArgumentId
		}))
		if (selectFirst) {
			try { 
				localStorage.setItem('xv_selected_argument_id', firstId) 
			} catch (error) {
				console.warn('Failed to save selected argument ID to localStorage:', error)
			}
		}
		return firstId
	}, [])

	// Global event listeners for cross-component actions (e.g., import JSON)
	useEffect(() => {
		const handleAddImported = (e: Event) => {
			const detail = (e as CustomEvent<ImportedJSON>).detail
			if (detail && 'arguments' in detail) {
				addImportedJSONArguments(detail, true)
			}
		}
		window.addEventListener('xv:add-imported-json', handleAddImported as EventListener)
		return () => window.removeEventListener('xv:add-imported-json', handleAddImported as EventListener)
	}, [addImportedJSONArguments])

	const value = useMemo<LogicSharedContextValue>(
		() => ({ 
			simulationMode, setSimulationMode, nodeIdToActive, setNodeIdToActive, resetStates, 
			selectedNodeId, setSelectedNodeId, currentExpression, setCurrentExpression, 
			expressionHighlightNonce, bumpExpressionHighlight, modes, setModes, nodeStates, setNodeStates,
			unifiedData, setUnifiedData, setSelectedArgumentId,
			getAstFor, getZlfnGraphFor, getAtnDataFor,
			loadMarkdownDocument, updateMarkdownDocument, removeDocument, setActiveSource,
			addExpressionArgument, addImportedJSONArguments
		}),
		[simulationMode, nodeIdToActive, resetStates, selectedNodeId, currentExpression, 
		 expressionHighlightNonce, bumpExpressionHighlight, modes, nodeStates, unifiedData,
		 setSelectedArgumentId, getAstFor, getZlfnGraphFor, getAtnDataFor,
		 loadMarkdownDocument, updateMarkdownDocument, removeDocument, setActiveSource,
		 addExpressionArgument, addImportedJSONArguments]
	)

	return <LogicSharedContext.Provider value={value}>{children}</LogicSharedContext.Provider>
}

export function useLogicShared(): LogicSharedContextValue {
	const ctx = useContext(LogicSharedContext)
	if (!ctx) throw new Error('useLogicShared must be used within LogicSharedProvider')
	return ctx
}


