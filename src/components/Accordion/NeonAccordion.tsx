import React from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Typography, Box } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

export interface NeonAccordionItem {
	id: string
	title: string | React.ReactNode
	content: React.ReactNode
}

export interface NeonAccordionProps {
	items: NeonAccordionItem[]
}

const borderGradient = 'linear-gradient(90deg, #40c4ff, #00e676, #ff4081)'

export const NeonAccordion: React.FC<NeonAccordionProps> = ({ items }) => {
	return (
		<Box sx={{
			display: 'flex', flexDirection: 'column', gap: 1.5,
			'& .MuiAccordion-root': {
				backgroundColor: 'var(--ai-bg-secondary)',
				color: 'var(--ai-text-primary)',
				borderRadius: 2,
				border: '1px solid transparent',
				backgroundImage: `linear-gradient(var(--ai-bg-secondary), var(--ai-bg-secondary)), ${borderGradient}`,
				backgroundOrigin: 'border-box',
				backgroundClip: 'padding-box, border-box',
				boxShadow: '0 0 12px rgba(64,196,255,0.2)'
			},
			'& .MuiAccordionSummary-root': {
				'&:hover': { backgroundColor: 'rgba(64,196,255,0.08)' }
			},
			'& .MuiAccordionDetails-root': {
				backgroundColor: 'var(--ai-bg-primary)'
			}
		}}>
			{items.map(item => (
				<Accordion key={item.id} disableGutters>
					<AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#40c4ff' }} />}>
						{typeof item.title === 'string' ? (
							<Typography sx={{ fontWeight: 600, color: '#40c4ff' }}>{item.title}</Typography>
						) : (
							item.title
						)}
					</AccordionSummary>
					<AccordionDetails>
						{item.content}
					</AccordionDetails>
				</Accordion>
			))}
		</Box>
	)
}

export default NeonAccordion


