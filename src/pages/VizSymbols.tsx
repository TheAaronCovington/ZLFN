import React from 'react'
import SymbolGuide from '../components/Visualizations/SymbolGuide'
import { Typography } from '@mui/material'

const VizSymbols: React.FC = () => {
	return (
		<div style={{ maxWidth: 1200, margin: '0 auto', padding: '1rem' }}>
			<Typography variant="h5" sx={{ mb: 2 }}>Symbol Guide</Typography>
			<SymbolGuide />
		</div>
	)
}

export default VizSymbols


