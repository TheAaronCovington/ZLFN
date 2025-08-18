import React from 'react'
import { SpeedDial, SpeedDialAction, SpeedDialIcon } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import ArticleIcon from '@mui/icons-material/Article'
import HubIcon from '@mui/icons-material/Hub'
import DonutLargeIcon from '@mui/icons-material/DonutLarge'
import SchemaIcon from '@mui/icons-material/Schema'
import FunctionsIcon from '@mui/icons-material/Functions'
import ScienceIcon from '@mui/icons-material/Science'
import { useNavigate } from 'react-router-dom'
import { useLogicShared } from '../../context/LogicSharedContext'

const DockBar: React.FC = () => {
	const navigate = useNavigate()
	const { simulationMode, setSimulationMode, resetStates } = useLogicShared()

	return (
		<SpeedDial
			ariaLabel="Quick actions"
			sx={{ position: 'fixed', bottom: 88, right: 24 }}
			icon={<SpeedDialIcon openIcon={<ScienceIcon />} />}
		>
			<SpeedDialAction icon={<HomeIcon />} tooltipTitle="Home" onClick={() => navigate('/')} />
			<SpeedDialAction icon={<ArticleIcon />} tooltipTitle="Documents" onClick={() => navigate('/document/TAG_Critique')} />
			<SpeedDialAction icon={<HubIcon />} tooltipTitle="ZLFN" onClick={() => navigate('/viz/zlfn')} />
			<SpeedDialAction icon={<DonutLargeIcon />} tooltipTitle="Venn" onClick={() => navigate('/viz/venn')} />
			<SpeedDialAction icon={<SchemaIcon />} tooltipTitle="AST" onClick={() => navigate('/viz/ast')} />
			<SpeedDialAction icon={<FunctionsIcon />} tooltipTitle={simulationMode ? 'Disable Simulation' : 'Enable Simulation'} onClick={() => { const next = !simulationMode; setSimulationMode(next); if (!next) resetStates() }} />
		</SpeedDial>
	)
}

export default DockBar


