import { useRef, useEffect, useMemo } from 'react'
import * as d3 from 'd3'
import { createCustomForces, createSimulation, type ForceConfig, type BoundaryConfig } from '../simulation/forces'

export interface UseSimulationConfig {
	forces: ForceConfig
	boundary?: BoundaryConfig
	onTick?: () => void
	onEnd?: () => void
	debug?: boolean
}

export function useSimulation(
	nodes: any[],
	edges: any[],
	config: UseSimulationConfig
) {
	const simulationRef = useRef<d3.Simulation<any, any> | null>(null)
	const zoneByIdRef = useRef<Map<string, any>>(new Map())

	// Create forces
	const forces = useMemo(() => {
		return createCustomForces(nodes, edges, config.forces, config.boundary)
	}, [nodes, edges, config.forces, config.boundary])

	// Initialize simulation
	useEffect(() => {
		if (simulationRef.current) {
			simulationRef.current.stop()
		}

		simulationRef.current = createSimulation(nodes, edges, forces)

		// Add custom zone-based forces
		simulationRef.current.on('tick.zoneAttraction', () => {
			forces.zoneAttraction?.(zoneByIdRef.current)
		})

		simulationRef.current.on('tick.termsSpread', () => {
			const termsZone = zoneByIdRef.current.get('terms')
			forces.termsSpread?.(termsZone)
		})

		simulationRef.current.on('tick.boundary', () => {
			forces.boundaryRepel?.()
		})

		// User tick handler
		if (config.onTick) {
			simulationRef.current.on('tick.user', config.onTick)
		}

		// End handler
		if (config.onEnd) {
			simulationRef.current.on('end', config.onEnd)
		}

		if (config.debug) {
			console.log('[Simulation] Created with', nodes.length, 'nodes and', edges.length, 'edges')
		}

		return () => {
			if (simulationRef.current) {
				simulationRef.current.stop()
			}
		}
	}, [nodes, edges, forces, config.onTick, config.onEnd, config.debug])

	// Update zones for zone-based forces
	const updateZones = (zones: any[]) => {
		zoneByIdRef.current.clear()
		zones.forEach(zone => {
			zoneByIdRef.current.set(zone.id, zone)
		})
	}

	// Control methods
	const restart = () => {
		simulationRef.current?.restart()
	}

	const stop = () => {
		simulationRef.current?.stop()
	}

	const alpha = (value?: number) => {
		if (value !== undefined) {
			simulationRef.current?.alpha(value)
			return simulationRef.current
		}
		return simulationRef.current?.alpha() || 0
	}

	const alphaTarget = (value?: number) => {
		if (value !== undefined) {
			simulationRef.current?.alphaTarget(value)
			return simulationRef.current
		}
		return simulationRef.current?.alphaTarget() || 0
	}

	return {
		simulation: simulationRef.current,
		updateZones,
		restart,
		stop,
		alpha,
		alphaTarget
	}
}
