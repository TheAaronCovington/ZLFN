import React from 'react'
import { Card, CardContent, Tooltip, Typography, Box } from '@mui/material'

type SymbolInfo = { symbol: string; name: string; desc: string }

const SYMBOLS: SymbolInfo[] = [
	{ symbol: '¬', name: 'Negation', desc: 'Not (logical negation)' },
	{ symbol: '∧', name: 'Conjunction', desc: 'And' },
	{ symbol: '∨', name: 'Disjunction', desc: 'Or (inclusive)' },
	{ symbol: '→', name: 'Implication', desc: 'If ... then ...' },
	{ symbol: '↔', name: 'Biconditional', desc: 'If and only if' },
	{ symbol: '⊢', name: 'Turnstile', desc: 'Derivability (syntactic consequence)' },
	{ symbol: '⊨', name: 'Double turnstile', desc: 'Semantic entailment' },
	{ symbol: '∀', name: 'Universal quantifier', desc: 'For all' },
	{ symbol: '∃', name: 'Existential quantifier', desc: 'There exists' },
	{ symbol: '⊥', name: 'Falsum', desc: 'Contradiction/false' },
	{ symbol: '⊤', name: 'Verum', desc: 'Tautology/true' },
]

export const SymbolGuide: React.FC = () => {
	return (
		<Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
			{SYMBOLS.map(s => (
				<Tooltip key={s.symbol} title={s.desc} arrow>
					<Card sx={{
						backgroundColor: 'var(--ai-bg-secondary)',
						border: '1px solid rgba(64,196,255,0.3)',
						borderRadius: 2,
						textAlign: 'center'
					}}>
						<CardContent>
							<Typography variant="h4" sx={{ color: '#00e676', textShadow: '0 0 6px rgba(0,230,118,0.6)' }}>
								{s.symbol}
							</Typography>
							<Typography variant="body2" sx={{ color: 'var(--ai-text-secondary)' }}>{s.name}</Typography>
						</CardContent>
					</Card>
				</Tooltip>
			))}
		</Box>
	)
}

export default SymbolGuide


