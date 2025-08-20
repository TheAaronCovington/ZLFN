import * as d3 from 'd3'

export type Zone = { id: string; name: string; color: string; xRange: [number, number]; yRange: [number, number] }

export function renderZones(
	root: d3.Selection<SVGGElement, any, any, any>,
	zones: Zone[]
) {
	const zoneGroup = root.append('g').attr('class', 'zones')
	zoneGroup
		.selectAll<SVGRectElement, Zone>('.zone')
		.data(zones)
		.join('rect')
		.attr('class', 'zone')
		.attr('x', (d) => d.xRange[0])
		.attr('y', (d) => d.yRange[0])
		.attr('width', (d) => d.xRange[1] - d.xRange[0])
		.attr('height', (d) => d.yRange[1] - d.yRange[0])
		.attr('fill', (d) => d.color)
		.attr('fill-opacity', 0.08)
		.attr('stroke', (d) => d.color)
		.attr('stroke-opacity', 0.25)
		.attr('stroke-width', 2)
		.attr('rx', 8)

	zoneGroup
		.selectAll<SVGTextElement, Zone>('.zone-label')
		.data(zones)
		.join('text')
		.attr('class', 'zone-label')
		.attr('x', (d) => (d.xRange[0] + d.xRange[1]) / 2)
		.attr('y', (d) => d.yRange[0] - 10)
		.attr('text-anchor', 'middle')
		.attr('fill', (d) => d.color)
		.attr('data-base-size', 12)
		.attr('font-weight', 'bold')
		.text((d) => d.name)

	return zoneGroup
}
