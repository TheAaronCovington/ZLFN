import { describe, it, expect } from 'vitest'
import { parseExpressionToAst, astToZlfnGraph, type AstNodeRec, toNNF, toCNF } from './logic'

describe('logic parser', () => {
  it('parses simple implication', () => {
    const ast = parseExpressionToAst('A -> B') as AstNodeRec
    expect(ast).toBeTruthy()
    expect(ast.label).toBe('→')
    expect(ast.children?.[0]?.label).toBe('A')
    expect(ast.children?.[1]?.label).toBe('B')
  })

  it('parses biconditional', () => {
    const ast = parseExpressionToAst('X <-> Y') as AstNodeRec
    expect(ast.label).toBe('↔')
  })

  it('parses ascii operators', () => {
    const ast = parseExpressionToAst('!(A & B) -> ~C | D') as AstNodeRec
    expect(ast).toBeTruthy()
  })

  it('parses quantifiers', () => {
    const all = parseExpressionToAst('∀x (P)') as AstNodeRec
    expect(all.label.startsWith('∀')).toBe(true)
    const exists = parseExpressionToAst('∃y Q') as AstNodeRec
    expect(exists.label.startsWith('∃')).toBe(true)
  })

  it('supports multi-variable quantifiers by nesting', () => {
    const ast = parseExpressionToAst('∀x,y,z. P(x,y,z)') as AstNodeRec
    expect(ast.label.startsWith('∀')).toBe(true)
    const a1 = ast.children?.[0] as AstNodeRec
    expect(a1.label.startsWith('∀')).toBe(true)
    const a2 = a1.children?.[0] as AstNodeRec
    expect(a2.label.startsWith('∀')).toBe(true)
  })

  it('flattens n-ary conjunction', () => {
    const ast = parseExpressionToAst('A & B & C & D') as AstNodeRec
    expect(ast.label).toBe('∧')
    expect(ast.children?.length).toBe(4)
  })

  it('flattens n-ary disjunction', () => {
    const ast = parseExpressionToAst('A | B | C') as AstNodeRec
    expect(ast.label).toBe('∨')
    expect(ast.children?.length).toBe(3)
  })
})

describe('ast to ZLFN graph', () => {
  it('creates nodes and implication edge', () => {
    const ast = parseExpressionToAst('A -> B') as AstNodeRec
    const g = astToZlfnGraph(ast)
    expect(g.nodes.length).toBeGreaterThanOrEqual(3)
    const edge = g.edges.find(e => e.type === 'implication')
    expect(edge).toBeTruthy()
    expect(edge?.rule).toBe('Implication')
  })

  it('creates bidirectional edges for biconditional', () => {
    const ast = parseExpressionToAst('X <-> Y') as AstNodeRec
    const g = astToZlfnGraph(ast)
    const bi = g.edges.filter(e => e.type === 'bidirectional')
    expect(bi.length).toBeGreaterThanOrEqual(2)
  })

  it("labels De Morgan's law", () => {
    const ast = parseExpressionToAst('¬(A & B)') as AstNodeRec
    const g = astToZlfnGraph(ast)
    const dm = g.edges.find(e => e.rule?.includes('De Morgan'))
    expect(dm).toBeTruthy()
  })

  it('labels Contraposition', () => {
    const ast = parseExpressionToAst('(A -> B) <-> (~B -> ~A)') as AstNodeRec
    const g = astToZlfnGraph(ast)
    const cp = g.edges.find(e => e.rule?.includes('Contraposition'))
    expect(cp).toBeTruthy()
  })

  it('detects Double Negation', () => {
    const ast = parseExpressionToAst('¬¬A') as AstNodeRec
    const g = astToZlfnGraph(ast)
    const dn = g.edges.find(e => e.rule?.includes('Double Negation'))
    expect(dn).toBeTruthy()
  })

  it('detects De Morgan on disjunction', () => {
    const ast = parseExpressionToAst('¬(A ∨ B)') as AstNodeRec
    const g = astToZlfnGraph(ast)
    const dm = g.edges.find(e => e.rule?.includes("De Morgan"))
    expect(dm).toBeTruthy()
  })

  it('handles nested quantifiers and predicates', () => {
    const ast = parseExpressionToAst('∀x, y. ∃z. P(x, y, z) -> Q(x)') as AstNodeRec
    expect(ast).toBeTruthy()
    const g = astToZlfnGraph(ast!)
    expect(g.nodes.length).toBeGreaterThan(0)
  })
})

import { describe, it, expect } from 'vitest'
import { parseExpressionToAst, astToZlfnGraph } from './logic'

describe('parseExpressionToAst', () => {
	it('parses basic implication', () => {
		const ast = parseExpressionToAst('A -> B')
		expect(ast).toBeTruthy()
		expect(ast!.label).toBe('→')
		expect(ast!.children?.length).toBe(2)
	})

	it('respects precedence ¬ > ∧ > ∨ > → > ↔', () => {
		const ast = parseExpressionToAst('¬A ∨ B ∧ C')
		expect(ast).toBeTruthy()
		expect(ast!.label).toBe('∨')
		const right = ast!.children![1]
		expect(right.label).toBe('∧')
	})

	it('operator equivalence for ascii vs symbols', () => {
		const sym = parseExpressionToAst('A ∧ B')!
		const ascii = parseExpressionToAst('A & B')!
		expect(sym.label).toBe('∧')
		expect(ascii.label).toBe('∧')

		const impSym = parseExpressionToAst('A → B')!
		const impAscii = parseExpressionToAst('A -> B')!
		expect(impSym.label).toBe('→')
		expect(impAscii.label).toBe('→')

		const iffSym = parseExpressionToAst('A ↔ B')!
		const iffAscii = parseExpressionToAst('A <-> B')!
		expect(iffSym.label).toBe('↔')
		expect(iffAscii.label).toBe('↔')
	})

	it('parentheses and nested negation', () => {
		const ast = parseExpressionToAst('¬(A ∨ B)')!
		expect(ast.label).toBe('¬')
		expect(ast.children![0].label).toBe('∨')

		const nn = parseExpressionToAst('¬¬A')!
		expect(nn.label).toBe('¬')
		expect(nn.children![0].label).toBe('¬')
	})
})

describe('astToZlfnGraph', () => {
	it('produces nodes and edges from AST', () => {
		const ast = parseExpressionToAst('(A ∧ B) → C')!
		const g = astToZlfnGraph(ast)
		expect(g.nodes.length).toBeGreaterThan(0)
		expect(g.edges.length).toBeGreaterThan(0)
	})

	it('edges point parent to child and carry operator rule', () => {
		const ast = parseExpressionToAst('A ∧ B')!
		const g = astToZlfnGraph(ast)
		const root = g.nodes.find(n => n.symbol === '∧')!
		const children = g.edges.filter(e => e.from === root.id)
		expect(children.length).toBe(2)
		children.forEach(e => expect(e.rule).toBe('Conjunction'))
	})
})

import { describe, it, expect } from 'vitest'
import { parseExpressionToAst, astToZlfnGraph, toNNF, toCNF } from './logic'

describe('NNF and CNF', () => {
  it('NNF pushes negation inward and removes implications', () => {
    const ast = parseExpressionToAst('¬(A -> B)') as AstNodeRec
    // @ts-ignore
    const nnfAst = toNNF(ast)
    expect(nnfAst.label).toBe('∧')
  })

  it('CNF distributes OR over AND', () => {
    const ast = parseExpressionToAst('(A | B) & (C | D)') as AstNodeRec
    // @ts-ignore
    const cnfAst = toCNF(ast)
    expect(cnfAst.label).toBe('∧')
  })
})
