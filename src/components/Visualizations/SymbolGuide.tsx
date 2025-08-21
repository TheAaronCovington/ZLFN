import React from 'react'
import { Legend, createSymbolLegend } from '../UI/Legend'

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
		<Legend
			variant="symbols"
			items={createSymbolLegend(
				SYMBOLS.map(s => ({
					key: s.symbol,
					symbol: s.symbol,
					label: s.name,
					description: s.desc
				}))
			)}
		/>
	)
}

export default SymbolGuide


