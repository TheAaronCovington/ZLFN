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
	level?: number // For nested styling
}

const borderGradient = 'linear-gradient(135deg, #40c4ff, #00e676, #ff4081, #9c27b0)'
const activeBorderGradient = 'linear-gradient(135deg, #40c4ff, #00e676, #ff4081)'
const shadowGlow = '0 0 20px rgba(64,196,255,0.3), 0 0 40px rgba(0,230,118,0.2), 0 0 60px rgba(255,64,129,0.1)'

export const NeonAccordion: React.FC<NeonAccordionProps> = ({ items, level = 0 }) => {
	// Adjust styling based on nesting level
	const isNested = level > 0
	const borderRadius = isNested ? 2 : 3
	const spacing = isNested ? 1.5 : 2
	const opacityFactor = Math.max(0.6, 1 - (level * 0.1))
	const nestedBorderGradient = isNested 
		? `linear-gradient(135deg, rgba(64,196,255,${opacityFactor}), rgba(0,230,118,${opacityFactor}), rgba(255,64,129,${opacityFactor - 0.1}))`
		: borderGradient
	return (
		<Box sx={{
			display: 'flex', 
			flexDirection: 'column', 
			gap: spacing,
			marginLeft: isNested ? 2 : 0,
			'& .MuiAccordion-root': {
				backgroundColor: isNested ? 'rgba(15, 20, 30, 0.9)' : 'rgba(20, 25, 35, 0.95)',
				color: 'var(--ai-text-primary)',
				borderRadius: borderRadius,
				border: isNested ? '1px solid transparent' : '2px solid transparent',
				backgroundImage: `linear-gradient(${isNested ? 'rgba(15, 20, 30, 0.9)' : 'rgba(20, 25, 35, 0.95)'}, ${isNested ? 'rgba(15, 20, 30, 0.9)' : 'rgba(20, 25, 35, 0.95)'}), ${nestedBorderGradient}`,
				backgroundOrigin: 'border-box',
				backgroundClip: 'padding-box, border-box',
				boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 15px rgba(64,196,255,0.15)',
				transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
				position: 'relative',
				overflow: 'hidden',
				'&::before': {
					content: '""',
					position: 'absolute',
					top: 0,
					left: '-100%',
					width: '100%',
					height: '2px',
					background: 'linear-gradient(90deg, transparent, #40c4ff, transparent)',
					transition: 'left 0.5s ease-in-out',
					zIndex: 1
				},
				'&:hover': {
					boxShadow: shadowGlow,
					transform: 'translateY(-2px)',
					'&::before': {
						left: '100%'
					}
				},
				'&.Mui-expanded': {
					boxShadow: shadowGlow,
					backgroundImage: `linear-gradient(rgba(25, 30, 40, 0.98), rgba(25, 30, 40, 0.98)), ${activeBorderGradient}`,
					'&::after': {
						content: '""',
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						background: 'linear-gradient(45deg, rgba(64,196,255,0.03), rgba(0,230,118,0.03), rgba(255,64,129,0.03))',
						pointerEvents: 'none',
						zIndex: 0
					}
				}
			},
			'& .MuiAccordionSummary-root': {
				minHeight: isNested ? 52 : 64,
				padding: isNested ? '0 16px' : '0 24px',
				position: 'relative',
				zIndex: 2,
				transition: 'all 0.3s ease',
				'&:hover': { 
					backgroundColor: 'rgba(64,196,255,0.12)',
					'& .MuiSvgIcon-root': {
						color: '#00e676',
						filter: 'drop-shadow(0 0 8px rgba(0,230,118,0.6))'
					}
				},
				'&.Mui-expanded': {
					backgroundColor: 'rgba(64,196,255,0.08)',
					borderBottom: '1px solid rgba(64,196,255,0.3)',
					'& .MuiSvgIcon-root': {
						color: '#40c4ff',
						filter: 'drop-shadow(0 0 10px rgba(64,196,255,0.8))',
						transform: 'rotate(180deg)'
					}
				},
				'& .MuiAccordionSummary-expandIconWrapper': {
					transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
					'&.Mui-expanded': {
						transform: 'rotate(180deg)'
					}
				}
			},
			'& .MuiAccordionDetails-root': {
				backgroundColor: isNested ? 'rgba(10, 15, 25, 0.8)' : 'rgba(15, 20, 30, 0.8)',
				padding: isNested ? '16px' : '24px',
				position: 'relative',
				zIndex: 2,
				borderTop: '1px solid rgba(64,196,255,0.2)',
				'&::before': {
					content: '""',
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					height: '1px',
					background: 'linear-gradient(90deg, transparent, rgba(64,196,255,0.6), transparent)',
				}
			}
		}}>
			{items.map(item => (
				<Accordion key={item.id} disableGutters>
					<AccordionSummary 
						expandIcon={
							<ExpandMoreIcon 
								sx={{ 
									color: '#40c4ff',
									fontSize: 28,
									filter: 'drop-shadow(0 0 6px rgba(64,196,255,0.4))',
									transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
								}} 
							/>
						}
					>
						{typeof item.title === 'string' ? (
							<Typography sx={{ 
								fontWeight: 600, 
								color: '#40c4ff',
								textShadow: '0 0 10px rgba(64,196,255,0.3)',
								fontSize: '1.1rem'
							}}>
								{item.title}
							</Typography>
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


