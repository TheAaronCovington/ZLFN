export function clamp(val: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, val))
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
	const dx = x2 - x1
	const dy = y2 - y1
	return Math.sqrt(dx * dx + dy * dy)
}

export function midpoint(ax: number, ay: number, bx: number, by: number) {
	return { x: (ax + bx) / 2, y: (ay + by) / 2 }
}

export function edgeKey(e: { source?: any; target?: any; rule?: string; from?: string; to?: string }): string {
	const s = (typeof e.source === 'object' ? e.source?.id : e.source) || e.from || ''
	const t = (typeof e.target === 'object' ? e.target?.id : e.target) || e.to || ''
	return `${s}->${t}:${e.rule || ''}`
}
