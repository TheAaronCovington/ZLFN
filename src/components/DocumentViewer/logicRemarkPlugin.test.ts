import { describe, it, expect } from 'vitest'
import { logicRemarkPlugin } from './logicRemarkPlugin'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'

async function render(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    // our plugin injects HTML nodes; then stringify will include them
    .use(function () { return logicRemarkPlugin() as any })
    .use(remarkStringify)
    .process(md)
  return String(file)
}

describe('logicRemarkPlugin', () => {
  it('highlights unicode logical symbols', async () => {
    const out = await render('A ∧ B → C')
    expect(out).toMatch(/logic-symbol/)
  })
  it('highlights ascii equivalents', async () => {
    const out = await render('A & B -> C')
    expect(out).toMatch(/logic-symbol/)
  })
  it('mixed ascii/unicode are both highlighted', async () => {
    const out = await render('A & B → C <-> D')
    // at least two symbol spans
    const matches = out.match(/logic-symbol/g) || []
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })
  it('does not alter code blocks', async () => {
    const out = await render('```\nA & B -> C\n```')
    expect(out).not.toMatch(/logic-symbol/)
  })
})

import { describe, it, expect } from 'vitest'
import { logicRemarkPlugin } from './logicRemarkPlugin'

function runPluginOn(tree: any) {
	const plugin = logicRemarkPlugin() as any
	plugin(tree)
	return tree
}

describe('logicRemarkPlugin', () => {
	it('highlights formal symbols', () => {
		const tree = {
			type: 'root',
			children: [
				{ type: 'paragraph', children: [{ type: 'text', value: 'A → B and A ∧ B' }] },
			],
		}
		runPluginOn(tree)
		const para = tree.children[0]
		const hasSymbolHtml = (para.children || []).some((c: any) => c.type === 'html' && c.value.includes('logic-symbol'))
		expect(hasSymbolHtml).toBe(true)
	})

	it('highlights extra symbols like ⊻, ⊂, ∈', () => {
		const tree = { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'A ⊻ B, A ⊂ B, x ∈ S' }] }] }
		runPluginOn(tree)
		const para = tree.children[0]
		const spans = (para.children || []).filter((c: any) => c.type === 'html' && c.value.includes('logic-symbol'))
		expect(spans.length).toBeGreaterThan(0)
	})

	it('highlights known logic terms as whole words', () => {
		const tree = { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'Premise and Conclusion are valid' }] }] }
		runPluginOn(tree)
		const para = tree.children[0]
		const hasTermHtml = (para.children || []).some((c: any) => c.type === 'html' && c.value.includes('logic-term'))
		expect(hasTermHtml).toBe(true)
	})

	it('does not modify inline code or code blocks', () => {
		// inlineCode
		const inlineTree = { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'inlineCode', value: 'A → B' }] }] }
		runPluginOn(inlineTree)
		const inlineChild = inlineTree.children[0].children[0]
		expect(inlineChild.type).toBe('inlineCode')
		expect(inlineChild.value).toBe('A → B')

		// code block
		const codeTree = { type: 'root', children: [{ type: 'code', value: 'A ∧ B' }] }
		runPluginOn(codeTree)
		const codeNode = codeTree.children[0]
		expect(codeNode.type).toBe('code')
		expect(codeNode.value).toBe('A ∧ B')
	})

	it('avoids false positives inside longer words', () => {
		const tree = { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'sufficiently contains sufficient term' }] }] }
		runPluginOn(tree)
		const para = tree.children[0]
		// should highlight the standalone 'sufficient' but not the substring in 'sufficiently'
		const htmls = (para.children || []).filter((c: any) => c.type === 'html').map((c: any) => c.value)
		const joined = htmls.join('')
		expect(joined.includes('sufficiently')).toBe(true) // original text preserved
		expect(joined.includes('<span class="logic-term">sufficient</span>')).toBe(true)
	})
})
