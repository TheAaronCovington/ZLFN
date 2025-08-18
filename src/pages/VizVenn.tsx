import React from 'react'
import VennDiagram from '../components/Visualizations/VennDiagram'
import NeonAccordion from '../components/Accordion/NeonAccordion'
import type { VennDiagramData, NecessarySufficientExample } from '../components/Visualizations/VennDiagram'
import { Typography } from '@mui/material'
import Heatmap from '../components/Visualizations/Heatmap'
import TableauViewer from '../components/Visualizations/TableauViewer'

const VizVenn: React.FC = () => {
	const examples: NecessarySufficientExample[] = [
		{ id: 'e1', title: 'If X then Y', necessary: 'X', sufficient: 'Y' }
	]
	const data: VennDiagramData = {
		description: 'Two sets with intersection',
		sets: [
			{ label: 'X', items: ['x1', 'x2', 'x3'], color: '#40c4ff' },
			{ label: 'Y', items: ['y1'], color: '#00e676' }
		],
		intersection: ['x∧y']
	}

	return (
		<div style={{ maxWidth: 800, margin: '0 auto', padding: '1rem' }}>
			<Typography variant="h5" sx={{ mb: 2 }}>Venn Diagram (Demo)</Typography>
			<VennDiagram title="Necessary & Sufficient" data={data} type="necessary-sufficient" examples={examples} />
			<div style={{ marginTop: '1rem' }}>
				<NeonAccordion items={[
					{ id: 'a1', title: 'What is Necessary?', content: <div>Condition that must hold for another to be possible.</div> },
					{ id: 'a2', title: 'What is Sufficient?', content: <div>Condition that guarantees another.</div> },
				]} />
			</div>
			<div style={{ marginTop: '1rem' }}>
				<Typography variant="h6" sx={{ mb: 1 }}>Heatmap (Demo)</Typography>
				<Heatmap
					data={Array.from({ length: 20 * 10 }, (_, i) => ({ x: i % 20, y: Math.floor(i / 20), value: Math.random() * 100 }))}
					xSize={20}
					ySize={10}
				/>
			</div>
			<div style={{ marginTop: '1rem' }}>
				<Typography variant="h6" sx={{ mb: 1 }}>Embedded (Demo)</Typography>
				<TableauViewer url="https://www.tableau.com/" title="External Content" />
			</div>
		</div>
	)
}

export default VizVenn


