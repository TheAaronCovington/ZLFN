import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type NodeIdToActive = Record<string, boolean>

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
}

const LogicSharedContext = createContext<LogicSharedContextValue | null>(null)

export const LogicSharedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [simulationMode, setSimulationMode] = useState<boolean>(false)
	const [nodeIdToActive, setNodeIdToActive] = useState<NodeIdToActive>({})
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
	const [currentExpression, setCurrentExpression] = useState<string>('(A ∧ B) → C')
	const [expressionHighlightNonce, setExpressionHighlightNonce] = useState<number>(0)

	const resetStates = useCallback(() => {
        setNodeIdToActive({})
        setSelectedNodeId(null)
    }, [])

	const bumpExpressionHighlight = useCallback(() => {
		setExpressionHighlightNonce(n => n + 1)
	}, [])

	const value = useMemo<LogicSharedContextValue>(
		() => ({ simulationMode, setSimulationMode, nodeIdToActive, setNodeIdToActive, resetStates, selectedNodeId, setSelectedNodeId, currentExpression, setCurrentExpression, expressionHighlightNonce, bumpExpressionHighlight }),
		[simulationMode, nodeIdToActive, resetStates, selectedNodeId, currentExpression, expressionHighlightNonce, bumpExpressionHighlight]
	)

	return <LogicSharedContext.Provider value={value}>{children}</LogicSharedContext.Provider>
}

export function useLogicShared(): LogicSharedContextValue {
	const ctx = useContext(LogicSharedContext)
	if (!ctx) throw new Error('useLogicShared must be used within LogicSharedProvider')
	return ctx
}


