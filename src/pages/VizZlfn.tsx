import React from 'react'
import { ZlfnGraphWithNotes } from '../components/Visualizations/ZlfnGraphWithNotes'
import type { ZlfnEdge, ZlfnNode } from '../components/Visualizations/ZlfnGraph'
import { useLogicShared } from '../context/LogicSharedContext'
import { Button, Stack, Typography, IconButton, Tooltip } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import NeonCard from '../components/UI/NeonCard'

const VizZlfn: React.FC = () => {
	const { simulationMode, setSimulationMode, resetStates } = useLogicShared()

	const nodes: ZlfnNode[] = [
		{ id: 'premise1', label: 'P1', color: '#20B2AA', type: 'premise', size: { width: 100, height: 30 } },
		{ id: 'term1', label: 'T1', color: '#4169E1', type: 'term', size: { radius: 20 } },
		{ id: 'conclusion', label: 'C', color: '#9370DB', type: 'conclusion', size: { width: 100, height: 30 } },
		{ id: 'conclusion2', label: 'C2', color: '#8e7cc3', type: 'conclusion', size: { width: 100, height: 30 } },
		{ id: 'fallacy1', label: 'F1', color: '#DC143C', type: 'fallacy', size: { width: 100, height: 30 } },
	]
	const edges: ZlfnEdge[] = [
		{ from: 'premise1', to: 'term1', weight: 85, style: 'solid', rule: 'Modus Ponens' },
		{ from: 'term1', to: 'conclusion', weight: 75, style: 'dashed', rule: 'Hypothetical Syllogism' },
		{ from: 'term1', to: 'conclusion2', weight: 72, style: 'solid', rule: 'Inference' },
		{ from: 'fallacy1', to: 'term1', weight: 50, style: 'dotted', rule: 'Fallacy Link', type: 'counterexample' },
	]

	return (
		<div style={{ maxWidth: 1200, margin: '0 auto', padding: '1rem' }}>
			<Typography variant="h5" sx={{ mb: 2 }}>ZLFN Graph (Demo)</Typography>
			<Stack direction="row" spacing={1} sx={{ mb: 2 }}>
				<Button size="small" variant={simulationMode ? 'contained' : 'outlined'} onClick={() => setSimulationMode(!simulationMode)}>
					Simulation Mode
				</Button>
				<Button size="small" variant="outlined" onClick={resetStates}>Reset States</Button>
				<Tooltip title="Advanced Search">
					<IconButton size="small" onClick={() => {
						// Dispatch a custom event that ZlfnGraph listens to to open advanced search
						window.dispatchEvent(new CustomEvent('zlfn:open-advanced-search'))
					}}>
						<SearchIcon />
					</IconButton>
				</Tooltip>
			</Stack>
			<NeonCard sx={{ position: 'relative', overflow: 'visible' }} contentSx={{ p: 0, '&:last-child': { pb: 0 } }}>
				<ZlfnGraphWithNotes nodes={nodes} edges={edges} storageKey="/vis/zlfn" objectId="/vis/zlfn" showNotesIndicators={true} />
			</NeonCard>
		</div>
	)
}

export default VizZlfn


