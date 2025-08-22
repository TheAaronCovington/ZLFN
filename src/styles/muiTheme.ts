import { createTheme } from '@mui/material/styles'

export const muiTheme = createTheme({
	palette: {
		mode: 'dark',
		primary: { main: '#00e5ff' },
		secondary: { main: '#bb86fc' },
		success: { main: '#00ff88' },
		warning: { main: '#ff9500' },
		error: { main: '#ff3366' },
		info: { main: '#2196f3' },
		background: {
			default: '#0a0a0f',
			paper: '#1e1e2f'
		},
		text: {
			primary: 'rgba(255, 255, 255, 0.95)',
			secondary: 'rgba(255, 255, 255, 0.75)',
			disabled: 'rgba(255, 255, 255, 0.35)'
		}
	},
	shape: { borderRadius: 12 },
	typography: {
		fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
		h1: { fontWeight: 700, fontSize: '1.875rem' },
		h2: { fontWeight: 600, fontSize: '1.5rem' },
		h3: { fontWeight: 600, fontSize: '1.25rem' },
		h4: { fontWeight: 600, fontSize: '1.125rem' },
		h5: { fontWeight: 500, fontSize: '1rem' },
		h6: { fontWeight: 500, fontSize: '0.875rem' },
		body1: { fontSize: '1rem', lineHeight: 1.6 },
		body2: { fontSize: '0.875rem', lineHeight: 1.5 },
		button: { fontWeight: 600, textTransform: 'none' },
		caption: { fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.55)' }
	},
	components: {
		MuiPaper: {
			styleOverrides: { 
				root: { 
					backgroundImage: 'none',
					backgroundColor: 'var(--ai-bg-elevated)',
					border: '1px solid var(--ai-border-subtle)'
				} 
			}
		},
		MuiCard: {
			styleOverrides: {
				root: {
					backgroundColor: 'var(--ai-bg-elevated)',
					border: '1px solid var(--ai-border-primary)',
					boxShadow: 'var(--ai-glow-cyan)',
					transition: 'all 0.2s ease-in-out',
					'&:hover': {
						boxShadow: 'var(--ai-glow-cyan), 0 4px 20px rgba(0, 229, 255, 0.1)',
						transform: 'translateY(-1px)'
					}
				}
			}
		},
		MuiButton: {
			styleOverrides: {
				root: {
					fontWeight: 600,
					borderRadius: '8px',
					padding: '8px 16px',
					transition: 'all 0.2s ease-in-out',
					'&:focus-visible': {
						boxShadow: 'var(--ai-focus-ring)'
					}
				},
				contained: {
					boxShadow: 'var(--ai-glow-cyan)',
					'&:hover': {
						boxShadow: 'var(--ai-glow-cyan), 0 4px 12px rgba(0, 229, 255, 0.2)',
						transform: 'translateY(-1px)'
					}
				},
				outlined: {
					borderColor: 'var(--ai-border-primary)',
					'&:hover': {
						borderColor: 'var(--ai-cyan)',
						backgroundColor: 'rgba(0, 229, 255, 0.08)'
					}
				}
			}
		},
		MuiIconButton: {
			styleOverrides: {
				root: {
					borderRadius: '8px',
					transition: 'all 0.2s ease-in-out',
					'&:hover': {
						backgroundColor: 'rgba(0, 229, 255, 0.08)',
						boxShadow: 'var(--ai-glow-cyan)'
					},
					'&:focus-visible': {
						boxShadow: 'var(--ai-focus-ring)'
					}
				}
			}
		},
		MuiTooltip: {
			styleOverrides: {
				tooltip: {
					backgroundColor: 'rgba(10, 10, 15, 0.95)',
					border: '1px solid var(--ai-border-primary)',
					backdropFilter: 'blur(8px)',
					fontSize: '0.75rem',
					fontWeight: 500,
					boxShadow: 'var(--ai-glow-cyan)'
				},
				arrow: { color: 'rgba(10, 10, 15, 0.95)' }
			}
		},
		MuiDialog: {
			styleOverrides: {
				paper: {
					backgroundColor: 'var(--ai-bg-elevated)',
					border: '1px solid var(--ai-border-primary)',
					boxShadow: 'var(--ai-glow-cyan), 0 8px 32px rgba(0, 0, 0, 0.4)',
					backdropFilter: 'blur(8px)'
				}
			}
		},
		MuiListItemButton: {
			styleOverrides: {
				root: {
					borderRadius: '8px',
					margin: '2px 8px',
					'&.Mui-selected': {
						backgroundColor: 'rgba(0, 229, 255, 0.15)',
						'&:hover': { backgroundColor: 'rgba(0, 229, 255, 0.20)' }
					},
					'&:hover': {
						backgroundColor: 'rgba(0, 229, 255, 0.08)'
					}
				}
			}
		},
		MuiTextField: {
			styleOverrides: {
				root: {
					'& .MuiOutlinedInput-root': {
						borderRadius: '8px',
						'& fieldset': {
							borderColor: 'var(--ai-border-secondary)'
						},
						'&:hover fieldset': {
							borderColor: 'var(--ai-border-primary)'
						},
						'&.Mui-focused fieldset': {
							borderColor: 'var(--ai-cyan)',
							boxShadow: 'var(--ai-glow-cyan)'
						}
					}
				}
			}
		},
		MuiSelect: {
			styleOverrides: {
				root: {
					borderRadius: '8px',
					'&.Mui-focused .MuiOutlinedInput-notchedOutline': {
						borderColor: 'var(--ai-cyan)',
						boxShadow: 'var(--ai-glow-cyan)'
					}
				}
			}
		},
		MuiChip: {
			styleOverrides: {
				root: {
					borderRadius: '6px',
					fontWeight: 500,
					'&.MuiChip-filled': {
						backgroundColor: 'var(--ai-bg-surface)',
						border: '1px solid var(--ai-border-secondary)'
					}
				}
			}
		}
	}
})


