import { visit } from 'unist-util-visit'

const LOGIC_TERMS = [
	'Premise',
	'Conclusion',
	'necessary',
	'sufficient',
	'non-contradiction',
	'induction',
	'contradiction',
	'contrapositive',
	'tautology',
	'contingent',
	'valid',
	'sound',
	'consistent',
	'argument',
	'inference',
	'deduction',
	'syllogism',
	'fallacy',
	'axiom',
	'theorem',
	'lemma',
	'corollary',
	'proof',
	'disproof',
	'refutation'
]

const LOGIC_SYMBOLS = [
	'→','↔','⇒','⇔','¬','∧','∨','⊻','↑',
	'⊢','⊨','∀','∃','⊥','⊤',
	'⊂','⊆','⊄','⊇','⊃','∈','∉',
	'∴','∵','≡','≢','⊕','⊙','⊗',
	'□','◊','◇','■','●','○',
	'->','=>','<->','<=>','!','~','&','|'
]

const QUANTIFIERS = ['∀', '∃', '∄', '∃!']

// Symbol descriptions for tooltips
const SYMBOL_DESCRIPTIONS: Record<string, string> = {
	'→': 'Implication (if...then)',
	'↔': 'Biconditional (if and only if)',
	'⇒': 'Material implication',
	'⇔': 'Material biconditional',
	'¬': 'Negation (not)',
	'∧': 'Conjunction (and)',
	'∨': 'Disjunction (or)',
	'⊻': 'Exclusive or (xor)',
	'↑': 'NAND (not and)',
	'⊢': 'Syntactic entailment',
	'⊨': 'Semantic entailment',
	'∀': 'Universal quantifier (for all)',
	'∃': 'Existential quantifier (there exists)',
	'∄': 'Does not exist',
	'∃!': 'Exists uniquely',
	'⊥': 'Contradiction (false)',
	'⊤': 'Tautology (true)',
	'⊂': 'Proper subset',
	'⊆': 'Subset or equal',
	'⊄': 'Not a subset',
	'⊇': 'Superset or equal',
	'⊃': 'Proper superset',
	'∈': 'Element of',
	'∉': 'Not an element of',
	'∴': 'Therefore',
	'∵': 'Because',
	'≡': 'Equivalent to',
	'≢': 'Not equivalent to',
	'⊕': 'Exclusive or',
	'⊙': 'Logical NAND',
	'⊗': 'Logical NOR',
	'□': 'Necessity (modal logic)',
	'◊': 'Possibility (modal logic)',
	'◇': 'Possibility (alternative)',
	'■': 'Necessity (alternative)',
	'->': 'Implication (ASCII)',
	'=>': 'Implication (ASCII)',
	'<->': 'Biconditional (ASCII)',
	'<=>': 'Biconditional (ASCII)',
	'!': 'Negation (ASCII)',
	'~': 'Negation (ASCII)',
	'&': 'Conjunction (ASCII)',
	'|': 'Disjunction (ASCII)'
}

const TERM_DESCRIPTIONS: Record<string, string> = {
	'Premise': 'A statement assumed to be true for the purpose of argument',
	'Conclusion': 'The statement that follows from the premises',
	'necessary': 'A condition that must be present for something to be true',
	'sufficient': 'A condition that is enough to guarantee something is true',
	'non-contradiction': 'The principle that contradictory statements cannot both be true',
	'induction': 'Reasoning from specific cases to general principles',
	'contradiction': 'A statement that is necessarily false',
	'contrapositive': 'The logical equivalent formed by negating and switching premise and conclusion',
	'tautology': 'A statement that is necessarily true',
	'contingent': 'A statement that could be either true or false',
	'valid': 'An argument where the conclusion follows logically from the premises',
	'sound': 'A valid argument with true premises',
	'consistent': 'A set of statements that can all be true simultaneously',
	'argument': 'A set of premises leading to a conclusion',
	'inference': 'The process of deriving conclusions from premises',
	'deduction': 'Reasoning from general principles to specific conclusions',
	'syllogism': 'A form of reasoning with two premises and a conclusion',
	'fallacy': 'An error in reasoning that renders an argument invalid',
	'axiom': 'A statement accepted as true without proof',
	'theorem': 'A statement that has been proven true',
	'lemma': 'A proven statement used as a stepping stone to prove another statement',
	'corollary': 'A statement that follows easily from a theorem',
	'proof': 'A logical demonstration that a statement is true',
	'disproof': 'A logical demonstration that a statement is false',
	'refutation': 'The act of proving a statement or argument to be false'
}

// Variable detection for logical expressions
function detectVariables(text: string): Set<string> {
	const variables = new Set<string>()
	// Match single uppercase letters or simple variable names (P, Q, R, A1, B2, etc.)
	const variableRegex = /\b[A-Z][0-9]*\b/g
	let match
	while ((match = variableRegex.exec(text)) !== null) {
		variables.add(match[0])
	}
	return variables
}

// Predicate detection for logical expressions
function detectPredicates(text: string): Set<string> {
	const predicates = new Set<string>()
	// Match predicates like P(x), R(x,y), etc.
	const predicateRegex = /\b[A-Z][a-zA-Z0-9_]*(?=\s*\()/g
	let match
	while ((match = predicateRegex.exec(text)) !== null) {
		predicates.add(match[0])
	}
	return predicates
}

export function logicRemarkPlugin(options: { enableTooltips?: boolean; enableVariableMapping?: boolean } = {}) {
	const { enableTooltips = true, enableVariableMapping = true } = options
	
	return (tree: any) => {
		// Defensive guards for empty/invalid trees
		if (!tree || typeof tree !== 'object') return
		// console.debug('[logicRemarkPlugin] start', { type: tree?.type, childCount: Array.isArray(tree?.children) ? tree.children.length : undefined })
		// Collect variables and predicates across the document for mapping
		const documentVariables = new Set<string>()
		const documentPredicates = new Set<string>()
		
		if (enableVariableMapping) {
			visit(tree, 'text', (node: any) => {
				if (typeof node.value === 'string') {
					detectVariables(node.value).forEach(v => documentVariables.add(v))
					detectPredicates(node.value).forEach(p => documentPredicates.add(p))
				}
			})
		}

		visit(tree, 'text', (node: any, index: number | undefined, parent: any) => {
			if (!parent || typeof node.value !== 'string') return
			if (parent.type === 'inlineCode' || parent.type === 'code') return
			const value: string = node.value
			
			// Build enhanced regex patterns
			const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
			
			// Quantifiers (highest priority)
			const quantifierAlternation = QUANTIFIERS.slice().sort((a,b)=>b.length-a.length).map(esc).join('|')
			
			// Symbols (second priority)
			const symbolAlternation = LOGIC_SYMBOLS.slice().sort((a,b)=>b.length-a.length).map(esc).join('|')
			
			// Terms (third priority)
			const termAlternation = LOGIC_TERMS.map(esc).join('|')
			
			// Variables and predicates (if enabled)
			let variablePattern = ''
			let predicatePattern = ''
			
			if (enableVariableMapping && documentVariables.size > 0) {
				const variableArray = Array.from(documentVariables).sort((a,b)=>b.length-a.length)
				variablePattern = `|(\\b(?:${variableArray.map(esc).join('|')})\\b)`
			}
			
			if (enableVariableMapping && documentPredicates.size > 0) {
				const predicateArray = Array.from(documentPredicates).sort((a,b)=>b.length-a.length)
				predicatePattern = `|(\\b(?:${predicateArray.map(esc).join('|')})(?=\\s*\\())`
			}

			const combined = new RegExp(
				`(${quantifierAlternation})|(${symbolAlternation})|(\\b(?:${termAlternation})\\b)${variablePattern}${predicatePattern}`, 
				'g'
			)

			let lastIndex = 0
			let out = ''
			let match: RegExpExecArray | null
			
			while ((match = combined.exec(value)) !== null) {
				const start = match.index
				const end = combined.lastIndex
				if (start > lastIndex) out += value.slice(lastIndex, start)
				
				const [full, quantifier, symbol, term, variable, predicate] = match
				
				if (quantifier) {
					const tooltip = enableTooltips ? `<span class="logic-tooltip">${SYMBOL_DESCRIPTIONS[quantifier] || quantifier}</span>` : ''
					out += `<span class="logic-quantifier">${quantifier}${tooltip}</span>`
				} else if (symbol) {
					const tooltip = enableTooltips ? `<span class="logic-tooltip">${SYMBOL_DESCRIPTIONS[symbol] || symbol}</span>` : ''
					out += `<span class="logic-symbol">${symbol}${tooltip}</span>`
				} else if (term) {
					const tooltip = enableTooltips ? `<span class="logic-tooltip">${TERM_DESCRIPTIONS[term] || term}</span>` : ''
					out += `<span class="logic-term">${term}${tooltip}</span>`
				} else if (variable && enableVariableMapping) {
					out += `<span class="logic-variable" title="Variable: ${variable}">${variable}</span>`
				} else if (predicate && enableVariableMapping) {
					out += `<span class="logic-predicate" title="Predicate: ${predicate}">${predicate}</span>`
				} else {
					out += full
				}
				lastIndex = end
			}
			
			out += value.slice(lastIndex)
			if (out === value) return
			if (typeof index === 'number' && parent && Array.isArray(parent.children)) {
				// console.debug('[logicRemarkPlugin] replace text->html', { original: value, replaced: out })
				parent.children.splice(index, 1, { type: 'html', value: out })
			}
		})
	}
}


