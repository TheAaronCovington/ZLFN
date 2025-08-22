// Hook for managing Bayesian reasoning mode in ZLFN graphs
// Provides probabilistic inference and evidence management

import { useState, useCallback, useEffect, useMemo } from 'react'
import { 
  BayesianReasoner, 
  createBayesianReasoner, 
  type BayesianInferenceResult
} from '../services/bayesianReasoning'

export interface BayesianModeConfig {
  enabled: boolean
  showProbabilities: boolean
  showConfidence: boolean
  autoUpdate: boolean
  convergenceThreshold: number
  maxIterations: number
}

export interface EvidenceUpdate {
  nodeId: string
  probability: number
  label?: string
}

export interface UseBayesianModeReturn {
  isEnabled: boolean
  config: BayesianModeConfig
  results: BayesianInferenceResult[]
  reasoner: BayesianReasoner | null
  
  // Control functions
  toggle: () => void
  updateConfig: (newConfig: Partial<BayesianModeConfig>) => void
  setEvidence: (nodeId: string, probability: number) => void
  removeEvidence: (nodeId: string) => void
  clearAllEvidence: () => void
  runInference: () => void
  
  // Analysis functions
  getMostLikelyExplanation: () => { nodes: string[], probability: number } | null
  performSensitivityAnalysis: (nodeId: string) => any
  
  // UI helpers
  getNodeProbability: (nodeId: string) => number
  getNodeConfidence: (nodeId: string) => number
  getNodeReasoning: (nodeId: string) => string
  isEvidenceNode: (nodeId: string) => boolean
}

export function useBayesianMode(
  nodes: any[] = [],
  edges: any[] = [],
  initialConfig: Partial<BayesianModeConfig> = {}
): UseBayesianModeReturn {
  const [config, setConfig] = useState<BayesianModeConfig>({
    enabled: false,
    showProbabilities: true,
    showConfidence: true,
    autoUpdate: true,
    convergenceThreshold: 0.001,
    maxIterations: 100,
    ...initialConfig
  })

  const [results, setResults] = useState<BayesianInferenceResult[]>([])
  const [evidenceNodes, setEvidenceNodes] = useState<Set<string>>(new Set())

  // Create reasoner when nodes/edges change
  const reasoner = useMemo(() => {
    if (!config.enabled || nodes.length === 0) return null
    return createBayesianReasoner(nodes, edges)
  }, [nodes, edges, config.enabled])

  // Run inference when reasoner or config changes
  useEffect(() => {
    if (reasoner && config.autoUpdate) {
      const inferenceResults = reasoner.performInference()
      setResults(inferenceResults)
    }
  }, [reasoner, config.autoUpdate])

  const toggle = useCallback(() => {
    setConfig(prev => ({ ...prev, enabled: !prev.enabled }))
  }, [])

  const updateConfig = useCallback((newConfig: Partial<BayesianModeConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }))
  }, [])

  const setEvidence = useCallback((nodeId: string, probability: number) => {
    if (!reasoner) return
    
    reasoner.setEvidence(nodeId, probability)
    setEvidenceNodes(prev => new Set(prev).add(nodeId))
    
    if (config.autoUpdate) {
      const inferenceResults = reasoner.performInference()
      setResults(inferenceResults)
    }
  }, [reasoner, config.autoUpdate])

  const removeEvidence = useCallback((nodeId: string) => {
    if (!reasoner) return
    
    reasoner.removeEvidence(nodeId)
    setEvidenceNodes(prev => {
      const newSet = new Set(prev)
      newSet.delete(nodeId)
      return newSet
    })
    
    if (config.autoUpdate) {
      const inferenceResults = reasoner.performInference()
      setResults(inferenceResults)
    }
  }, [reasoner, config.autoUpdate])

  const clearAllEvidence = useCallback(() => {
    if (!reasoner) return
    
    evidenceNodes.forEach(nodeId => {
      reasoner.removeEvidence(nodeId)
    })
    setEvidenceNodes(new Set())
    
    if (config.autoUpdate) {
      const inferenceResults = reasoner.performInference()
      setResults(inferenceResults)
    }
  }, [reasoner, evidenceNodes, config.autoUpdate])

  const runInference = useCallback(() => {
    if (!reasoner) return
    
    const inferenceResults = reasoner.performInference()
    setResults(inferenceResults)
  }, [reasoner])

  const getMostLikelyExplanation = useCallback(() => {
    if (!reasoner) return null
    return reasoner.getMostLikelyExplanation()
  }, [reasoner])

  const performSensitivityAnalysis = useCallback((nodeId: string) => {
    if (!reasoner) return null
    return reasoner.performSensitivityAnalysis(nodeId)
  }, [reasoner])

  const getNodeProbability = useCallback((nodeId: string): number => {
    const result = results.find(r => r.nodeId === nodeId)
    return result?.probability || 0.5
  }, [results])

  const getNodeConfidence = useCallback((nodeId: string): number => {
    const result = results.find(r => r.nodeId === nodeId)
    return result?.confidence || 0.5
  }, [results])

  const getNodeReasoning = useCallback((nodeId: string): string => {
    const result = results.find(r => r.nodeId === nodeId)
    return result?.reasoning || 'No reasoning available'
  }, [results])

  const isEvidenceNode = useCallback((nodeId: string): boolean => {
    return evidenceNodes.has(nodeId)
  }, [evidenceNodes])

  return {
    isEnabled: config.enabled,
    config,
    results,
    reasoner,
    
    toggle,
    updateConfig,
    setEvidence,
    removeEvidence,
    clearAllEvidence,
    runInference,
    
    getMostLikelyExplanation,
    performSensitivityAnalysis,
    
    getNodeProbability,
    getNodeConfidence,
    getNodeReasoning,
    isEvidenceNode
  }
}

// Preset configurations for different Bayesian reasoning scenarios
export const bayesianPresets = {
  // Quick probabilistic assessment
  quick: {
    enabled: true,
    showProbabilities: true,
    showConfidence: false,
    autoUpdate: true,
    convergenceThreshold: 0.01,
    maxIterations: 50
  },
  
  // Detailed analysis with confidence intervals
  detailed: {
    enabled: true,
    showProbabilities: true,
    showConfidence: true,
    autoUpdate: true,
    convergenceThreshold: 0.001,
    maxIterations: 100
  },
  
  // High precision for research
  research: {
    enabled: true,
    showProbabilities: true,
    showConfidence: true,
    autoUpdate: false, // Manual control for careful analysis
    convergenceThreshold: 0.0001,
    maxIterations: 200
  },
  
  // Performance optimized for large networks
  performance: {
    enabled: true,
    showProbabilities: true,
    showConfidence: false,
    autoUpdate: false,
    convergenceThreshold: 0.01,
    maxIterations: 30
  }
} as const

export type BayesianPreset = keyof typeof bayesianPresets

/**
 * Helper function to format probability as percentage
 */
export function formatProbability(probability: number, decimals = 1): string {
  return `${(probability * 100).toFixed(decimals)}%`
}

/**
 * Helper function to get probability color based on value
 */
export function getProbabilityColor(probability: number): string {
  if (probability >= 0.8) return 'var(--ai-green)'
  if (probability >= 0.6) return 'var(--ai-cyan)'
  if (probability >= 0.4) return 'var(--ai-orange)'
  return 'var(--ai-red)'
}

/**
 * Helper function to get confidence color based on value
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'var(--ai-green)'
  if (confidence >= 0.6) return 'var(--ai-blue)'
  if (confidence >= 0.4) return 'var(--ai-orange)'
  return 'var(--ai-red)'
}
