import React from 'react'
import { SpeedDial, SpeedDialAction, SpeedDialIcon } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import ArticleIcon from '@mui/icons-material/Article'
import HubIcon from '@mui/icons-material/Hub'
import DonutLargeIcon from '@mui/icons-material/DonutLarge'
import FunctionsIcon from '@mui/icons-material/Functions'
import ScienceIcon from '@mui/icons-material/Science'
import { useNavigate } from 'react-router-dom'
import { useLogicShared } from '../../context/LogicSharedContext'

const DockBar: React.FC = () => {
	const navigate = useNavigate()
	const { simulationMode, setSimulationMode, resetStates } = useLogicShared()

	return (
		<SpeedDial
			ariaLabel="Quick navigation actions"
			sx={{ position: 'fixed', bottom: 88, right: 24 }}
			icon={<SpeedDialIcon openIcon={<ScienceIcon />} />}
			role="navigation"
		>
			<SpeedDialAction 
				icon={<HomeIcon />} 
				tooltipTitle="Navigate to Home page" 
				onClick={() => navigate('/')}
				aria-label="Go to Home page"
				FabProps={{ 'aria-label': 'Go to Home page' } as any}
			/>
			<SpeedDialAction 
				icon={<ArticleIcon />} 
				tooltipTitle="View Documents" 
				onClick={() => navigate('/document/TAG_Critique')}
				aria-label="View document library"
				FabProps={{ 'aria-label': 'View document library' } as any}
			/>
			<SpeedDialAction 
				icon={<HubIcon />} 
				tooltipTitle="Open ZLFN Graph Visualizer" 
				onClick={() => navigate('/viz/zlfn')}
				aria-label="Open ZLFN Graph visualization"
				FabProps={{ 'aria-label': 'Open ZLFN Graph visualization' } as any}
			/>
			<SpeedDialAction 
				icon={<DonutLargeIcon />} 
				tooltipTitle="Open Venn Diagram Visualizer" 
				onClick={() => navigate('/viz/venn')}
				aria-label="Open Venn Diagram visualization"
				FabProps={{ 'aria-label': 'Open Venn Diagram visualization' } as any}
			/>
			<SpeedDialAction 
				icon={<FunctionsIcon />} 
				tooltipTitle={simulationMode ? 'Disable Simulation Mode' : 'Enable Simulation Mode'} 
				onClick={() => { const next = !simulationMode; setSimulationMode(next); if (!next) resetStates() }}
				aria-label={simulationMode ? 'Disable simulation mode' : 'Enable simulation mode'}
				FabProps={{ 'aria-label': simulationMode ? 'Disable simulation mode' : 'Enable simulation mode' } as any}
			/>
		</SpeedDial>
	)
}

export default DockBar


