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
]

const LOGIC_SYMBOLS = [
	'→','↔','⇒','⇔','¬','∧','∨','⊻','↑',
	'⊢','⊨','∀','∃','⊥','⊤',
	'⊂','⊆','⊄','⊇','⊃','∈','∉',
	'∴','∵',
	'->','=>','<->','<=>','!','~','&','|'
]

export function logicRemarkPlugin() {
	return (tree: any) => {
		visit(tree, 'text', (node: any, index: number | undefined, parent: any) => {
			if (!parent || typeof node.value !== 'string') return
			if (parent.type === 'inlineCode' || parent.type === 'code') return
			const value: string = node.value

			// Build a combined regex that prefers symbols first (no word boundaries), then terms with \b
			const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
			const symbolAlternation = LOGIC_SYMBOLS.slice().sort((a,b)=>b.length-a.length).map(esc).join('|')
			const termAlternation = LOGIC_TERMS.map(esc).join('|')
			const combined = new RegExp(`(${symbolAlternation})|(\\b(?:${termAlternation})\\b)`, 'g')

			let lastIndex = 0
			let out = ''
			let match: RegExpExecArray | null
			while ((match = combined.exec(value)) !== null) {
				const start = match.index
				const end = combined.lastIndex
				if (start > lastIndex) out += value.slice(lastIndex, start)
				const [full, symbol, term] = match
				if (symbol) {
					out += `<span class="logic-symbol">${symbol}</span>`
				} else if (term) {
					out += `<span class="logic-term">${term}</span>`
				} else {
					out += full
				}
				lastIndex = end
			}
			out += value.slice(lastIndex)
			if (out === value) return
			if (typeof index === 'number') {
				parent.children.splice(index, 1, { type: 'html', value: out })
			}
		})
	}
}


