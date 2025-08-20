import * as d3 from 'd3'

export interface LabelData {
	id: string
	sourceId: string
	targetId: string
	rule?: string
	text: string
	x?: number
	y?: number
}

export interface LabelConfig {
	fontSize: number
	padding: number
	backgroundColor: string
	textColor: string
	borderColor: string
}

export function renderEdgeLabels(
	root: d3.Selection<SVGGElement, any, any, any>,
	labels: LabelData[],
	config: LabelConfig = {
		fontSize: 10,
		padding: 4,
		backgroundColor: '#fff',
		textColor: '#333',
		borderColor: '#ccc'
	}
) {
	// Remove any existing label layer
	root.select('g.link-labels').remove()

	const labelGroup = root.append('g')
		.attr('class', 'link-labels')
		.style('pointer-events', 'none')

	const labelEnter = labelGroup
		.selectAll<SVGGElement, LabelData>('.link-label')
		.data(labels, (d: LabelData) => d.id)
		.join('g')
		.attr('class', 'link-label')

	// Background rectangle
	labelEnter.append('rect')
		.attr('class', 'label-bg')
		.attr('fill', config.backgroundColor)
		.attr('stroke', config.borderColor)
		.attr('stroke-width', 1)
		.attr('rx', 3)

	// Text
	labelEnter.append('text')
		.attr('class', 'label-text')
		.attr('text-anchor', 'middle')
		.attr('dy', '.35em')
		.attr('font-size', config.fontSize)
		.attr('fill', config.textColor)
		.text(d => d.text)

	// Size backgrounds based on text
	labelEnter.each(function(_d) {
		const group = d3.select(this)
		const text = group.select('text').node() as SVGTextElement
		const bbox = text?.getBBox() || { width: 0, height: 0 }
		
		group.select('rect')
			.attr('x', -bbox.width / 2 - config.padding)
			.attr('y', -bbox.height / 2 - config.padding / 2)
			.attr('width', bbox.width + config.padding * 2)
			.attr('height', bbox.height + config.padding)
	})

	return { labelGroup, labelEnter }
}

export function updateLabelPositions(
	labels: d3.Selection<SVGGElement, LabelData, any, any>,
	edges: any[]
) {
	labels.attr('transform', function(d) {
		// Find the corresponding edge
		const edge = edges.find(e => 
			(e.source.id === d.sourceId && e.target.id === d.targetId) ||
			(e.source === d.sourceId && e.target === d.targetId)
		)
		
		if (!edge) return 'translate(0,0)'

		// Calculate midpoint with slight offset
		const sourceX = edge.source.x || 0
		const sourceY = edge.source.y || 0
		const targetX = edge.target.x || 0
		const targetY = edge.target.y || 0
		
		const midX = (sourceX + targetX) / 2
		const midY = (sourceY + targetY) / 2
		
		// Add small perpendicular offset to avoid overlap
		const dx = targetX - sourceX
		const dy = targetY - sourceY
		const length = Math.sqrt(dx * dx + dy * dy)
		
		if (length > 0) {
			const offsetX = (-dy / length) * 8 // Perpendicular offset
			const offsetY = (dx / length) * 8
			return `translate(${midX + offsetX}, ${midY + offsetY})`
		}
		
		return `translate(${midX}, ${midY})`
	})
}

export function createLabelCollisionAvoidance(
	labels: d3.Selection<SVGGElement, LabelData, any, any>,
	config: { iterations: number; strength: number } = { iterations: 3, strength: 0.5 }
) {
	// Simple collision detection and resolution
	const labelNodes = labels.nodes()
	
	for (let iter = 0; iter < config.iterations; iter++) {
		for (let i = 0; i < labelNodes.length; i++) {
			for (let j = i + 1; j < labelNodes.length; j++) {
				const nodeA = labelNodes[i]
				const nodeB = labelNodes[j]
				
				const rectA = nodeA.querySelector('rect')?.getBBox()
				const rectB = nodeB.querySelector('rect')?.getBBox()
				
				if (!rectA || !rectB) continue
				
				const transformA = nodeA.getAttribute('transform') || 'translate(0,0)'
				const transformB = nodeB.getAttribute('transform') || 'translate(0,0)'
				
				const matchA = transformA.match(/translate\(([^,]+),([^)]+)\)/)
				const matchB = transformB.match(/translate\(([^,]+),([^)]+)\)/)
				
				if (!matchA || !matchB) continue
				
				const xA = parseFloat(matchA[1])
				const yA = parseFloat(matchA[2])
				const xB = parseFloat(matchB[1])
				const yB = parseFloat(matchB[2])
				
				// Check for overlap
				const dx = xB - xA
				const dy = yB - yA
				const distance = Math.sqrt(dx * dx + dy * dy)
				const minDistance = Math.max(rectA.width, rectA.height, rectB.width, rectB.height) / 2 + 5
				
				if (distance < minDistance && distance > 0) {
					// Push apart
					const pushX = (dx / distance) * (minDistance - distance) * config.strength
					const pushY = (dy / distance) * (minDistance - distance) * config.strength
					
					d3.select(nodeA).attr('transform', `translate(${xA - pushX}, ${yA - pushY})`)
					d3.select(nodeB).attr('transform', `translate(${xB + pushX}, ${yB + pushY})`)
				}
			}
		}
	}
}
