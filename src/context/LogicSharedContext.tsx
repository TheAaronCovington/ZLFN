import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type NodeIdToActive = Record<string, boolean>
export type LogicMode = 'classical' | 'epistemic' | 'deontic' | 'temporal' | 'informal' | 'paraconsistent' | 'fuzzy'
export type NodeState = { value: 'T' | 'F' | 'B' | number; weight?: number }

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

	const resetStates = useCallback(() => {
        setNodeIdToActive({})
        setSelectedNodeId(null)
		setNodeStates({})
    }, [])

	const bumpExpressionHighlight = useCallback(() => {
		setExpressionHighlightNonce(n => n + 1)
	}, [])

	const value = useMemo<LogicSharedContextValue>(
		() => ({ simulationMode, setSimulationMode, nodeIdToActive, setNodeIdToActive, resetStates, selectedNodeId, setSelectedNodeId, currentExpression, setCurrentExpression, expressionHighlightNonce, bumpExpressionHighlight, modes, setModes, nodeStates, setNodeStates }),
		[simulationMode, nodeIdToActive, resetStates, selectedNodeId, currentExpression, expressionHighlightNonce, bumpExpressionHighlight, modes, nodeStates]
	)

	return <LogicSharedContext.Provider value={value}>{children}</LogicSharedContext.Provider>
}

export function useLogicShared(): LogicSharedContextValue {
	const ctx = useContext(LogicSharedContext)
	if (!ctx) throw new Error('useLogicShared must be used within LogicSharedProvider')
	return ctx
}


