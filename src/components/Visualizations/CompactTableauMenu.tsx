import React from 'react'
import { Box, ToggleButton, ToggleButtonGroup, Tooltip, Button, Select, MenuItem, FormControl, InputLabel, Chip, Slider, Typography, Switch, FormControlLabel, IconButton, Menu, Divider } from '@mui/material'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import type { LogicMode } from '../../services/inference'
import { StatusChip, createKeyboardChip, createBranchChip } from '../UI/StatusChip'

interface CompactTableauMenuProps {
	layoutMode: 'tree' | 'hierarchy'
	setLayoutMode: (mode: 'tree' | 'hierarchy') => void
	logicMode: LogicMode
	setLogicMode: (mode: LogicMode) => void
	expression: string
	proofStatus: {
		isComplete: boolean
		isValid: boolean
		openBranches: number
		closedBranches: number
		errors: string[]
	}
	stepMode: boolean
	setStepMode: (mode: boolean) => void
	maxDepth: number
	setMaxDepth: (depth: number) => void
	currentStep: number
	setCurrentStep: (step: number) => void
	busy: { mode: string | null }
	autoExpand: () => void
	autoClose: () => void
	stepExpand: () => void
	exportTableau: () => void
	importTableau: (event: React.ChangeEvent<HTMLInputElement>) => void
	generateProofText: (root: any) => string
	generateLatexTableau: (root: any) => string
	exportTableauImage: (format: 'png' | 'svg') => void
	exportProofSteps: () => void
	setComparisonOpen: (open: boolean) => void
	compact?: boolean
	root: any
}

export function CompactTableauMenu({
	layoutMode, setLayoutMode, logicMode, setLogicMode, expression, proofStatus,
	stepMode, setStepMode, maxDepth, setMaxDepth, currentStep, setCurrentStep,
	busy, autoExpand, autoClose, stepExpand, exportTableau, importTableau,
	generateProofText, generateLatexTableau, exportTableauImage, exportProofSteps,
	setComparisonOpen, compact = false, root
}: CompactTableauMenuProps) {
	const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null)

	return (
		<Box sx={{ 
			display: 'flex', 
			alignItems: 'center', 
			gap: 1, 
			p: 1, 
			background: 'rgba(255,255,255,0.05)', 
			borderRadius: 1,
			fontSize: 12,
			justifyContent: 'space-between'
		}}>
			{/* Left Section - Core Controls */}
			<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
				<Tooltip title="Layout modes: Tree (compact) vs Hierarchy (spacious)">
					<ToggleButtonGroup
						value={layoutMode}
						exclusive
						onChange={(_, v) => v && setLayoutMode(v)}
						size="small"
						color="primary"
					>
						<ToggleButton value="tree">Tree</ToggleButton>
						<ToggleButton value="hierarchy">Hierarchy</ToggleButton>
					</ToggleButtonGroup>
				</Tooltip>
				
				<FormControl size="small" sx={{ minWidth: 100 }}>
					<InputLabel>Logic</InputLabel>
					<Select
						value={logicMode}
						label="Logic"
						onChange={(e) => setLogicMode(e.target.value as LogicMode)}
					>
						<MenuItem value="classical">Classical</MenuItem>
						<MenuItem value="epistemic">Epistemic</MenuItem>
						<MenuItem value="deontic">Deontic</MenuItem>
						<MenuItem value="temporal">Temporal</MenuItem>
						<MenuItem value="informal">Informal</MenuItem>
						<MenuItem value="paraconsistent">Paraconsistent</MenuItem>
						<MenuItem value="fuzzy">Fuzzy</MenuItem>
					</Select>
				</FormControl>
				
				{/* Primary Actions */}
				<Button size="small" variant="outlined" color="secondary" onClick={autoExpand} disabled={!!busy.mode}>
					{stepMode ? `Auto (${maxDepth})` : 'Auto Expand'}
				</Button>
				<Button size="small" variant="outlined" color="secondary" onClick={autoClose} disabled={!!busy.mode}>
					Auto Close
				</Button>
			</Box>
			
			{/* Center Section - Status & Info */}
			<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, justifyContent: 'center' }}>
				<span style={{ fontSize: 12, opacity: 0.7 }}>Semantic Tableau • {expression || '—'}</span>
				
				{/* Proof Status */}
				<Tooltip title={
					proofStatus.errors.length > 0 
						? `Errors: ${proofStatus.errors.join(', ')}`
						: `Open: ${proofStatus.openBranches}, Closed: ${proofStatus.closedBranches}`
				}>
					<Chip 
						label={
							proofStatus.isComplete 
								? "✓ Complete" 
								: proofStatus.isValid 
									? `${proofStatus.openBranches}/${proofStatus.openBranches + proofStatus.closedBranches} Open`
									: "⚠ Invalid"
						}
						size="small" 
						color={
							proofStatus.isComplete 
								? "success" 
								: proofStatus.isValid 
									? "info" 
									: "error"
						}
						variant="outlined"
					/>
				</Tooltip>
			</Box>
			
			{/* Right Section - Export & More */}
			<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
				<Button size="small" variant="outlined" color="primary" onClick={exportTableau}>
					Export
				</Button>
				<Button size="small" variant="outlined" color="primary" component="label">
					Import
					<input type="file" accept=".json" onChange={importTableau} style={{ display: 'none' }} />
				</Button>
				
				{!compact && (
					<Button 
						onClick={() => setComparisonOpen(true)} 
						size="small" 
						variant="outlined"
						color="secondary"
					>
						🔄 Compare
					</Button>
				)}
				
				{/* More Options Dropdown */}
				<Tooltip title="More options">
					<IconButton 
						size="small" 
						onClick={(e) => setMenuAnchor(e.currentTarget)}
						sx={{ color: 'rgba(255,255,255,0.7)' }}
					>
						<MoreVertIcon />
					</IconButton>
				</Tooltip>
				
				<Menu
					anchorEl={menuAnchor}
					open={Boolean(menuAnchor)}
					onClose={() => setMenuAnchor(null)}
					PaperProps={{
						sx: { 
							background: 'rgba(30,30,30,0.95)', 
							backdropFilter: 'blur(10px)',
							border: '1px solid rgba(255,255,255,0.1)'
						}
					}}
				>
					<MenuItem onClick={() => { 
						if (root) {
							const proofText = generateProofText(root)
							const proofWindow = window.open('', '_blank', 'width=600,height=800')
							if (proofWindow) {
								proofWindow.document.write(`
									<html>
										<head><title>Tableau Proof - ${expression}</title></head>
										<body style="font-family: monospace; padding: 20px; background: #1a1a1a; color: #fff;">
											<h2>Natural Language Proof</h2>
											<h3>Expression: ${expression}</h3>
											<pre style="white-space: pre-wrap; line-height: 1.6;">${proofText}</pre>
										</body>
									</html>
								`)
								proofWindow.document.close()
							}
						}
						setMenuAnchor(null)
					}} disabled={!root}>
						📝 Generate Proof
					</MenuItem>
					<MenuItem onClick={() => {
						if (root) {
							const latexCode = generateLatexTableau(root)
							const blob = new Blob([latexCode], { type: 'text/plain' })
							const url = URL.createObjectURL(blob)
							const a = document.createElement('a')
							a.href = url
							a.download = `tableau-${expression?.replace(/[^a-zA-Z0-9]/g, '_') || 'proof'}.tex`
							document.body.appendChild(a)
							a.click()
							document.body.removeChild(a)
							URL.revokeObjectURL(url)
						}
						setMenuAnchor(null)
					}} disabled={!root}>
						📄 Export LaTeX
					</MenuItem>
					<MenuItem onClick={() => { exportTableauImage('png'); setMenuAnchor(null) }} disabled={!root}>
						🖼️ Export PNG
					</MenuItem>
					<MenuItem onClick={() => { exportTableauImage('svg'); setMenuAnchor(null) }} disabled={!root}>
						📐 Export SVG
					</MenuItem>
					<MenuItem onClick={() => { exportProofSteps(); setMenuAnchor(null) }} disabled={!root}>
						📋 Export Steps
					</MenuItem>
					<Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
					<MenuItem onClick={() => setMenuAnchor(null)}>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
							<StatusChip 
								{...createKeyboardChip("⌨️", "Keyboard Shortcuts: Arrow keys (navigate), D (decompose), X (close), A (auto expand), C (auto close), Ctrl+E (export)")}
							/>
							<span style={{ fontSize: 11 }}>Shortcuts</span>
						</Box>
					</MenuItem>
					<MenuItem onClick={() => setMenuAnchor(null)}>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
							<StatusChip 
								{...createBranchChip(
									<div style={{ fontSize: 11 }}>
										<div><span style={{ color: '#2196f3' }}>━━</span> α rules (conjunction)</div>
										<div><span style={{ color: '#ff9800' }}>┅┅</span> β rules (disjunction)</div>
										<div><span style={{ color: '#9c27b0' }}>━━</span> Implication</div>
										<div><span style={{ color: '#e91e63' }}>━━</span> Biconditional</div>
										<div><span style={{ color: '#673ab7' }}>┄┄</span> Quantifiers</div>
										<div><span style={{ color: '#4caf50' }}>···</span> Double negation</div>
									</div>
								)}
							/>
							<span style={{ fontSize: 11 }}>Branch Legend</span>
						</Box>
					</MenuItem>
					{stepMode && (
						<>
							<Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
							<MenuItem onClick={() => setMenuAnchor(null)}>
								<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
									<Button size="small" variant="outlined" color="info" onClick={stepExpand} disabled={!!busy.mode} fullWidth>
										Step ({currentStep})
									</Button>
								</Box>
							</MenuItem>
							<MenuItem onClick={() => setMenuAnchor(null)}>
								<Box sx={{ width: '100%' }}>
									<Typography variant="caption" sx={{ fontSize: 10 }}>Depth: {maxDepth}</Typography>
									<Slider
										size="small"
										value={maxDepth}
										onChange={(_, value) => setMaxDepth(value as number)}
										min={1}
										max={10}
										step={1}
										valueLabelDisplay="auto"
									/>
								</Box>
							</MenuItem>
						</>
					)}
					<Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
					<MenuItem onClick={() => setMenuAnchor(null)}>
						<FormControlLabel
							control={
								<Switch
									size="small"
									checked={stepMode}
									onChange={(e) => {
										setStepMode(e.target.checked)
										setCurrentStep(0)
									}}
								/>
							}
							label={<Typography variant="caption">Step Mode</Typography>}
						/>
					</MenuItem>
				</Menu>
			</Box>
		</Box>
	)
}
