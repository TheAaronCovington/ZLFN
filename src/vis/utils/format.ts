export function shortRuleLabel(rule?: string): string {
	if (!rule) return ''
	return rule.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 4)
}

export function percent(n: number, digits = 0): string {
	return `${(n * 100).toFixed(digits)}%`
}
