import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react'
import type { AstNodeRec } from '../services/logic'
import { parseExpressionToAst, astToZlfnGraph } from '../services/logic'
import type { ZlfnNode, ZlfnEdge } from '../components/Visualizations/ZlfnGraph/types'
import type { ArgumentData, ArgumentNode } from '../components/Visualizations/ArgumentTableau/types'
import type { NodeIdToActive, LogicMode, NodeState, UnifiedData, SharedArgument } from './types'
import { extractArgumentsFromMarkdown, updateArgumentFromMarkdown } from '../services/markdownToArgument'
import { normalizeExpression, normalizeDocument, type ImportedJSON, normalizeImportedJSON, synthesizeExpressionFromGraph, extractNodesAndEdgesFromArguments } from '../services/argumentNormalizer'
import realAPI from '../services/realAPI'
import { api as mockAPI } from '../services/zlfnAPI'
import { apiConfig } from '../services/apiConfig'

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
	
	// Core Selection for Multi-Core Imports
	selectedCoreId: string | null
	setSelectedCoreId: (coreId: string | null) => void
	getCoresForCurrentImport: () => SharedArgument[]
	getCurrentImportId: () => string | null
	
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
	const [selectedCoreId, setSelectedCoreId] = useState<string | null>(null)

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
				// Try real backend only if configured and authenticated
				try {
					const cfg = apiConfig.getConfig()
					const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
					const shouldUseReal = cfg.useRealBackend && !!token
					if (shouldUseReal) {
						const resp = await realAPI.listObjects()
						if (resp.success && Array.isArray(resp.data) && resp.data.length > 0) {
							const ids = (resp.data as any[]).map(o => (o as any).id).filter(Boolean)
							const detailResults = await Promise.all(ids.map(id => realAPI.getObject(id)))
							fullObjects = detailResults.filter(r => (r as any)?.success && (r as any)?.data).map(r => (r as any).data)
						}
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

                                let serverArgs: any[]
                                if (fullObjects.length === 0) {
                                        serverArgs = [normalizeExpression('(A ∧ B) → C')]
                                } else {
                                        serverArgs = fullObjects.map((obj: any) => ({
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
                                                zlfnGraph: (() => {
                                                        if (!obj.zlfnJson) return undefined
                                                        // Check if it has nodes/edges at top level (old structure)
                                                        if (Array.isArray(obj.zlfnJson.nodes) && Array.isArray(obj.zlfnJson.edges)) {
                                                                return {
                                                                        nodes: obj.zlfnJson.nodes.map((n: any) => ({
                                                                                ...n,
                                                                                argumentId: n.argumentId || obj.id
                                                                        })),
                                                                        edges: obj.zlfnJson.edges || []
                                                                }
                                                        }
                                                        // Extract from arguments structure (new structure)
                                                        if (obj.zlfnJson.arguments) {
                                                                const extracted = extractNodesAndEdgesFromArguments(obj.zlfnJson)
                                                                // Assuming 'extracted' is a map from argumentId to {nodes, edges}
                                                                // We need to find the specific argument's graph
                                                                const argGraph = extracted[obj.id] || extracted[obj.zlfnJson.arguments[0]?.id]
                                                                if (argGraph) {
                                                                    return {
                                                                        nodes: argGraph.nodes.map((n: any) => ({
                                                                                ...n,
                                                                                argumentId: n.argumentId || obj.id
                                                                        })),
                                                                        edges: argGraph.edges
                                                                    }
                                                                }
                                                        }
                                                        return undefined
                                                })()
                                        }))
                                }
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

	// Core selection helpers for multi-core imports
	const getCurrentImportId = useCallback((): string | null => {
		const selectedArg = unifiedData.arguments.find(arg => arg.id === unifiedData.selectedArgumentId)
		return selectedArg?.coreMetadata?.importId || null
	}, [unifiedData.arguments, unifiedData.selectedArgumentId])

	const getCoresForCurrentImport = useCallback((): SharedArgument[] => {
		const currentImportId = getCurrentImportId()
		if (!currentImportId) return []
		
		return unifiedData.arguments
			.filter(arg => arg.coreMetadata?.importId === currentImportId)
			.sort((a, b) => (a.coreMetadata?.coreIndex || 0) - (b.coreMetadata?.coreIndex || 0))
	}, [unifiedData.arguments, getCurrentImportId])

	// Auto-select first core when switching to a multi-core import
	useEffect(() => {
		const selectedArg = unifiedData.arguments.find(arg => arg.id === unifiedData.selectedArgumentId)
		if (selectedArg?.coreMetadata) {
			// This is a multi-core import, ensure we have a valid core selection
			const cores = getCoresForCurrentImport()
			if (cores.length > 1 && !selectedCoreId) {
				// Auto-select the currently selected argument as the core
				setSelectedCoreId(selectedArg.id)
			} else if (cores.length <= 1) {
				// Single core or no cores, clear core selection
				setSelectedCoreId(null)
			}
		} else {
			// Not a multi-core import, clear core selection
			setSelectedCoreId(null)
		}
	}, [unifiedData.selectedArgumentId, unifiedData.arguments, selectedCoreId, getCoresForCurrentImport])

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
		
		// For multi-core imports, filter by selected core
		if (argument.coreMetadata && selectedCoreId) {
			const cores = getCoresForCurrentImport()
			if (cores.length > 1) {
				// This is a multi-core import, return data for selected core only
				const selectedCore = cores.find(core => core.id === selectedCoreId)
				if (selectedCore && selectedCore.zlfnGraph) {
					return selectedCore.zlfnGraph
				}
				// If selected core doesn't have graph data, fall back to computing from AST
				if (selectedCore) {
					const ast = selectedCore.ast || getAstFor(selectedCore.id)
					if (ast) {
						const graph = astToZlfnGraph(ast)
						if (graph) {
							selectedCore.zlfnGraph = graph as { nodes: ZlfnNode[]; edges: ZlfnEdge[] }
							return graph as { nodes: ZlfnNode[]; edges: ZlfnEdge[] }
						}
					}
				}
				// No valid core selected or no data, return empty graph
				return { nodes: [], edges: [] }
			}
		}
		
		// Single core or non-import: use standard logic
		// Return cached graph if present
		if (argument.zlfnGraph) return argument.zlfnGraph
		
		// Compute from AST only if available to avoid heavy rebuilds during selection
		const ast = argument.ast || getAstFor(argumentId)
		if (!ast) return null
		
		const graph = astToZlfnGraph(ast)
		if (graph) argument.zlfnGraph = graph as { nodes: ZlfnNode[]; edges: ZlfnEdge[] }
		return graph as { nodes: ZlfnNode[]; edges: ZlfnEdge[] } | null
	}, [unifiedData.arguments, getAstFor, selectedCoreId, getCoresForCurrentImport])

	const getAtnDataFor = useCallback((argumentId: string | null): ArgumentData | null => {
		if (!argumentId) return null
		const argument = unifiedData.arguments.find(arg => arg.id === argumentId)
		if (!argument) return null
		
		// Return cached ATN data or compute from graph
		if (argument.atn) return argument.atn
		
                const graph = getZlfnGraphFor(argumentId)
                if (!graph) {
                        console.error('[LogicShared] No graph data for argument:', argumentId)
                        const placeholderCore: ArgumentNode = {
                                id: `${argumentId}-core`,
                                argumentId,
                                argumentType: 'claim',
                                name: argument.title || 'Placeholder'
                        }
                        const placeholder: ArgumentData = {
                                id: argumentId,
                                name: argument.title || 'Untitled Argument',
                                core: placeholderCore,
                                components: [],
                                relationships: [],
                                layoutMode: 'tree'
                        }
                        argument.atn = placeholder
                        return placeholder
                }

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
		console.debug('[LogicShared] Loading markdown document:', { documentId, title, len: content.length })
		
		try {
                        // Check if this is a database-stored document by trying to fetch it
                        let databaseObject: any = null

                        try {
                                const cfg = apiConfig.getConfig()
                                const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
                                const shouldUseReal = cfg.useRealBackend && !!token
                                if (shouldUseReal) {
                                        const apiResponse = await realAPI.getObject(documentId)
                                        if (apiResponse.success && apiResponse.data) {
                                                databaseObject = apiResponse.data
                                                console.debug('[LogicShared] Document found in database:', documentId)
                                        }
                                }
                                if (!databaseObject) {
                                        const mockResp = await mockAPI.getObject(documentId)
                                        if (mockResp.success && mockResp.data) {
                                                databaseObject = mockResp.data
                                                console.debug('[LogicShared] Document found in mock store:', documentId)
                                        }
                                }
                        } catch {}

                        // Use backend content and metadata if available, otherwise use provided content
                        const effectiveContent = databaseObject?.markdownContent || content
                        const effectiveTitle = databaseObject?.metadata?.title || databaseObject?.title || title || documentId

                        // Prefer JSON graph from object when present; otherwise parse markdown
                        let normalizedArguments: any[]
                        if (databaseObject?.zlfnJson && Array.isArray(databaseObject.zlfnJson.arguments) && databaseObject.zlfnJson.arguments.length > 0) {
                            const extracted = extractNodesAndEdgesFromArguments(databaseObject.zlfnJson)
                            const graphs = Object.values(extracted)
                            const combinedNodes = graphs.flatMap(g => g.nodes).map((n: any) => ({ ...n, argumentId: n.argumentId || documentId }))
                            const combinedEdges = graphs.flatMap(g => g.edges)
                            normalizedArguments = [{
                                id: documentId,
                                title: effectiveTitle,
                                markdown: { documentId, content: effectiveContent },
                                expressions: [],
                                zlfnGraph: { nodes: combinedNodes, edges: combinedEdges },
                                notes: {}
                            }]
                        } else {
                            normalizedArguments = await normalizeDocument(documentId, effectiveContent)
                        }

                        // Do not merge via normalizeImportedJSON here; we extract graph directly below when present

                        if (normalizedArguments.length === 0) {
                                const extraction = extractArgumentsFromMarkdown(documentId, effectiveContent, effectiveTitle)
                                normalizedArguments = extraction.arguments.length > 0 ? extraction.arguments : [{
                                        id: documentId,
                                        title: effectiveTitle,
                                        markdown: { documentId, content: effectiveContent },
                                        expressions: []
                                }]
                        }

                        setUnifiedData(prev => {
				// Remove existing arguments from this document
				const filteredArguments = prev.arguments.filter(arg => 
					!arg.markdown.documentId || arg.markdown.documentId !== documentId
				)
				
                                // Enhance normalized arguments with database metadata if available
                                const dbArgCount = Array.isArray(databaseObject?.zlfnJson?.arguments) ? databaseObject.zlfnJson.arguments.length : 0
                                const enhancedArguments = normalizedArguments.map((arg: any) => {
                                        // If from database and has zlfnJson with arguments, extract nodes and edges
                                        let zlfnGraph = (arg as any).zlfnGraph
                                        if (databaseObject.zlfnJson) {
                                                // Check if it has the old structure with nodes/edges at top level
                                                if (Array.isArray(databaseObject.zlfnJson.nodes) && Array.isArray(databaseObject.zlfnJson.edges)) {
                                                        zlfnGraph = {
                                                                nodes: (databaseObject.zlfnJson.nodes || []).map((n: any) => ({
                                                                        ...n,
                                                                        argumentId: n.argumentId || documentId
                                                                })),
                                                                edges: databaseObject.zlfnJson.edges || []
                                                        }
                                                } else if (databaseObject.zlfnJson.arguments) {
                                                        // Extract from arguments structure
                                                        const extracted = extractNodesAndEdgesFromArguments(databaseObject.zlfnJson)
                                                        const argGraph = extracted[documentId] || extracted[databaseObject.zlfnJson.arguments[0]?.id]
                                                        if (argGraph) {
                                                          zlfnGraph = {
                                                            nodes: argGraph.nodes.map((n: any) => ({
                                                              ...n,
                                                              argumentId: n.argumentId || documentId
                                                            })),
                                                            edges: argGraph.edges
                                                          }
                                                        }
                                                }
                                        }
                                        
                                        // Use provided title parameter (from form), then effective title, then arg title
                                        let argumentTitle = title || effectiveTitle || arg.title
                                        
                                        // If we have database object with updated core names, use those
                                        if (databaseObject?.zlfnJson?.arguments) {
                                          const matchingArg = databaseObject.zlfnJson.arguments.find((dbArg: any) => 
                                            dbArg.core?.name && dbArg.core.name !== 'Argument'
                                          )
                                          if (matchingArg?.core?.name && !title) {
                                            argumentTitle = matchingArg.core.name
                                          }
                                        }
                                        
                                        return {
                                                ...arg,
                                                title: argumentTitle,
                                                markdown: {
                                                        ...arg.markdown,
                                                        content: effectiveContent
                                                },
                                                ...(zlfnGraph ? { zlfnGraph } : {})
                                        }
                                })

                                try {
                                        console.debug('[LogicShared] Args snapshot:', enhancedArguments.map(a => ({ id: a.id, title: a.title, hasGraph: !!a.zlfnGraph, nodes: a.zlfnGraph?.nodes?.length || 0, edges: a.zlfnGraph?.edges?.length || 0 })), 'dbArgCount:', dbArgCount)
                                } catch {}
				
				// Add enhanced arguments
				const newArguments = [...filteredArguments, ...enhancedArguments]
				
				// Select the first argument with a graph, else first
				const withGraph = enhancedArguments.filter(a => a.zlfnGraph && Array.isArray(a.zlfnGraph.nodes) && (a.zlfnGraph.nodes as any[]).length > 0)
				let newSelectedId = withGraph[0]?.id || (enhancedArguments.length > 0 ? enhancedArguments[0].id : null)
				
				console.debug('[LogicShared] Loading markdown document:', { documentId, title: effectiveTitle, len: effectiveContent.length })
				console.debug('[LogicShared] Extraction candidate (db zlfnJson present):', !!databaseObject?.zlfnJson)
				console.debug('[LogicShared] Enhanced args count:', enhancedArguments.length)
				console.debug('[LogicShared] Selecting argument id:', newSelectedId)
				
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
				const cfg = apiConfig.getConfig()
				const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
				const shouldUseReal = cfg.useRealBackend && !!token
				if (shouldUseReal) {
					const apiResponse = await realAPI.getObject(documentId)
					if (apiResponse.success && apiResponse.data) {
						// Update the database document
						const updateResponse = await realAPI.updateMarkdown(documentId, content)
						if (updateResponse.success) {
							isFromDatabase = true
							console.debug('[LogicShared] Database document updated successfully:', documentId)
						}
					}
				}
			} catch {}
			
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
				const cfg = apiConfig.getConfig()
				const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
				const shouldUseReal = cfg.useRealBackend && !!token
				if (shouldUseReal) {
					const apiResponse = await realAPI.getObject(documentId)
					if (apiResponse.success && apiResponse.data) {
						// Delete the database document
						const deleteResponse = await realAPI.deleteObject(documentId)
						if (deleteResponse.success) {
							isFromDatabase = true
							console.debug('[LogicShared] Database document deleted successfully:', documentId)
						}
					}
				}
			} catch {}
			
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
			selectedCoreId, setSelectedCoreId, getCoresForCurrentImport, getCurrentImportId,
			getAstFor, getZlfnGraphFor, getAtnDataFor,
			loadMarkdownDocument, updateMarkdownDocument, removeDocument, setActiveSource,
			addExpressionArgument, addImportedJSONArguments
		}),
		[simulationMode, nodeIdToActive, resetStates, selectedNodeId, currentExpression, 
		 expressionHighlightNonce, bumpExpressionHighlight, modes, nodeStates, unifiedData,
		 setSelectedArgumentId, selectedCoreId, getCoresForCurrentImport, getCurrentImportId,
		 getAstFor, getZlfnGraphFor, getAtnDataFor,
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


