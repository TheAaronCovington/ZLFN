// Hook for managing Flow Rivers in ZLFN graphs
// Provides state management and integration with D3 visualizations

import { useRef, useCallback, useEffect, useState } from 'react'
import * as d3 from 'd3'
import { FlowRiversRenderer, createFlowRivers, convertToFlowRiverData, type FlowRiverConfig } from '../services/flowRivers'

export interface UseFlowRiversOptions {
  enabled?: boolean
  animationSpeed?: number
  particleCount?: number
  particleSize?: number
  showStrength?: boolean
  colorScheme?: 'default' | 'strength' | 'type'
  opacity?: number
}

export interface UseFlowRiversReturn {
  flowRivers: FlowRiversRenderer | null
  isEnabled: boolean
  config: FlowRiverConfig
  toggle: () => void
  updateConfig: (newConfig: Partial<FlowRiverConfig>) => void
  highlightPath: (nodeIds: string[], color?: string) => void
  clearHighlight: () => void
  updateGraph: (nodes: any[], edges: any[]) => void
}

export function useFlowRivers(
  svgRef: React.RefObject<SVGSVGElement | null>,
  options: UseFlowRiversOptions = {}
): UseFlowRiversReturn {
  const flowRiversRef = useRef<FlowRiversRenderer | null>(null)
  const [isEnabled, setIsEnabled] = useState(options.enabled ?? false)
  const [config, setConfig] = useState<FlowRiverConfig>({
    enabled: options.enabled ?? false,
    animationSpeed: options.animationSpeed ?? 1,
    particleCount: options.particleCount ?? 3,
    particleSize: options.particleSize ?? 4,
    showStrength: options.showStrength ?? true,
    colorScheme: options.colorScheme ?? 'default',
    opacity: options.opacity ?? 0.7
  })

  // Initialize Flow Rivers when SVG is available
  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    flowRiversRef.current = createFlowRivers(svg, config)

    return () => {
      if (flowRiversRef.current) {
        flowRiversRef.current.destroy()
        flowRiversRef.current = null
      }
    }
  }, [svgRef.current]) // Re-initialize if SVG changes

  // Update config when it changes
  useEffect(() => {
    if (flowRiversRef.current) {
      flowRiversRef.current.updateConfig(config)
    }
  }, [config])

  const toggle = useCallback(() => {
    setIsEnabled(prev => {
      const newEnabled = !prev
      const newConfig = { ...config, enabled: newEnabled }
      setConfig(newConfig)
      
      if (flowRiversRef.current) {
        flowRiversRef.current.toggle()
      }
      
      return newEnabled
    })
  }, [config])

  const updateConfig = useCallback((newConfig: Partial<FlowRiverConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...newConfig }
      if (flowRiversRef.current) {
        flowRiversRef.current.updateConfig(updated)
      }
      return updated
    })
    
    if ('enabled' in newConfig) {
      setIsEnabled(newConfig.enabled!)
    }
  }, [])

  const highlightPath = useCallback((nodeIds: string[], color?: string) => {
    if (flowRiversRef.current) {
      flowRiversRef.current.highlightPath(nodeIds, color)
    }
  }, [])

  const clearHighlight = useCallback(() => {
    if (flowRiversRef.current) {
      flowRiversRef.current.clearHighlight()
    }
  }, [])

  const updateGraph = useCallback((nodes: any[], edges: any[]) => {
    if (flowRiversRef.current) {
      const { nodes: flowNodes, edges: flowEdges } = convertToFlowRiverData(nodes, edges)
      flowRiversRef.current.updateGraph(flowNodes, flowEdges)
    }
  }, [])

  return {
    flowRivers: flowRiversRef.current,
    isEnabled,
    config,
    toggle,
    updateConfig,
    highlightPath,
    clearHighlight,
    updateGraph
  }
}

// Preset configurations for different use cases
export const flowRiverPresets = {
  subtle: {
    enabled: true,
    animationSpeed: 0.5,
    particleCount: 2,
    particleSize: 3,
    opacity: 0.5,
    colorScheme: 'default' as const
  },
  
  dynamic: {
    enabled: true,
    animationSpeed: 1.5,
    particleCount: 4,
    particleSize: 5,
    opacity: 0.8,
    colorScheme: 'strength' as const,
    showStrength: true
  },
  
  presentation: {
    enabled: true,
    animationSpeed: 1,
    particleCount: 3,
    particleSize: 6,
    opacity: 0.9,
    colorScheme: 'type' as const,
    showStrength: true
  },
  
  performance: {
    enabled: true,
    animationSpeed: 2,
    particleCount: 1,
    particleSize: 3,
    opacity: 0.6,
    colorScheme: 'default' as const,
    showStrength: false
  }
} as const

export type FlowRiverPreset = keyof typeof flowRiverPresets
