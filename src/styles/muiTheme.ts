import { createTheme } from '@mui/material/styles'

export const muiTheme = createTheme({
	palette: {
		mode: 'dark',
		primary: { main: '#40c4ff' },
		secondary: { main: '#00e676' },
		background: {
			default: '#121212',
			paper: '#1e1e2f'
		},
		text: {
			primary: 'rgba(255, 255, 255, 0.9)',
			secondary: 'rgba(255, 255, 255, 0.7)'
		}
	},
	shape: { borderRadius: 8 },
	components: {
		MuiPaper: {
			styleOverrides: { root: { backgroundImage: 'none' } }
		},
		MuiCard: {
			styleOverrides: {
				root: {
					border: '1px solid var(--ai-cyan)',
					boxShadow: 'var(--ai-glow-cyan)'
				}
			}
		},
		MuiButton: {
			styleOverrides: {
				root: {
					textTransform: 'uppercase',
					fontWeight: 600,
					boxShadow: 'var(--ai-glow-cyan)'
				}
			}
		},
		MuiTooltip: {
			styleOverrides: {
				tooltip: {
					backgroundColor: 'rgba(20, 24, 36, 0.95)',
					border: '1px solid rgba(64,196,255,0.4)',
					backdropFilter: 'blur(4px)'
				},
				arrow: { color: 'rgba(20, 24, 36, 0.95)' }
			}
		},
		MuiDialog: {
			styleOverrides: {
				paper: {
					border: '1px solid rgba(64,196,255,0.35)',
					boxShadow: '0 0 20px rgba(64,196,255,0.2)'
				}
			}
		},
		MuiListItemButton: {
			styleOverrides: {
				root: {
					'&.Mui-selected': {
						backgroundColor: 'rgba(64,196,255,0.12)',
						'&:hover': { backgroundColor: 'rgba(64,196,255,0.18)' }
					},
					'&:hover': {
						backgroundColor: 'rgba(64,196,255,0.08)'
					}
				}
			}
		}
	}
})


