import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react'
import type { AstNodeRec } from '../services/logic'
import { parseExpressionToAst, astToZlfnGraph } from '../services/logic'
import type { ZlfnNode, ZlfnEdge } from '../components/Visualizations/ZlfnGraph/types'
import type { ArgumentData } from '../components/Visualizations/ArgumentTableau/types'

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

	// Initialize unified data with default expression-based argument
	const [unifiedData, setUnifiedData] = useState<UnifiedData>(() => {
		const savedSelectedArgumentId = localStorage.getItem('xv_selected_argument_id')
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
		} else {
			localStorage.removeItem('xv_selected_argument_id')
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
			} as any,
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

	const value = useMemo<LogicSharedContextValue>(
		() => ({ 
			simulationMode, setSimulationMode, nodeIdToActive, setNodeIdToActive, resetStates, 
			selectedNodeId, setSelectedNodeId, currentExpression, setCurrentExpression, 
			expressionHighlightNonce, bumpExpressionHighlight, modes, setModes, nodeStates, setNodeStates,
			unifiedData, setUnifiedData, setSelectedArgumentId,
			getAstFor, getZlfnGraphFor, getAtnDataFor
		}),
		[simulationMode, nodeIdToActive, resetStates, selectedNodeId, currentExpression, 
		 expressionHighlightNonce, bumpExpressionHighlight, modes, nodeStates, unifiedData,
		 setSelectedArgumentId, getAstFor, getZlfnGraphFor, getAtnDataFor]
	)

	return <LogicSharedContext.Provider value={value}>{children}</LogicSharedContext.Provider>
}

export function useLogicShared(): LogicSharedContextValue {
	const ctx = useContext(LogicSharedContext)
	if (!ctx) throw new Error('useLogicShared must be used within LogicSharedProvider')
	return ctx
}


