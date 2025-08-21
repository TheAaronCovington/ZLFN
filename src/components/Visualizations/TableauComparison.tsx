import React, { useState, useCallback } from 'react'
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Typography, Paper, Chip } from '@mui/material'
import { SemanticTableau } from './SemanticTableau'
import { parseExpressionToAst } from '../../services/logic'

interface ComparisonEntry {
	id: string
	expression: string
	title: string
	ast: any
}

interface TableauComparisonProps {
	open: boolean
	onClose: () => void
	initialExpression?: string
}

export function TableauComparison({ open, onClose, initialExpression }: TableauComparisonProps) {
	const [comparisons, setComparisons] = useState<ComparisonEntry[]>([])
	const [newExpression, setNewExpression] = useState('')
	const [newTitle, setNewTitle] = useState('')

	const addComparison = useCallback(() => {
		if (!newExpression.trim()) return
		
		const ast = parseExpressionToAst(newExpression.trim())
		if (!ast) return
		
		const entry: ComparisonEntry = {
			id: Math.random().toString(36),
			expression: newExpression.trim(),
			title: newTitle.trim() || `Approach ${comparisons.length + 1}`,
			ast
		}
		
		setComparisons(prev => [...prev, entry])
		setNewExpression('')
		setNewTitle('')
	}, [newExpression, newTitle, comparisons.length])

	const removeComparison = useCallback((id: string) => {
		setComparisons(prev => prev.filter(c => c.id !== id))
	}, [])

	const loadInitialExpression = useCallback(() => {
		if (initialExpression) {
			setNewExpression(initialExpression)
			setNewTitle('Original Expression')
		}
	}, [initialExpression])

	React.useEffect(() => {
		if (open && initialExpression && comparisons.length === 0) {
			loadInitialExpression()
		}
	}, [open, initialExpression, comparisons.length, loadInitialExpression])

	return (
		<Dialog 
			open={open} 
			onClose={onClose} 
			maxWidth="xl" 
			fullWidth
			PaperProps={{
				sx: { 
					height: '90vh',
					background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
					color: 'white'
				}
			}}
		>
			<DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
				<Typography variant="h5" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
					🔄 Tableau Comparison
					<Chip 
						label={`${comparisons.length} approaches`} 
						size="small" 
						variant="outlined" 
						sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
					/>
				</Typography>
			</DialogTitle>
			
			<DialogContent sx={{ p: 2 }}>
				{/* Add New Comparison */}
				<Paper sx={{ p: 2, mb: 2, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
					<Typography variant="h6" gutterBottom>Add Proof Approach</Typography>
					<Box sx={{ display: 'flex', gap: 2, alignItems: 'end' }}>
						<TextField
							label="Expression"
							value={newExpression}
							onChange={(e) => setNewExpression(e.target.value)}
							placeholder="e.g., (P ∧ Q) → R"
							fullWidth
							variant="outlined"
							size="small"
							sx={{
								'& .MuiOutlinedInput-root': {
									color: 'white',
									'& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
									'&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
									'&.Mui-focused fieldset': { borderColor: '#2196f3' }
								},
								'& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' }
							}}
						/>
						<TextField
							label="Title (optional)"
							value={newTitle}
							onChange={(e) => setNewTitle(e.target.value)}
							placeholder="e.g., Classical Logic"
							variant="outlined"
							size="small"
							sx={{
								minWidth: 200,
								'& .MuiOutlinedInput-root': {
									color: 'white',
									'& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
									'&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
									'&.Mui-focused fieldset': { borderColor: '#2196f3' }
								},
								'& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' }
							}}
						/>
						<Button 
							onClick={addComparison} 
							variant="contained" 
							disabled={!newExpression.trim()}
							sx={{ minWidth: 100 }}
						>
							Add
						</Button>
					</Box>
				</Paper>

				{/* Comparison Grid */}
				{comparisons.length === 0 ? (
					<Paper sx={{ p: 4, textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
						<Typography variant="h6" color="text.secondary">
							No comparisons yet
						</Typography>
						<Typography color="text.secondary">
							Add expressions above to compare different proof approaches
						</Typography>
					</Paper>
				) : (
					<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
						{comparisons.map((comparison) => (
							<Box key={comparison.id} sx={{ flex: '1 1 300px', minWidth: 300, maxWidth: 400 }}>
								<Paper sx={{ 
									height: 500, 
									background: 'rgba(255,255,255,0.03)', 
									border: '1px solid rgba(255,255,255,0.1)',
									display: 'flex',
									flexDirection: 'column'
								}}>
									{/* Header */}
									<Box sx={{ 
										p: 2, 
										borderBottom: '1px solid rgba(255,255,255,0.1)',
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center'
									}}>
										<Box>
											<Typography variant="h6" noWrap>
												{comparison.title}
											</Typography>
											<Typography 
												variant="body2" 
												color="text.secondary" 
												sx={{ fontFamily: 'monospace' }}
											>
												{comparison.expression}
											</Typography>
										</Box>
										<Button 
											onClick={() => removeComparison(comparison.id)}
											size="small"
											color="error"
											sx={{ minWidth: 'auto', p: 1 }}
										>
											✕
										</Button>
									</Box>
									
									{/* Tableau */}
									<Box sx={{ flex: 1, overflow: 'hidden' }}>
										<SemanticTableau 
											expression={comparison.expression}
											ast={comparison.ast}
											compact={true}
										/>
									</Box>
								</Paper>
							</Box>
						))}
					</Box>
				)}

				{/* Comparison Insights */}
				{comparisons.length > 1 && (
					<Paper sx={{ p: 2, mt: 2, background: 'rgba(33, 150, 243, 0.1)', border: '1px solid rgba(33, 150, 243, 0.3)' }}>
						<Typography variant="h6" gutterBottom>
							📊 Comparison Insights
						</Typography>
						<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between' }}>
							<Box>
								<Typography variant="body2" color="text.secondary">
									<strong>Expressions:</strong> {comparisons.length}
								</Typography>
							</Box>
							<Box>
								<Typography variant="body2" color="text.secondary">
									<strong>Unique Operators:</strong> {
										new Set(
											comparisons.flatMap(c => 
												c.expression.match(/[¬∧∨→↔∀∃⊻]/g) || []
											)
										).size
									}
								</Typography>
							</Box>
							<Box>
								<Typography variant="body2" color="text.secondary">
									<strong>Avg Length:</strong> {
										Math.round(
											comparisons.reduce((sum, c) => sum + c.expression.length, 0) / comparisons.length
										)
									} chars
								</Typography>
							</Box>
						</Box>
						<Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
							Compare how different logical expressions are decomposed using tableau rules. 
							Notice the branching patterns and closure conditions.
						</Typography>
					</Paper>
				)}
			</DialogContent>
			
			<DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}>
				<Button onClick={onClose} variant="outlined">
					Close
				</Button>
				{comparisons.length > 0 && (
					<Button 
						onClick={() => {
							// Export comparison data
							const data = {
								timestamp: new Date().toISOString(),
								comparisons: comparisons.map(c => ({
									title: c.title,
									expression: c.expression
								}))
							}
							const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
							const url = URL.createObjectURL(blob)
							const a = document.createElement('a')
							a.href = url
							a.download = `tableau-comparison-${Date.now()}.json`
							document.body.appendChild(a)
							a.click()
							document.body.removeChild(a)
							URL.revokeObjectURL(url)
						}}
						variant="contained"
					>
						📤 Export Comparison
					</Button>
				)}
			</DialogActions>
		</Dialog>
	)
}
