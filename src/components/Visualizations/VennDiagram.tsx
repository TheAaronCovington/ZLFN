import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { Button, Stack } from '@mui/material'
import './VennDiagram.css'

export type VennSet = {
	label: string
	items: string[]
	color: string
	position?: { x: number; y: number; radius: number }
}

export type NecessarySufficientExample = {
	id: string
	title: string
	necessary: string
	sufficient: string
}

export type VennDiagramData = {
	description?: string
	sets: VennSet[]
	intersection?: string[]
	currentExample?: NecessarySufficientExample
}

export interface VennDiagramProps {
	title?: string
	data: VennDiagramData
	type?: string
	examples?: NecessarySufficientExample[]
}

const WIDTH = 300
const HEIGHT = 200

export const VennDiagram: React.FC<VennDiagramProps> = ({ title = '', data, type = '', examples = [] }) => {
	const svgRef = useRef<SVGSVGElement | null>(null)
	const [currentExampleId, setCurrentExampleId] = useState<string>('')
	const [model, setModel] = useState<VennDiagramData>(() => ({ ...data }))

	useEffect(() => {
		// init example
		if (examples.length > 0 && !model.currentExample) {
			setCurrentExampleId(examples[0].id)
			setModel(prev => ({ ...prev, currentExample: examples[0] }))
		}
	}, [examples])

	useEffect(() => {
		const svg = d3.select(svgRef.current)
		if (!svg.node()) return

		svg.attr('width', WIDTH).attr('height', HEIGHT).attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
		svg.selectAll('*').remove()

		// gradient for intersection
		const defs = svg.append('defs')
		const grad = defs
			.append('linearGradient')
			.attr('id', 'intersectionGradient')
			.attr('gradientUnits', 'userSpaceOnUse')
			.attr('x1', 0)
			.attr('y1', 0)
			.attr('x2', WIDTH)
			.attr('y2', HEIGHT)
		grad.append('stop').attr('offset', '0%').attr('stop-color', '#40c4ff').attr('stop-opacity', 0.6)
		grad.append('stop').attr('offset', '100%').attr('stop-color', '#00e676').attr('stop-opacity', 0.6)

		if (type === 'necessary-sufficient') {
			renderNecessarySufficient(svg)
		} else {
			const normalized = ensurePositions(model)
			renderSets(svg, normalized)
			if (normalized.sets.length === 2 && normalized.intersection?.length) {
				renderIntersection(svg, normalized)
			}
		}

		animate(svg)
	}, [model, type])

	const ensurePositions = (d: VennDiagramData): VennDiagramData => {
		const copy: VennDiagramData = { ...d, sets: d.sets.map(s => ({ ...s, position: s.position ? { ...s.position } : undefined })) }
		if (copy.sets.length === 2) {
			if (!copy.sets[0].position) copy.sets[0].position = { x: WIDTH * 0.35, y: HEIGHT * 0.5, radius: 60 }
			if (!copy.sets[1].position) copy.sets[1].position = { x: WIDTH * 0.65, y: HEIGHT * 0.5, radius: 60 }
		} else if (copy.sets.length === 3) {
			if (!copy.sets[0].position) copy.sets[0].position = { x: WIDTH * 0.35, y: HEIGHT * 0.35, radius: 50 }
			if (!copy.sets[1].position) copy.sets[1].position = { x: WIDTH * 0.65, y: HEIGHT * 0.35, radius: 50 }
			if (!copy.sets[2].position) copy.sets[2].position = { x: WIDTH * 0.5, y: HEIGHT * 0.7, radius: 50 }
		}
		return copy
	}

	const renderNecessarySufficient = (svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>) => {
		const cx = WIDTH / 2
		const cy = HEIGHT / 2
		const outerR = 70
		const innerR = 45
		svg
			.append('circle')
			.attr('cx', cx)
			.attr('cy', cy)
			.attr('r', outerR)
			.attr('fill', '#40c4ff')
			.attr('fill-opacity', 0.2)
			.attr('stroke', '#40c4ff')
			.attr('stroke-width', 2)
			.attr('class', 'necessary-circle')

		svg
			.append('circle')
			.attr('cx', cx)
			.attr('cy', cy)
			.attr('r', innerR)
			.attr('fill', '#00e676')
			.attr('fill-opacity', 0.4)
			.attr('stroke', '#00e676')
			.attr('stroke-width', 2)
			.attr('class', 'sufficient-circle')

		svg
			.append('text')
			.attr('x', cx)
			.attr('y', cy - outerR - 15)
			.attr('text-anchor', 'middle')
			.attr('class', 'venn-label')
			.style('fill', 'var(--ai-text-primary)')
			.style('font-size', '14px')
			.style('font-weight', '600')
			.text('Necessary & Sufficient Conditions')
	}

	const renderSets = (svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>, d: VennDiagramData) => {
		d.sets.forEach((set, i) => {
			if (!set.position) return
			const group = svg.append('g').attr('class', `venn-group-${i}`)
			group
				.append('circle')
				.attr('cx', set.position.x)
				.attr('cy', set.position.y)
				.attr('r', set.position.radius)
				.attr('fill', set.color)
				.attr('stroke', set.color)
				.attr('class', 'venn-circle')
				.style('cursor', 'pointer')
				.on('mouseover', event => {
					d3.select(event.currentTarget).transition().duration(200).attr('fill-opacity', 0.5).attr('stroke-width', 3)
				})
				.on('mouseout', event => {
					d3.select(event.currentTarget).transition().duration(200).attr('fill-opacity', 0.3).attr('stroke-width', 2)
				})

			group
				.append('text')
				.attr('x', set.position.x)
				.attr('y', set.position.y - set.position.radius - 15)
				.attr('class', 'venn-label')
				.text(set.label)

			if (set.items.length <= 3) {
				set.items.forEach((item, idx) => {
					group
						.append('text')
						.attr('x', set.position!.x)
						.attr('y', set.position!.y - 10 + idx * 12)
						.attr('class', 'venn-item')
						.text(item.length > 12 ? item.substring(0, 12) + '...' : item)
				})
			} else {
				group
					.append('text')
					.attr('x', set.position.x)
					.attr('y', set.position.y)
					.attr('class', 'venn-item')
					.style('font-weight', 'bold')
					.text(`${set.items.length} items`)
			}
		})
	}

	const renderIntersection = (svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>, d: VennDiagramData) => {
		const a = d.sets[0].position!
		const b = d.sets[1].position!
		const dist = Math.hypot(b.x - a.x, b.y - a.y)
		if (dist < a.radius + b.radius) {
			const midX = (a.x + b.x) / 2
			const midY = (a.y + b.y) / 2
			svg
				.append('ellipse')
				.attr('cx', midX)
				.attr('cy', midY)
				.attr('rx', 25)
				.attr('ry', 15)
				.attr('class', 'intersection-area')
			if (d.intersection && d.intersection.length) {
				svg
					.append('text')
					.attr('x', midX)
					.attr('y', midY)
					.attr('class', 'venn-item')
					.style('fill', 'var(--ai-green)')
					.style('font-weight', 'bold')
					.text(d.intersection[0])
			}
		}
	}

	const animate = (svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>) => {
		svg
			.selectAll('.venn-circle')
			.style('opacity', 0)
			.transition()
			.duration(600)
			.delay((_, i) => i * 200)
			.style('opacity', 1)
			.attr('transform', 'scale(1)')
			.ease(d3.easeBackOut)

		svg
			.selectAll('.venn-label, .venn-item')
			.style('opacity', 0)
			.transition()
			.duration(400)
			.delay(800)
			.style('opacity', 1)
	}

	const necessaryLabel = useMemo(() => {
		const text = model.currentExample?.necessary?.trim()
		if (!text) return 'X'
		return text.split(/[\s(]/)[0]
	}, [model])

	const sufficientLabel = useMemo(() => {
		const text = model.currentExample?.sufficient?.trim()
		if (!text) return 'Y'
		return text.split(/[\s(]/)[0]
	}, [model])

	const legendTooltip = (kind: 'necessary' | 'sufficient') => {
		if (!model.currentExample) return kind === 'necessary' ? 'Necessary Condition' : 'Sufficient Condition'
		const condition = kind === 'necessary' ? model.currentExample.necessary : model.currentExample.sufficient
		const role = kind === 'necessary' ? 'Necessary Condition' : 'Sufficient Condition'
		return `${role}: ${condition}`
	}

	return (
		<div className="venn-diagram-container">
			<div className="venn-header">
				<h4 className="venn-title">{title}</h4>
				{model.description && <p className="venn-description">{model.description}</p>}
			</div>

			<div className="venn-svg-container">
				<svg ref={svgRef} className="venn-svg" />
				<div className="diagram-legend">
					<div className="legend-item" data-tooltip={legendTooltip('necessary')}>
						<span className="legend-color necessary-color" />
						<span className="legend-text">{necessaryLabel}</span>
					</div>
					<div className="legend-item" data-tooltip={legendTooltip('sufficient')}>
						<span className="legend-color sufficient-color" />
						<span className="legend-text">{sufficientLabel}</span>
					</div>
				</div>
			</div>

			{type === 'necessary-sufficient' && examples.length > 0 && (
				<div className="examples-section">
					<h5 className="examples-title">Examples</h5>
					<Stack direction="column" spacing={1} className="examples-grid">
						{examples.map(ex => (
							<Button
								key={ex.id}
								variant={currentExampleId === ex.id ? 'contained' : 'outlined'}
								size="small"
								className="example-btn"
								onClick={() => {
									setCurrentExampleId(ex.id)
									setModel(prev => ({ ...prev, currentExample: ex }))
								}}
							>
								{ex.title}
							</Button>
						))}
					</Stack>
				</div>
			)}
		</div>
	)
}

export default VennDiagram


