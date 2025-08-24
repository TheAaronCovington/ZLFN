import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react'
import type { AstNodeRec } from '../services/logic'
import { parseExpressionToAst, astToZlfnGraph } from '../services/logic'
import type { ZlfnNode, ZlfnEdge } from '../components/Visualizations/ZlfnGraph/types'
import type { ArgumentData } from '../components/Visualizations/ArgumentTableau/types'
import type { NodeIdToActive, LogicMode, NodeState, UnifiedData } from './types'
import { extractArgumentsFromMarkdown, updateArgumentFromMarkdown } from '../services/markdownToArgument'
import { normalizeExpression, normalizeDocument, type ImportedJSON, normalizeImportedJSON, synthesizeExpressionFromGraph } from '../services/argumentNormalizer'
import realAPI from '../services/realAPI'
import { api as mockAPI } from '../services/zlfnAPI'

// (types moved to src/context/types.ts to satisfy Fast Refresh constraints)

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

	// Initialize unified data with default expression-based argument, URL params, and persisted arguments
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

		// Load persisted arguments (without computed caches)
		let persistedArgs: any[] | null = null
		try {
			const raw = localStorage.getItem('xv_unified_arguments')
			if (raw) persistedArgs = JSON.parse(raw)
		} catch (e) {
			console.warn('Failed to parse persisted arguments:', e)
		}

		const baseDefault: any[] = []

		const argumentsList = Array.isArray(persistedArgs) && persistedArgs.length > 0 ? persistedArgs : baseDefault
		// Ensure selected id exists
		const selectedId = (savedSelectedArgumentId && argumentsList.some(a => a.id === savedSelectedArgumentId))
			? savedSelectedArgumentId
			: (argumentsList[0]?.id || '')

		return {
			activeSource: savedActiveSource,
			arguments: argumentsList,
			selectedArgumentId: selectedId
		}
	})

	// Load arguments on boot (real backend first, then mock fallback) and merge into unified store
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				let fullObjects: any[] = []
				// Try real backend
				try {
					const resp = await realAPI.listObjects()
					if (resp.success && Array.isArray(resp.data) && resp.data.length > 0) {
						const ids = (resp.data as any[]).map(o => (o as any).id).filter(Boolean)
						const detailResults = await Promise.all(ids.map(id => realAPI.getObject(id)))
						fullObjects = detailResults.filter(r => (r as any)?.success && (r as any)?.data).map(r => (r as any).data)
						console.debug('[LogicShared] Server objects loaded', { count: fullObjects.length, ids })
					}
				} catch {}

				// Fallback to mock store if nothing came from real backend
				if (fullObjects.length === 0) {
					try {
						let mockList = await mockAPI.getAllObjects()
						if (!mockList.success || !Array.isArray(mockList.data) || mockList.data.length === 0) {
							// Seed a sample so the selector is never empty
							await mockAPI.getObject('sample-object-1')
							mockList = await mockAPI.getAllObjects()
						}
						if (mockList.success && Array.isArray(mockList.data)) {
							fullObjects = mockList.data as any[]
							console.debug('[LogicShared] Mock objects loaded', { count: fullObjects.length })
						}
					} catch {}
				}

				if (fullObjects.length === 0) return

				const serverArgs = fullObjects.map((obj: any) => ({
					id: obj.id,
					title: obj.metadata?.title || obj.title || (obj.id ? obj.id.replace(/_/g, ' ') : 'Untitled'),
					markdown: {
						documentId: obj.id,
						content: obj.markdownContent || '',
						source: obj.metadata?.isFromDatabase ? 'database' : 'mock',
						lastModified: obj.metadata?.modified,
						author: obj.metadata?.author
					},
					expressions: [],
					metadata: {
						created: obj.metadata?.created,
						modified: obj.metadata?.modified,
						author: obj.metadata?.author,
						description: obj.metadata?.description,
						status: obj.metadata?.status,
						isFromDatabase: !!obj.metadata?.isFromDatabase
					},
					zlfnGraph: obj.zlfnJson && Array.isArray(obj.zlfnJson.nodes) && Array.isArray(obj.zlfnJson.edges)
						? {
							nodes: obj.zlfnJson.nodes.map((n: any) => ({
								...n,
								argumentId: n.argumentId || obj.id
							})),
							edges: obj.zlfnJson.edges || []
						}
						: undefined
				}))
				if (cancelled) return
				setUnifiedData(prev => {
					const map = new Map(prev.arguments.map(a => [a.id, a]))
					for (const a of serverArgs) map.set(a.id, a)
					let merged = Array.from(map.values())
					// Fallback demo argument if nothing available
					if (merged.length === 0) {
						const demo = normalizeExpression('(A ∧ B) → C', 'sample-1')
						merged = [demo]
					}
					let nextSelected = prev.selectedArgumentId
					if (nextSelected && !merged.some(a => a.id === nextSelected)) {
						nextSelected = merged[0]?.id || prev.selectedArgumentId
					}
					return { ...prev, arguments: merged, selectedArgumentId: nextSelected }
				})
			} catch {}
		})()
		return () => { cancelled = true }
	}, [])

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

	// Persist unifiedData.arguments to localStorage (strip computed caches)
	useEffect(() => {
		try {
			const serializable = unifiedData.arguments.map(arg => ({
				...arg,
				// Drop computed caches that are expensive or unnecessary
				ast: undefined,
				atn: undefined
			}))
			localStorage.setItem('xv_unified_arguments', JSON.stringify(serializable))
		} catch (e) {
			console.warn('Failed to persist arguments:', e)
		}
	}, [unifiedData.arguments])

	// Lazy accessors with memoization
	const getAstFor = useCallback((argumentId: string | null): AstNodeRec | null => {
		if (!argumentId) return null
		const argument = unifiedData.arguments.find(arg => arg.id === argumentId)
		if (!argument) return null
		
		// Return cached AST or compute from first expression
		if (argument.ast) return argument.ast
		// Avoid rebuilding from large cached graphs on first access; prefer expressions
		let sourceExpression: string | null = null
		if (argument.expressions && argument.expressions.length > 0) {
			sourceExpression = argument.expressions[0]
		} else if (argument.zlfnGraph && Array.isArray(argument.zlfnGraph.nodes) && Array.isArray(argument.zlfnGraph.edges)) {
			// If persisted graph is very large, skip auto-synthesis here; caller can trigger later
			const nodeCount = (argument.zlfnGraph.nodes as any[]).length
			const edgeCount = (argument.zlfnGraph.edges as any[]).length
			if (nodeCount > 300 || edgeCount > 300) return null
			sourceExpression = synthesizeExpressionFromGraph(argument.zlfnGraph.nodes as any, argument.zlfnGraph.edges as any)
		}
		if (!sourceExpression) return null
		
		let ast = parseExpressionToAst(sourceExpression)
		if (!ast && argument.zlfnGraph && Array.isArray(argument.zlfnGraph.nodes) && Array.isArray(argument.zlfnGraph.edges)) {
			const fallbackExpr = synthesizeExpressionFromGraph(argument.zlfnGraph.nodes as any, argument.zlfnGraph.edges as any)
			ast = parseExpressionToAst(fallbackExpr)
			if (fallbackExpr) {
				if (!argument.expressions || argument.expressions.length === 0) {
					argument.expressions = [fallbackExpr]
				} else {
					argument.expressions[0] = fallbackExpr
				}
			}
		}
		if (ast) argument.ast = ast
		return ast
	}, [unifiedData.arguments])

	const getZlfnGraphFor = useCallback((argumentId: string | null): { nodes: ZlfnNode[]; edges: ZlfnEdge[] } | null => {
		if (!argumentId) return null
		const argument = unifiedData.arguments.find(arg => arg.id === argumentId)
		if (!argument) return null
		// debug removed
		// Return cached graph if present
		if (argument.zlfnGraph) return argument.zlfnGraph
		
		// Compute from AST only if available to avoid heavy rebuilds during selection
		const ast = argument.ast || getAstFor(argumentId)
		if (!ast) return null
		
		const graph = astToZlfnGraph(ast)
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

		// Map ZLFN → ATN
		const toArgType = (t: string): any => {
			switch (t) {
				case 'conclusion': return 'claim'
				case 'premise': return 'ground'
				case 'term': return 'warrant'
				case 'informal': return 'qualifier'
				case 'fallacy': return 'rebuttal'
				default: return 'ground'
			}
		}
		const schemeFor = (rule?: string) => rule || 'Support'
		
		// Build nodes
		const components: any[] = []
		let coreNode: any | null = null
		for (const n of graph.nodes) {
			const argumentType = toArgType(n.type as any)
			const mapped = {
				...n,
				argumentType,
				argumentId,
				strength: (n as any).strength ?? 80,
				facets: { ...(n as any).facets, rebuttalRelevant: argumentType === 'rebuttal', noteRelevant: true },
			}
			if (argumentType === 'claim' && !coreNode) coreNode = { ...mapped, id: `${n.id}` }
			else components.push(mapped)
		}
		if (!coreNode && graph.nodes.length) {
			const n0 = graph.nodes[0]
			coreNode = { ...n0, argumentType: 'claim', argumentId, strength: 85 }
		}
		
		// Build relationships
		const relationships: any[] = graph.edges.map(e => {
			const relationshipType = (e.type === 'counterexample') ? 'attack' : 'support'
			return {
				...e,
				relationshipType,
				scheme: schemeFor(e.rule),
				confidence: e.weight ?? 70
			}
		})

		const atnData: ArgumentData = {
			id: argumentId,
			name: argument.title || `Argument ${argumentId}`,
			description: argument.markdown?.content ? argument.markdown.content.slice(0, 240) : undefined,
			core: coreNode as any,
			components,
			relationships,
			layoutMode: 'tree'
		}

		argument.atn = atnData
		return atnData
	}, [unifiedData.arguments, getZlfnGraphFor])

	// Persist active source changes
	useEffect(() => {
		localStorage.setItem('xv_active_source', unifiedData.activeSource)
	}, [unifiedData.activeSource])

    // (moved below after addImportedJSONArguments initialization)

	// Markdown document management methods - enhanced for database-stored content
	const loadMarkdownDocument = useCallback(async (documentId: string, content: string, title?: string) => {
		console.debug('[LogicShared] Loading markdown document:', { documentId, title, contentLength: content.length })
		
		try {
			// Check if this is a database-stored document by trying to fetch it
			let databaseObject: any = null
			let isFromDatabase = false
			
			try {
				const apiResponse = await realAPI.getObject(documentId)
				if (apiResponse.success && apiResponse.data) {
					databaseObject = apiResponse.data
					isFromDatabase = true
					console.debug('[LogicShared] Document found in database:', documentId)
				}
			} catch (dbError) {
				console.debug('[LogicShared] Document not in database, treating as file-based:', documentId)
			}
			
			// Use database content and metadata if available, otherwise use provided content
			const effectiveContent = isFromDatabase ? (databaseObject.markdownContent || content) : content
			const effectiveTitle = isFromDatabase ? 
				(databaseObject.metadata?.title || databaseObject.title || title || documentId) : 
				(title || documentId)
			
			// Use normalizeDocument to align with parseDocumentToGraph workflow
			const normalizedArguments = await normalizeDocument(documentId, effectiveContent)
			
			setUnifiedData(prev => {
				// Remove existing arguments from this document
				const filteredArguments = prev.arguments.filter(arg => 
					!arg.markdown.documentId || arg.markdown.documentId !== documentId
				)
				
				// Enhance normalized arguments with database metadata if available
				const enhancedArguments = normalizedArguments.map(arg => ({
					...arg,
					title: effectiveTitle,
					markdown: {
						...arg.markdown,
						content: effectiveContent
					},
					// If from database and has zlfnJson, use it
					...(isFromDatabase && databaseObject.zlfnJson ? {
						zlfnGraph: {
							nodes: (databaseObject.zlfnJson.nodes || []).map((n: any) => ({ 
								...n, 
								argumentId: n.argumentId || documentId 
							})),
							edges: databaseObject.zlfnJson.edges || []
						}
					} : {})
				}))
				
				// Add enhanced arguments
				const newArguments = [...filteredArguments, ...enhancedArguments]
				
				// Select the first document argument if none selected or if current selection was from this document
				let newSelectedId = prev.selectedArgumentId
				if (!newSelectedId || prev.arguments.find(arg => arg.id === newSelectedId)?.markdown.documentId === documentId) {
					newSelectedId = enhancedArguments.length > 0 ? enhancedArguments[0].id : null
				}
				
				console.debug('[LogicShared] Document loaded successfully:', { 
					documentId, 
					isFromDatabase, 
					argumentCount: enhancedArguments.length,
					selectedId: newSelectedId
				})
				
				return {
					...prev,
					activeSource: 'document',
					arguments: newArguments,
					selectedArgumentId: newSelectedId
				}
			})
		} catch (error) {
			console.error('[LogicShared] Failed to load markdown document:', error)
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
				
				console.debug('[LogicShared] Document loaded via fallback method:', { 
					documentId, 
					argumentCount: extraction.arguments.length 
				})
				
				return {
					...prev,
					activeSource: 'document',
					arguments: newArguments,
					selectedArgumentId: newSelectedId
				}
			})
		}
	}, [])

	const updateMarkdownDocument = useCallback(async (documentId: string, content: string) => {
		console.debug('[LogicShared] Updating markdown document:', { documentId, contentLength: content.length })
		
		try {
			// Check if this is a database document and update it
			let isFromDatabase = false
			try {
				const apiResponse = await realAPI.getObject(documentId)
				if (apiResponse.success && apiResponse.data) {
					// Update the database document
					const updateResponse = await realAPI.updateMarkdown(documentId, content)
					if (updateResponse.success) {
						isFromDatabase = true
						console.debug('[LogicShared] Database document updated successfully:', documentId)
					}
				}
			} catch (dbError) {
				console.debug('[LogicShared] Document not in database or update failed:', dbError)
			}
			
			// Update local state
			setUnifiedData(prev => {
				const updatedArguments = prev.arguments.map(arg => {
					if (arg.markdown.documentId === documentId) {
						return {
							...updateArgumentFromMarkdown(arg, content),
							markdown: {
								...arg.markdown,
								content: content
							}
						}
					}
					return arg
				})
				
				console.debug('[LogicShared] Local document state updated:', { 
					documentId, 
					isFromDatabase,
					argumentCount: updatedArguments.filter(arg => arg.markdown.documentId === documentId).length
				})
				
				return {
					...prev,
					arguments: updatedArguments
				}
			})
		} catch (error) {
			console.error('[LogicShared] Failed to update markdown document:', error)
			// Fallback to local-only update
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
		}
	}, [])

	const removeDocument = useCallback(async (documentId: string) => {
		console.debug('[LogicShared] Removing document:', documentId)
		
		try {
			// Check if this is a database document and delete it
			let isFromDatabase = false
			try {
				const apiResponse = await realAPI.getObject(documentId)
				if (apiResponse.success && apiResponse.data) {
					// Delete the database document
					const deleteResponse = await realAPI.deleteObject(documentId)
					if (deleteResponse.success) {
						isFromDatabase = true
						console.debug('[LogicShared] Database document deleted successfully:', documentId)
					}
				}
			} catch (dbError) {
				console.debug('[LogicShared] Document not in database or delete failed:', dbError)
			}
			
			// Update local state
			setUnifiedData(prev => {
				const filteredArguments = prev.arguments.filter(arg => 
					!arg.markdown.documentId || arg.markdown.documentId !== documentId
				)
				
				// If selected argument was from removed document, select first remaining
				let newSelectedId = prev.selectedArgumentId
				if (prev.selectedArgumentId && !filteredArguments.find(arg => arg.id === prev.selectedArgumentId)) {
					newSelectedId = filteredArguments.length > 0 ? filteredArguments[0].id : null
				}
				
				console.debug('[LogicShared] Document removed from local state:', { 
					documentId, 
					isFromDatabase,
					remainingCount: filteredArguments.length,
					newSelectedId
				})
				
				return {
					...prev,
					arguments: filteredArguments,
					selectedArgumentId: newSelectedId
				}
			})
		} catch (error) {
			console.error('[LogicShared] Failed to remove document:', error)
			// Fallback to local-only removal
			setUnifiedData(prev => {
				const filteredArguments = prev.arguments.filter(arg => 
					!arg.markdown.documentId || arg.markdown.documentId !== documentId
				)
				
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
		}
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
		// debug removed
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


