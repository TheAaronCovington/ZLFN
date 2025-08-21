export function isTruthTableRelevant(d: any): boolean {
	const s = (d?.symbol || d?.label || '').toString()
	if (!s) return true // show by default when unknown
	return /[¬∧∨⊻→↔]|\b(and|or|not)\b/i.test(s)
}

export function isVennRelevant(d: any): boolean {
	const t = (d?.translation || '').toString()
	const s = (d?.symbol || '').toString()
	if (!t && !s) return true // show by default when unknown
	return /\b(all|some|no)\b/i.test(t) || /→|↔/.test(s)
}

export function isTimelineRelevant(d: any): boolean {
	// Prefer temporal zone, but allow by default
	if (d?.zone === 'temporal' || d?.zoneId === 'temporal') return true
	return true
}

export function isCounterRelevant(d: any): boolean {
	return (d?.type === 'fallacy')
}

export function isRebuttalRelevant(d: any): boolean {
	// Show rebuttal facet for ATN rebuttal nodes or nodes with rebuttal facet enabled
	return (d?.argumentType === 'rebuttal') || (d?.facets?.rebuttalRelevant === true)
}
