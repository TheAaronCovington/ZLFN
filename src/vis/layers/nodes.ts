import * as d3 from 'd3'

export interface NodeData {
	id: string
	label?: string
	type?: string
	zone?: string
	zoneId?: string
	x?: number
	y?: number
	fx?: number | null
	fy?: number | null
	size?: { width: number; height: number }
	color?: string
	pinned?: boolean
}

export interface NodeRenderConfig {
	showLabels: boolean
	fontSize: number
	nodeRadius: number
}

export function renderNodes(
	root: d3.Selection<SVGGElement, any, any, any>,
	nodes: NodeData[],
	config: NodeRenderConfig = { showLabels: true, fontSize: 12, nodeRadius: 8 }
) {
	const nodeGroup = root.append('g').attr('class', 'nodes')

	const nodeEnter = nodeGroup
		.selectAll<SVGGElement, NodeData>('.node')
		.data(nodes)
		.join('g')
		.attr('class', 'node')
		.attr('id', (d) => `node-${d.id}`)

	// Node shapes (circles or rectangles based on type)
	nodeEnter.each(function(d) {
		const node = d3.select(this)
		
		if (d.size) {
			// Rectangle nodes
			node.append('rect')
				.attr('width', d.size.width)
				.attr('height', d.size.height)
				.attr('x', -d.size.width / 2)
				.attr('y', -d.size.height / 2)
				.attr('fill', d.color || '#69b3a2')
				.attr('stroke', '#333')
				.attr('stroke-width', 1)
				.attr('rx', 4)
		} else {
			// Circle nodes
			node.append('circle')
				.attr('r', config.nodeRadius)
				.attr('fill', d.color || '#69b3a2')
				.attr('stroke', '#333')
				.attr('stroke-width', 1)
		}

		// Labels
		if (config.showLabels && d.label) {
			node.append('text')
				.attr('class', 'node-label')
				.attr('text-anchor', 'middle')
				.attr('dy', '.35em')
				.attr('font-size', config.fontSize)
				.attr('fill', '#333')
				.text(d.label)
		}

		// Facet icons container
		node.append('g')
			.attr('class', 'facet-icons')
			.attr('transform', 'translate(12, -12)')
	})

	return { nodeGroup, nodeEnter }
}

export function updateNodePositions(
	nodes: d3.Selection<SVGGElement, NodeData, any, any>
) {
	nodes.attr('transform', (d: any) => `translate(${d.x || 0}, ${d.y || 0})`)
}

export function setupNodeDrag(
	nodes: d3.Selection<SVGGElement, NodeData, any, any>,
	simulation: d3.Simulation<any, any>,
	onDragStart?: (d: NodeData) => void,
	onDragEnd?: (d: NodeData) => void
) {
	const drag = d3.drag<SVGGElement, NodeData>()
		.on('start', function(event, d) {
			if (!event.active) simulation.alphaTarget(0.3).restart()
			d.fx = d.x
			d.fy = d.y
			onDragStart?.(d)
		})
		.on('drag', function(event, d) {
			d.fx = event.x
			d.fy = event.y
		})
		.on('end', function(event, d) {
			if (!event.active) simulation.alphaTarget(0)
			// Keep pinned if explicitly pinned, otherwise unpin
			if (!d.pinned) {
				d.fx = null
				d.fy = null
			}
			onDragEnd?.(d)
		})

	nodes.call(drag as any)
	return drag
}
