import * as d3 from 'd3'

export interface EdgeData {
	id: string
	source: string | any
	target: string | any
	rule?: string
	type?: string
	color?: string
}

export interface RiverConfig {
	enabled: boolean
	opacity: number
	width: number
}

export function renderEdges(
	root: d3.Selection<SVGGElement, any, any, any>,
	edges: EdgeData[],
	rivers: RiverConfig = { enabled: false, opacity: 0.3, width: 8 }
) {
	const linkGroup = root.append('g').attr('class', 'links')

	// Main edges
	const links = linkGroup
		.selectAll<SVGLineElement, EdgeData>('.link')
		.data(edges)
		.join('line')
		.attr('class', 'link')
		.attr('stroke', (d) => d.color || '#999')
		.attr('stroke-width', 2)
		.attr('stroke-opacity', 0.6)
		.attr('marker-end', 'url(#arrow)')

	// Rivers (flow visualization)
	if (rivers.enabled) {
		const riverGroup = linkGroup.append('g').attr('class', 'rivers')
		riverGroup
			.selectAll<SVGLineElement, EdgeData>('.river')
			.data(edges)
			.join('line')
			.attr('class', 'river')
			.attr('stroke', (d) => d.color || '#66c')
			.attr('stroke-width', rivers.width)
			.attr('stroke-opacity', rivers.opacity)
			.style('pointer-events', 'none')
	}

	return { linkGroup, links }
}

export function updateEdgePositions(
	links: d3.Selection<SVGLineElement, EdgeData, any, any>,
	rivers?: d3.Selection<SVGLineElement, EdgeData, any, any>
) {
	links
		.attr('x1', (d: any) => d.source.x)
		.attr('y1', (d: any) => d.source.y)
		.attr('x2', (d: any) => d.target.x)
		.attr('y2', (d: any) => d.target.y)

	if (rivers) {
		rivers
			.attr('x1', (d: any) => d.source.x)
			.attr('y1', (d: any) => d.source.y)
			.attr('x2', (d: any) => d.target.x)
			.attr('y2', (d: any) => d.target.y)
	}
}
