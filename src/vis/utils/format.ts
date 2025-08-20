export function shortRuleLabel(rule?: string): string {
	if (!rule) return ''
	return rule.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 4)
}

export function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text
	return text.slice(0, maxLength - 3) + '...'
}

export function formatNumber(num: number, decimals = 2): string {
	return num.toFixed(decimals)
}

export function percent(n: number, digits = 0): string {
	return `${(n * 100).toFixed(digits)}%`
}
