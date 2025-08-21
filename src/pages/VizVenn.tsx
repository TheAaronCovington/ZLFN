import React from 'react'

// Lazy load visualization component
const VennDiagram = React.lazy(() => import('../components/Visualizations/VennDiagram'))
import NeonAccordion from '../components/Accordion/NeonAccordion'
import type { VennDiagramData, NecessarySufficientExample } from '../components/Visualizations/VennDiagram'
import { Typography, CircularProgress, Box } from '@mui/material'
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
			<React.Suspense fallback={
				<Box display="flex" justifyContent="center" alignItems="center" height="300px">
					<CircularProgress size={40} />
				</Box>
			}>
				<VennDiagram title="Necessary & Sufficient" data={data} type="necessary-sufficient" examples={examples} />
			</React.Suspense>
			<div style={{ marginTop: '1rem' }}>
				<NeonAccordion items={[
					{ id: 'a1', title: 'What is Necessary?', content: <div>Condition that must hold for another to be possible.</div> },
					{ id: 'a2', title: 'What is Sufficient?', content: <div>Condition that guarantees another.</div> },
				]} />
			</div>
			<div style={{ marginTop: '1rem' }}>
				<Typography variant="h6" sx={{ mb: 1 }}>Embedded (Demo)</Typography>
				<TableauViewer url="https://www.tableau.com/" title="External Content" />
			</div>
		</div>
	)
}

export default VizVenn


