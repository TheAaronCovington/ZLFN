import * as d3 from 'd3'

export interface ForceConfig {
	linkDistance: number
	linkStrength: number
	chargeStrength: number
	centerStrength: number
	collisionRadius: number
}

export interface BoundaryConfig {
	width: number
	height: number
	padding: number
}

export function createCustomForces(
	nodes: any[],
	_links: any[],
	config: ForceConfig,
	boundary?: BoundaryConfig
) {
	const forces: { [key: string]: any } = {}

	// Standard forces
	forces.link = d3.forceLink(_links)
		.id((d: any) => d.id)
		.distance(config.linkDistance)
		.strength(config.linkStrength)

	forces.charge = d3.forceManyBody()
		.strength(config.chargeStrength)

	forces.center = d3.forceCenter(0, 0)
		.strength(config.centerStrength)

	forces.collision = d3.forceCollide()
		.radius(config.collisionRadius)
		.strength(0.7)

	// Boundary repulsion force
	if (boundary) {
		forces.boundaryRepel = () => {
			for (const node of nodes) {
				if (typeof node.x !== 'number' || typeof node.y !== 'number') continue
				
				const { width, height, padding } = boundary
				const left = -width / 2 + padding
				const right = width / 2 - padding
				const top = -height / 2 + padding
				const bottom = height / 2 - padding

				if (node.x < left) node.vx = (node.vx || 0) + (left - node.x) * 0.1
				if (node.x > right) node.vx = (node.vx || 0) + (right - node.x) * 0.1
				if (node.y < top) node.vy = (node.vy || 0) + (top - node.y) * 0.1
				if (node.y > bottom) node.vy = (node.vy || 0) + (bottom - node.y) * 0.1
			}
		}
	}

	// Zone-specific forces
	forces.zoneAttraction = (zoneById: Map<string, any>) => {
		for (const node of nodes) {
			const zoneId = node.zoneId || node.zone
			if (!zoneId) continue

			const zone = zoneById.get(zoneId)
			if (!zone) continue

			const zoneCenterX = (zone.xRange[0] + zone.xRange[1]) / 2
			const zoneCenterY = (zone.yRange[0] + zone.yRange[1]) / 2

			if (typeof node.x === 'number' && typeof node.y === 'number') {
				const dx = zoneCenterX - node.x
				const dy = zoneCenterY - node.y
				node.vx = (node.vx || 0) + dx * 0.02
				node.vy = (node.vy || 0) + dy * 0.02
			}
		}
	}

	// Terms spreading force (for better distribution in terms zone)
	forces.termsSpread = (termsZone?: any) => {
		if (!termsZone) return

		const termsNodes = nodes.filter(n => (n.zoneId || n.zone) === 'terms')
		if (termsNodes.length <= 1) return

		const left = termsZone.xRange[0] + 30
		const right = termsZone.xRange[1] - 30
		const targetSpacing = (right - left) / (termsNodes.length + 1)

		termsNodes.forEach((node, i) => {
			if (typeof node.x !== 'number') return
			
			const targetX = left + targetSpacing * (i + 1)
			const dx = targetX - node.x
			node.vx = (node.vx || 0) + dx * 0.05
		})
	}

	return forces
}

export function createSimulation(
	nodes: any[],
	_links: any[],
	forces: { [key: string]: any }
) {
	const simulation = d3.forceSimulation(nodes)

	// Add all forces
	Object.entries(forces).forEach(([name, force]) => {
		if (typeof force === 'function' && name.includes('custom')) {
			// Custom forces are added as tick handlers
			simulation.on(`tick.${name}`, force)
		} else {
			// Standard D3 forces
			simulation.force(name, force)
		}
	})

	return simulation
}
