import React from 'react'
import * as d3 from 'd3'
import { Box, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material'
import type { AstNodeRec } from '../../services/logic'

export interface SemanticTableauProps {
	// Prefer reusing the current expression/AST from the visualizer
	expression: string
	ast: AstNodeRec | null
}

type TableauNode = {
	id: string
	label: string
	type: 'root' | 'open' | 'closed' | 'intermediate'
	children?: TableauNode[]
}

// Very lightweight AST → Tableau scaffold. This purposefully reuses the parsed AST
// and maps it to a simple tree so we can render a usable STN without duplicating logic.
function astToTableau(ast: AstNodeRec): TableauNode {
	const map = (node: AstNodeRec, depth: number): TableauNode => {
		const label = node.label || node.id || '?'
		const isLeaf = !node.children || node.children.length === 0
		const t: TableauNode = {
			id: node.id || `${label}-${depth}-${Math.random().toString(36).slice(2, 7)}`,
			label,
			type: depth === 0 ? 'root' : (isLeaf ? 'open' : 'intermediate')
		}
		if (node.children && node.children.length > 0) {
			t.children = node.children.map((c) => map(c as AstNodeRec, depth + 1))
		}
		return t
	}
	return map(ast, 0)
}

export const SemanticTableau: React.FC<SemanticTableauProps> = ({ expression, ast }) => {
	const containerRef = React.useRef<HTMLDivElement | null>(null)
	const svgRef = React.useRef<SVGSVGElement | null>(null)
	const [layoutMode, setLayoutMode] = React.useState<'tree' | 'hierarchy'>('tree')

	// Resize observer to keep the canvas responsive, reusing our typical pattern
	const [size, setSize] = React.useState({ width: 1000, height: 600 })
	React.useEffect(() => {
		const el = containerRef.current
		if (!el) return
		const ro = new ResizeObserver(() => {
			setSize({ width: el.clientWidth || 1000, height: el.clientHeight || 600 })
		})
		ro.observe(el)
		return () => ro.disconnect()
	}, [])

	// Render the tableau using d3.tree() to avoid duplicating D3 scaffolding elsewhere
	React.useEffect(() => {
		const svg = d3.select(svgRef.current)
		svg.selectAll('*').remove()

		if (!ast) {
			// Empty state
			svg
				.append('text')
				.attr('x', size.width / 2)
				.attr('y', size.height / 2)
				.attr('text-anchor', 'middle')
				.attr('fill', 'rgba(255,255,255,0.6)')
				.text('Enter a logical expression to render a Semantic Tableau')
			return
		}

		const rootData = astToTableau(ast)
		const root = d3.hierarchy<TableauNode>(rootData)
		const treeLayout = d3.tree<TableauNode>().nodeSize([28, 80])
		const tree = treeLayout(root)

		const g = svg
			.append('g')
			.attr('transform', `translate(${size.width / 2}, 40)`) // center horizontally, leave padding top

		// Links (branches)
		g.selectAll('path.link')
			.data(tree.links())
			.enter()
			.append('path')
			.attr('class', 'link')
			.attr('fill', 'none')
			.attr('stroke', 'rgba(255,255,255,0.3)')
			.attr('stroke-width', 1.5)
			.attr('d', (d: any) =>
				`M${d.source.x},${d.source.y} C ${d.source.x},${(d.source.y + d.target.y) / 2} ${d.target.x},${(d.source.y + d.target.y) / 2} ${d.target.x},${d.target.y}`
			)

		// Nodes
		const node = g
			.selectAll('g.node')
			.data(tree.descendants())
			.enter()
			.append('g')
			.attr('class', 'node')
			.attr('transform', (d: any) => `translate(${d.x}, ${d.y})`)

		node
			.append('circle')
			.attr('r', (d: any) => (d.depth === 0 ? 16 : 12))
			.attr('fill', (d: any) => {
				const t = d.data.type
				if (t === 'root') return 'rgba(64,196,255,0.35)'
				if (t === 'closed') return 'rgba(255,82,82,0.35)'
				if (t === 'open') return 'rgba(76,175,80,0.35)'
				return 'rgba(255,255,255,0.18)'
			})
			.attr('stroke', 'rgba(255,255,255,0.45)')
			.attr('stroke-width', (d: any) => (d.depth === 0 ? 2 : 1))

		node
			.append('text')
			.attr('y', -18)
			.attr('text-anchor', 'middle')
			.attr('fill', 'rgba(255,255,255,0.85)')
			.attr('font-size', 11)
			.text((d: any) => d.data.label)

		node
			.append('text')
			.attr('y', 24)
			.attr('text-anchor', 'middle')
			.attr('fill', 'rgba(255,255,255,0.45)')
			.attr('font-size', 10)
			.text((d: any) => (d.data.type === 'root' ? 'Root' : d.data.type))
	}, [ast, size.width, size.height, layoutMode, expression])

	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }} ref={containerRef}>
			<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5 }}>
				<Tooltip title="Toggle layout mode">
					<ToggleButtonGroup
						value={layoutMode}
						exclusive
						onChange={(_, v) => v && setLayoutMode(v)}
						size="small"
						color="primary"
					>
						<ToggleButton value="tree">Tree</ToggleButton>
						<ToggleButton value="hierarchy">Hierarchy</ToggleButton>
					</ToggleButtonGroup>
				</Tooltip>
				<span style={{ fontSize: 12, opacity: 0.7 }}>Semantic Tableau • {expression || '—'}</span>
			</Box>
			<Box sx={{ flex: 1, position: 'relative' }}>
				<svg ref={svgRef} width={size.width} height={size.height} />
			</Box>
		</Box>
	)
}

export default SemanticTableau


