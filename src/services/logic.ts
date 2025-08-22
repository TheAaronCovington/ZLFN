// Minimal logic expression parser and converters
// Supports variables (A, B, C...), unary ¬, binary ∧, ∨, →, ↔, ⊻ and parentheses
// Also recognizes ascii forms: !, ~ for neg; &, | for and/or; ^ for xor; ->, => for implies; <->, <=> for iff
// Adds basic quantifiers: ∀x P(x), ∃x P(x), or with parentheses: ∀x (P(x))
// Adds predicate/function application: P(x), R(x,y), f(a,b)

export type AstNodeRec = {
	id: string
	label: string
	children?: AstNodeRec[]
}

type Token = { type: 'var' | 'op' | 'lparen' | 'rparen' | 'dot' | 'comma'; value: string }

const OP_MAP: Record<string, string> = {
	'¬': '¬', '!': '¬', '~': '¬',
	'∧': '∧', '&': '∧',
	'∨': '∨', '|': '∨',
	'⊻': '⊻', '^': '⊻',
	'→': '→', '->': '→', '=>': '→',
	'↔': '↔', '<->': '↔', '<=>': '↔',
	'∀': '∀', '∃': '∃',
}

function tokenize(input: string): Token[] {
	const tokens: Token[] = []
	let i = 0
	while (i < input.length) {
		const ch = input[i]
		if (/\s/.test(ch)) { i++; continue }
		if (ch === '.') { tokens.push({ type: 'dot', value: ch }); i++; continue }
		if (ch === ',') { tokens.push({ type: 'comma', value: ch }); i++; continue }
		// parentheses
		if (ch === '(') { tokens.push({ type: 'lparen', value: ch }); i++; continue }
		if (ch === ')') { tokens.push({ type: 'rparen', value: ch }); i++; continue }
		// multi-char operators first
		const three = input.slice(i, i+3)
		if (three === '<=>' || three === '<->') {
			tokens.push({ type: 'op', value: OP_MAP[three] })
			i += 3
			continue
		}
		const two2 = input.slice(i, i+2)
		if (two2 === '->' || two2 === '=>') { tokens.push({ type: 'op', value: OP_MAP[two2] }); i += 2; continue }
		// single-char ops
		if (OP_MAP[ch]) { tokens.push({ type: 'op', value: OP_MAP[ch] }); i++; continue }
		// variable/predicate name sequence letters/digits/underscores
		if (/[A-Za-z]/.test(ch)) {
			let j = i + 1
			while (j < input.length && /[A-Za-z0-9_]/.test(input[j])) j++
			const name = input.slice(i, j)
			tokens.push({ type: 'var', value: name })
			i = j
			continue
		}
		// fallback: treat unknown as variable
		tokens.push({ type: 'var', value: ch })
		i++
	}
	return tokens
}

let idCounter = 0
function genId(prefix = 'n'): string { idCounter++; return `${prefix}${idCounter}` }

// Recursive descent parser with precedence: quantifiers > ¬ > ∧ > ∨/⊻ > → > ↔
export function parseExpressionToAst(expr: string): AstNodeRec | null {
	idCounter = 0
	const tokens = tokenize(expr)
	let pos = 0

	function peek(): Token | null { return pos < tokens.length ? tokens[pos] : null }
	function consume(): Token | null { return pos < tokens.length ? tokens[pos++] : null }
	function expect(type: Token['type'], value?: string): boolean {
		const t = peek()
		if (!t || t.type !== type || (value && t.value !== value)) return false
		pos++; return true
	}

	function parsePrimary(): AstNodeRec | null {
		const t = peek()
		if (!t) return null
		if (t.type === 'var') {
			// predicate/function application: Name '(' args ')'
			const nameTok = t; consume()
			if (peek() && peek()!.type === 'lparen') {
				consume() // '('
				const args: AstNodeRec[] = []
				while (peek() && peek()!.type !== 'rparen') {
					const argExpr = parseIff()
					if (argExpr) args.push(argExpr)
					if (peek() && peek()!.type === 'comma') consume()
				}
				expect('rparen')
				return { id: genId('p'), label: nameTok.value, children: args }
			}
			return { id: genId('v'), label: nameTok.value }
		}
		if (t.type === 'lparen') {
			consume()
			const node = parseIff()
			if (!expect('rparen')) return node
			return node
		}
		return null
	}

	function parseQuantifier(): AstNodeRec | null {
		const t = peek()
		if (t && t.type === 'op' && (t.value === '∀' || t.value === '∃')) {
			consume()
			// accept one or more variable names: ∀x,y,z . body
			const vars: string[] = []
			while (true) {
				const v = peek()
				if (v && v.type === 'var') { vars.push(v.value); consume() } else { break }
				if (peek() && peek()!.type === 'comma') { consume(); continue }
				break
			}
			// optional dot
			if (peek() && peek()!.type === 'dot') consume()
			// parse body (paren optional)
			let body: AstNodeRec | null = null
			if (peek() && peek()!.type === 'lparen') {
				expect('lparen')
				body = parseIff()
				expect('rparen')
			} else {
				body = parseIff()
			}
			// fold variables into nested quantifiers (right-associative)
			let acc = body
			for (let i = vars.length - 1; i >= 0; i--) {
				acc = { id: genId('q'), label: `${t.value}${vars[i]}`, children: acc ? [acc] : [] }
			}
			return acc || { id: genId('q'), label: `${t.value}x`, children: [] }
		}
		return parsePrimary()
	}

	function parseNeg(): AstNodeRec | null {
		const t = peek()
		if (t && t.type === 'op' && t.value === '¬') {
			consume()
			const child = parseNeg()
			return { id: genId('u'), label: '¬', children: child ? [child] : [] }
		}
		return parseQuantifier()
	}

	function parseAnd(): AstNodeRec | null {
		let first = parseNeg()
		const parts: AstNodeRec[] = []
		if (first) parts.push(first)
		while (peek() && peek()!.type === 'op' && peek()!.value === '∧') {
			consume()
			const right = parseNeg()
			if (right) parts.push(right)
		}
		if (parts.length > 1) {
			return { id: genId('b'), label: '∧', children: parts }
		}
		return first
	}

	function parseOrXor(): AstNodeRec | null {
		let left = parseAnd()
		let orParts: AstNodeRec[] | null = null
		while (peek() && peek()!.type === 'op' && (peek()!.value === '∨' || peek()!.value === '⊻')) {
			const op = consume()!.value
			const right = parseAnd()
			if (op === '∨') {
				if (!orParts) {
					orParts = []
					const push = (n: AstNodeRec | null) => { if (!n) return; if (n.label === '∨' && n.children) orParts!.push(...n.children); else orParts!.push(n) }
					push(left!)
					push(right!)
				} else {
					if (right) { if (right.label === '∨' && right.children) orParts!.push(...right.children); else orParts!.push(right) }
				}
				left = { id: genId('b'), label: '∨', children: orParts }
			} else {
				// finalize any accumulated OR before XOR
				if (orParts) { left = { id: genId('b'), label: '∨', children: orParts }; orParts = null }
				left = { id: genId('b'), label: '⊻', children: [left!, right!] }
			}
		}
		if (orParts) left = { id: genId('b'), label: '∨', children: orParts }
		return left
	}

	function parseImplies(): AstNodeRec | null {
		let left = parseOrXor()
		while (peek() && peek()!.type === 'op' && peek()!.value === '→') {
			consume()
			const right = parseOrXor()
			left = { id: genId('b'), label: '→', children: [left!, right!] }
		}
		return left
	}

	function parseIff(): AstNodeRec | null {
		let left = parseImplies()
		while (peek() && peek()!.type === 'op' && peek()!.value === '↔') {
			consume()
			const right = parseImplies()
			left = { id: genId('b'), label: '↔', children: [left!, right!] }
		}
		return left
	}

	const root = parseIff()
	return root
}

function operatorName(op: string): string {
	switch (op) {
		case '¬': return 'Negation'
		case '∧': return 'Conjunction'
		case '∨': return 'Disjunction'
		case '⊻': return 'Exclusive Or'
		case '→': return 'Implication'
		case '↔': return 'Biconditional'
		default:
			if (op.startsWith('∀')) return `For all ${op.slice(1)}`
			if (op.startsWith('∃')) return `There exists ${op.slice(1)}`
			return 'Operator'
	}
}

function operatorTranslation(op: string): string | undefined {
	switch (op) {
		case '¬': return 'NOT'
		case '∧': return 'AND'
		case '∨': return 'OR'
		case '⊻': return 'XOR'
		case '→': return 'IMPLIES'
		case '↔': return 'IFF'
		default:
			if (op.startsWith('∀')) return `FOR ALL ${op.slice(1)}`
			if (op.startsWith('∃')) return `THERE EXISTS ${op.slice(1)}`
			return undefined
	}
}

export function astToZlfnGraph(root: AstNodeRec): { nodes: Array<{ id: string; label: string; color?: string; type?: string; size?: any; name?: string; symbol?: string; translation?: string }>; edges: Array<{ from: string; to: string; weight?: number; style?: 'solid' | 'dashed' | 'dotted'; rule?: string; type?: 'implication' | 'bidirectional' | 'semantic' }> } {
	const nodes: Array<{ id: string; label: string; color?: string; type?: string; size?: any; name?: string; symbol?: string; translation?: string }> = []
	const edges: Array<{ from: string; to: string; weight?: number; style?: 'solid' | 'dashed' | 'dotted'; rule?: string; type?: 'implication' | 'bidirectional' | 'semantic' }> = []

	function equalsAst(a?: AstNodeRec | null, b?: AstNodeRec | null): boolean {
		if (!a || !b) return false
		if (a.label !== b.label) return false
		const ac = a.children || []
		const bc = b.children || []
		if (ac.length !== bc.length) return false
		for (let i = 0; i < ac.length; i++) {
			if (!equalsAst(ac[i], bc[i])) return false
		}
		return true
	}

	function isNegOf(node: AstNodeRec | null | undefined, target: AstNodeRec | null | undefined) {
		return !!(node && node.label === '¬' && node.children && node.children[0] && equalsAst(node.children[0], target || null))
	}
	function collectConjuncts(node: AstNodeRec): AstNodeRec[] {
		if (node.label !== '∧') return [node]
		const ch = node.children || []
		const out: AstNodeRec[] = []
		for (const c of ch) {
			if (!c) continue
			if (c.label === '∧') out.push(...collectConjuncts(c))
			else out.push(c)
		}
		return out
	}

	function inferEdgeRule(parent: AstNodeRec, child: AstNodeRec): string | undefined {
		// De Morgan's laws
		if (parent.label === '¬' && (child.label === '∧' || child.label === '∨')) return "De Morgan's Law"
		// Double negation
		if (parent.label === '¬' && child.label === '¬') return 'Double Negation'
		// Distributivity
		if ((parent.label === '∧' && child.label === '∨') || (parent.label === '∨' && child.label === '∧')) return 'Distributivity'
		// Modus Ponens / Tollens on implication
		if (parent.label === '→' && parent.children && parent.children.length === 2) {
			const [lhs, rhs] = parent.children
			if (lhs) {
				const conjuncts = collectConjuncts(lhs)
				for (const c of conjuncts) {
					if (c.label === '→' && c.children && c.children.length === 2) {
						const [a, b] = c.children
						// MP: (A ∧ (A → B)) → B
						if (equalsAst(rhs, b) && conjuncts.some(x => equalsAst(x, a))) return 'Modus Ponens'
						// MT: (¬B ∧ (A → B)) → ¬A
						if (isNegOf(rhs, a) && conjuncts.some(x => isNegOf(x, b))) return 'Modus Tollens'
					}
				}
			}
		}
		// Contraposition: (A → B) ↔ (¬B → ¬A)
		if (parent.label === '↔' && parent.children && parent.children.length === 2) {
			const [l, r] = parent.children
			if (l && r && l.label === '→' && r.label === '→') {
				const [a, b] = l.children || []
				const [nb, na] = r.children || []
				if (isNegOf(nb, b || null) && isNegOf(na, a || null)) return 'Contraposition'
			}
		}
		if (parent.label === '⊻') return 'Exclusive Or'
		if (parent.label.startsWith('∀')) return 'Universal Quantification'
		if (parent.label.startsWith('∃')) return 'Existential Quantification'
		if (parent.label === '↔') return 'Biconditional'
		if (parent.label === '→') return 'Implication'
		return operatorName(parent.label)
	}

	function visit(n: AstNodeRec, parent?: AstNodeRec) {
		const isLeaf = !n.children || n.children.length === 0
		const isQuant = !isLeaf && (n.label.startsWith('∀') || n.label.startsWith('∃'))
		const isOperator = ['¬','∧','∨','⊻','→','↔'].includes(n.label) || isQuant
		const isPredicate = !isLeaf && !isOperator
		const name = isLeaf ? n.label : operatorName(n.label)
		const symbol = isLeaf ? undefined : n.label
		const translation = isLeaf ? undefined : operatorTranslation(n.label)
		nodes.push({ id: n.id, label: n.label, name, symbol, translation, color: isLeaf ? '#4169E1' : (isQuant ? '#9370DB' : isPredicate ? '#40c4ff' : '#20B2AA'), type: isLeaf ? 'term' : (isQuant ? 'core' : isPredicate ? 'predicate' : 'premise'), size: isLeaf ? { radius: 20 } : { width: 120, height: 34 } })
		if (parent) {
			const rule = inferEdgeRule(parent, n)
			let edgeType: 'implication' | 'bidirectional' | 'semantic' = 'semantic'
			if (parent.label === '→') edgeType = 'implication'
			if (parent.label === '↔') edgeType = 'bidirectional'
			edges.push({ from: parent.id, to: n.id, weight: 80, style: 'solid', rule, type: edgeType })
			if (edgeType === 'bidirectional') {
				edges.push({ from: n.id, to: parent.id, weight: 80, style: 'solid', rule, type: edgeType })
			}
		}
		n.children?.forEach(c => visit(c, n))
	}
	visit(root)
	return { nodes, edges }
}

// Pretty-print AST back to an expression string using logic symbols
export function astToString(node: AstNodeRec): string {
  function prec(label: string): number {
    if (label === '¬') return 5
    if (label === '∧') return 4
    if (label === '∨' || label === '⊻') return 3
    if (label === '→') return 2
    if (label === '↔') return 1
    return 6
  }
  function isQuant(label: string): boolean { return label.startsWith('∀') || label.startsWith('∃') }
  function print(n: AstNodeRec, parentPrec = 0): string {
    const l = n.label
    const ch = n.children || []
    if (isQuant(l)) {
      // compress consecutive same-quantifier nesting
      const vars: string[] = [l.slice(1)]
      let body: AstNodeRec | undefined = ch[0]
      while (body && isQuant(body.label) && body.label[0] === l[0]) {
        vars.push(body.label.slice(1))
        body = (body.children || [])[0]
      }
      const inner = body ? print(body, 0) : ''
      return `${l[0]}${vars.join(',')} (${inner})`
    }
    if (l === '¬') {
      const inner = ch[0] ? print(ch[0], prec(l)) : ''
      return `¬${inner}`
    }
    if (l === '∧' || l === '∨') {
      const parts = ch.map(c => print(c, prec(l))).join(` ${l} `)
      const s = parts || l
      return parentPrec > prec(l) ? `(${s})` : s
    }
    if (['⊻','→','↔'].includes(l)) {
      const left = ch[0] ? print(ch[0], prec(l)) : ''
      const right = ch[1] ? print(ch[1], prec(l) - 1) : ''
      const s = `${left} ${l} ${right}`
      return parentPrec > prec(l) ? `(${s})` : s
    }
    // predicate/function or variable: if has children, print as Name(args)
    if (ch.length) {
      const args = ch.map(c => print(c, 0)).join(',')
      return `${l}(${args})`
    }
    return l
  }
  return print(node, 0)
}

// Best-effort sanitizer to make rich expressions parsable by our minimal parser
export function sanitizeExpressionForParser(expr: string): string {
  let s = expr
    .replace(/=>/g, '→')
    .replace(/->/g, '→')
    // remove equality and comparison signs not supported by parser
    .replace(/[=<>]+/g, '')
    // collapse decimal points to underscores to avoid quantifier dot token
    .replace(/(\d)\.(\d)/g, '$1_$2')
    // remove stray punctuation
    .replace(/[;%]/g, '')
  return s
}

// ---------- Normalization Helpers ----------

function cloneAst(node: AstNodeRec | null | undefined): AstNodeRec | null {
	if (!node) return null
	return { id: node.id, label: node.label, children: node.children ? node.children.map(c => cloneAst(c)!) : undefined }
}

function make(op: string, ...children: (AstNodeRec | null | undefined)[]): AstNodeRec {
	return { id: genId('n'), label: op, children: children.filter(Boolean) as AstNodeRec[] }
}

export function toNNF(root: AstNodeRec): AstNodeRec {
	function nnf(n: AstNodeRec, negated = false): AstNodeRec {
		const node = cloneAst(n)!
		const lab = node.label
		const ch = node.children || []
		if (!negated) {
			// eliminate → and ↔, ⊻ in positive context
			if (lab === '→') {
				const [a, b] = ch
				return nnf(make('∨', make('¬', a), b), false)
			}
			if (lab === '↔') {
				const [a, b] = ch
				return nnf(make('∨', make('∧', a, b), make('∧', make('¬', a), make('¬', b))), false)
			}
			if (lab === '⊻') {
				const [a, b] = ch
				return nnf(make('∨', make('∧', a, make('¬', b)), make('∧', make('¬', a), b)), false)
			}
			if (lab === '¬') return nnf(ch[0], true)
			if (lab === '∀' || lab.startsWith('∀')) return make(node.label, ch[0] ? nnf(ch[0], false) : undefined)
			if (lab === '∃' || lab.startsWith('∃')) return make(node.label, ch[0] ? nnf(ch[0], false) : undefined)
			if (lab === '∧' || lab === '∨') return make(lab, ...(ch.map(c => nnf(c, false))))
			return node
		} else {
			// negated context: push ¬ inward
			if (lab === '→') {
				const [a, b] = ch
				return nnf(make('∧', a, make('¬', b)), false)
			}
			if (lab === '↔') {
				const [a, b] = ch
				return nnf(make('∨', make('∧', a, make('¬', b)), make('∧', make('¬', a), b)), false)
			}
			if (lab === '⊻') {
				const [a, b] = ch
				return nnf(make('∨', make('∧', a, b), make('∧', make('¬', a), make('¬', b))), false)
			}
			if (lab === '¬') return nnf(ch[0], false)
			if (lab === '∧') return make('∨', ...(ch.map(c => nnf(c, true))))
			if (lab === '∨') return make('∧', ...(ch.map(c => nnf(c, true))))
			if (lab === '∀' || lab.startsWith('∀')) return make(`∃${lab.slice(1)}`, ch[0] ? nnf(ch[0], true) : undefined)
			if (lab === '∃' || lab.startsWith('∃')) return make(`∀${lab.slice(1)}`, ch[0] ? nnf(ch[0], true) : undefined)
			// literal or predicate under negation
			return make('¬', node)
		}
	}
	return nnf(root, false)
}

function distribute(a: AstNodeRec, b: AstNodeRec): AstNodeRec {
	// Distribute OR over AND: a ∨ (b1 ∧ b2) => (a∨b1) ∧ (a∨b2)
	if (a.label === '∧') {
		return make('∧', ...(a.children || []).map(c => distribute(c, b)))
	}
	if (b.label === '∧') {
		return make('∧', ...(b.children || []).map(c => distribute(a, c)))
	}
	// flatten ORs
	const orKids: AstNodeRec[] = []
	const push = (n: AstNodeRec) => { if (n.label === '∨' && n.children) orKids.push(...n.children); else orKids.push(n) }
	push(a); push(b)
	return make('∨', ...orKids)
}

export function toCNF(root: AstNodeRec): AstNodeRec {
	// 1) Convert to NNF
	let nnf = toNNF(root)
	// 2) Recursively distribute OR over AND
	function cnf(n: AstNodeRec): AstNodeRec {
		if (n.label === '∧') return make('∧', ...((n.children || []).map(c => cnf(c))))
		if (n.label === '∨') {
			const kids = (n.children || []).map(c => cnf(c))
			return kids.reduce((acc, cur) => distribute(acc, cur))
		}
		return n
	}
	const out = cnf(nnf)
	return out
}


