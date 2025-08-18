import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useResizeObserver } from '../../hooks/useResizeObserver'
import { useLogicShared } from '../../context/LogicSharedContext'

export type AstNodeRec = {
	id: string
	label: string
	children?: AstNodeRec[]
}

export interface ASTTreeProps {
	roots: AstNodeRec[]
}

export const ASTTree: React.FC<ASTTreeProps> = ({ roots }) => {
	const { elementRef, size } = useResizeObserver<HTMLDivElement>()
	const svgRef = useRef<SVGSVGElement | null>(null)
	const { selectedNodeId, setSelectedNodeId } = useLogicShared()
	const [tooltip, setTooltip] = useState<{ x: number; y: number; html: string } | null>(null)

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
		const width = Math.max(size.width || 800, 400)
		const height = Math.max(size.height || 560, 300)
		svg.attr('width', width).attr('height', height)

		svg.selectAll('*').remove()
		const g = svg.append('g')

		const zoom = d3.zoom<SVGSVGElement, unknown>().on('zoom', ({ transform }) => {
			g.attr('transform', transform.toString())
		})
		svg.call(zoom as any)

		const bandHeight = height / Math.max(1, roots.length)
		const nodeRadius = 14

		roots.forEach((root, idx) => {
			const tree = d3.tree<AstNodeRec>().nodeSize([28, 120])
			const hierarchy = d3.hierarchy(root)
			const layout = tree(hierarchy)

			const yOffset = bandHeight * idx + bandHeight / 2
			const xOffset = 80

			// links
			g
				.append('g')
				.selectAll('path')
				.data(layout.links())
				.join('path')
				.attr('fill', 'none')
				.attr('stroke', 'url(#astLinkGrad)')
				.attr('stroke-width', 2)
				.attr('d', d => {
					const sx = xOffset + d.source.depth * 120
					const sy = yOffset + (d.source as any).x
					const tx = xOffset + d.target.depth * 120
					const ty = yOffset + (d.target as any).x
					return `M ${sx},${sy} C ${(sx + tx) / 2},${sy} ${(sx + tx) / 2},${ty} ${tx},${ty}`
				})

			// nodes
			const nodeG = g
				.append('g')
				.selectAll('g.node')
				.data(layout.descendants())
				.join('g')
				.attr('class', 'node')
				.attr('transform', (d: any) => `translate(${xOffset + d.depth * 120},${yOffset + d.x})`)
				.style('cursor', 'pointer')
				.on('click', (_, d: any) => {
					const id = d.data.id as string
					setSelectedNodeId(selectedNodeId === id ? null : id)
				})
				.on('mouseover', (event: any, d: any) => {
					const isOp = Array.isArray(d.data.children) && d.data.children.length > 0
					const arity = isOp ? d.data.children.length : 0
					const opName = isOp ? (d.data.label === '¬' ? 'Negation' : d.data.label === '∧' ? 'Conjunction' : d.data.label === '∨' ? 'Disjunction' : d.data.label === '→' ? 'Implication' : d.data.label === '↔' ? 'Biconditional' : 'Operator') : 'Variable'
					const html = isOp ? `<strong>${opName}</strong><br/>Arity: ${arity}` : `<strong>${d.data.label}</strong><br/>Variable`
					setTooltip({ x: event.pageX + 10, y: event.pageY - 10, html })
				})
				.on('mouseout', () => setTooltip(null))

			nodeG
				.append('circle')
				.attr('r', nodeRadius)
				.attr('fill', (d: any) => (d.children ? '#40c4ff' : '#00e676'))
				.attr('stroke', (d: any) => (selectedNodeId === d.data.id ? '#ff4081' : '#fff'))
				.attr('stroke-width', (d: any) => (selectedNodeId === d.data.id ? 3 : 1.5))

			nodeG
				.append('text')
				.attr('dy', -nodeRadius - 4)
				.attr('text-anchor', 'middle')
				.attr('fill', '#e8f4ff')
				.attr('font-size', 12)
				.attr('font-weight', 600)
				.text((d: any) => d.data.label)
		})

		// defs gradient for links
		const defsSel = svg.select('defs')
		const defs = defsSel.empty() ? svg.append('defs') : defsSel
		let linkGrad = defs.select<SVGLinearGradientElement>('linearGradient#astLinkGrad')
		if (linkGrad.empty()) {
			linkGrad = defs.append('linearGradient').attr('id', 'astLinkGrad')
			linkGrad.append('stop').attr('offset', '0%').attr('stop-color', '#40c4ff')
			linkGrad.append('stop').attr('offset', '100%').attr('stop-color', '#00e676')
		}
	}, [roots, size, selectedNodeId, setSelectedNodeId])

	useEffect(() => {
		// update selection styling without full redraw
		if (!svgRef.current) return
		const g = d3.select(svgRef.current).select('g')
		g.selectAll('.node')
			.selectAll('circle')
			.attr('stroke', (d: any) => (selectedNodeId === d.data.id ? '#ff4081' : '#fff'))
			.attr('stroke-width', (d: any) => (selectedNodeId === d.data.id ? 3 : 1.5))
	}, [selectedNodeId])

	return (
		<div ref={elementRef} style={{ width: '100%', height: 560, position: 'relative' }}>
			{tooltip && (
				<div
					style={{
						position: 'absolute',
						left: tooltip.x,
						top: tooltip.y,
						background: 'rgba(30, 30, 47, 0.95)',
						border: '1px solid var(--ai-purple)',
						borderRadius: 8,
						padding: '8px 12px',
						color: 'var(--ai-text-primary)',
						fontSize: 12,
						pointerEvents: 'none',
						zIndex: 10,
						maxWidth: 300
					}}
					dangerouslySetInnerHTML={{ __html: tooltip.html }}
				/>
			)}
		</div>
	)
}

export default ASTTree


