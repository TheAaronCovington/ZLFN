import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { useResizeObserver } from '../../hooks/useResizeObserver'

export type HeatmapDatum = { x: number; y: number; value: number }

export interface HeatmapProps {
	data: HeatmapDatum[]
	xSize: number
	ySize: number
}

export const Heatmap: React.FC<HeatmapProps> = ({ data, xSize, ySize }) => {
	const { elementRef, size } = useResizeObserver<HTMLDivElement>()
	const svgRef = useRef<SVGSVGElement | null>(null)

	useEffect(() => {
		if (!elementRef.current || svgRef.current) return
		svgRef.current = d3
			.select(elementRef.current)
			.append('svg')
			.attr('class', 'd3-container')
			.node() as SVGSVGElement
		return () => {
			d3.select(svgRef.current).remove()
			svgRef.current = null
		}
	}, [elementRef])

	useEffect(() => {
		const svg = d3.select(svgRef.current)
		if (!svg.node()) return
		const width = Math.max(size.width || 600, 300)
		const height = Math.max(size.height || 400, 200)
		svg.attr('width', width).attr('height', height)

		svg.selectAll('*').remove()

		const margin = { top: 20, right: 20, bottom: 30, left: 30 }
		const innerW = width - margin.left - margin.right
		const innerH = height - margin.top - margin.bottom

		const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

		const x = d3.scaleBand().domain(d3.range(xSize).map(String)).range([0, innerW]).padding(0.05)
		const y = d3.scaleBand().domain(d3.range(ySize).map(String)).range([0, innerH]).padding(0.05)
		const maxV = d3.max(data, d => d.value) ?? 1
		const color = d3.scaleSequential(d3.interpolateTurbo).domain([0, maxV])

		g.selectAll('rect')
			.data(data)
			.join('rect')
			.attr('x', d => x(String(d.x)) ?? 0)
			.attr('y', d => y(String(d.y)) ?? 0)
			.attr('width', x.bandwidth())
			.attr('height', y.bandwidth())
			.attr('fill', d => color(d.value))
			.attr('stroke', 'rgba(0,0,0,0.2)')
			.append('title')
			.text(d => `(${d.x}, ${d.y}): ${d.value}`)

		const ax = d3.axisBottom(x).tickValues(x.domain().filter((_, i) => xSize <= 20 || i % Math.ceil(xSize / 20) === 0))
		const ay = d3.axisLeft(y).tickValues(y.domain().filter((_, i) => ySize <= 20 || i % Math.ceil(ySize / 20) === 0))

		g.append('g').attr('transform', `translate(0,${innerH})`).call(ax as any)
		g.append('g').call(ay as any)
	}, [data, xSize, ySize, size])

	return <div ref={elementRef} style={{ width: '100%', height: 420 }} />
}

export default Heatmap


