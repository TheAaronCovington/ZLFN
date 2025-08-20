import React from 'react'
import { Card, CardContent, CardHeader } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

export interface NeonCardProps {
	title?: string
	subheader?: string
	children: React.ReactNode
	contentSx?: SxProps<Theme>
	sx?: SxProps<Theme>
}

const borderGradient = 'linear-gradient(135deg, #40c4ff, #00e676, #ff4081)'

export const NeonCard: React.FC<NeonCardProps> = ({ title, subheader, children, contentSx, sx }) => {
	return (
		<Card
			sx={{
				backgroundColor: 'var(--ai-bg-secondary)',
				color: 'var(--ai-text-primary)',
				border: '1px solid transparent',
				backgroundImage: `linear-gradient(var(--ai-bg-secondary), var(--ai-bg-secondary)), ${borderGradient}`,
				backgroundOrigin: 'border-box',
				backgroundClip: 'padding-box, border-box',
				boxShadow: '0 0 12px rgba(64,196,255,0.15)',
				display: 'flex',
				flexDirection: 'column',
				...sx,
			}}
		>
			{(title || subheader) && <CardHeader title={title} subheader={subheader} />}
			<CardContent sx={contentSx}>{children}</CardContent>
		</Card>
	)
}

export default NeonCard


