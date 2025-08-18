import React, { useMemo } from 'react'
import ASTTree from '../components/Visualizations/ASTTree'
import type { AstNodeRec } from '../components/Visualizations/ASTTree'
import { Typography, Stack, TextField, Button, Box } from '@mui/material'
import { parseExpressionToAst } from '../services/logic'
import { useLogicShared } from '../context/LogicSharedContext'

const initialExpr = '(A ∧ B) → C'

const VizAst: React.FC = () => {
	const { currentExpression, setCurrentExpression } = useLogicShared()
	const ast = useMemo<AstNodeRec | null>(() => parseExpressionToAst(currentExpression), [currentExpression])

	return (
		<div style={{ maxWidth: 1200, margin: '0 auto', padding: '1rem' }}>
			<Typography variant="h5" sx={{ mb: 2 }}>AST Tree (Demo)</Typography>
			<Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
				<TextField fullWidth label="Expression" value={currentExpression} onChange={e => setCurrentExpression(e.target.value)} size="small" />
				<Button variant="outlined" onClick={() => setCurrentExpression(initialExpr)}>Reset</Button>
			</Stack>
			<Box sx={{ mb: 1, color: 'text.secondary', fontSize: 14 }}>Expression: {currentExpression}</Box>
			{ast ? <ASTTree roots={[ast]} /> : <div>Invalid expression.</div>}
		</div>
	)
}

export default VizAst


