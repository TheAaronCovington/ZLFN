export type LogicMode = 'classical' | 'epistemic' | 'deontic' | 'temporal' | 'informal' | 'paraconsistent' | 'fuzzy'

export type InferenceEdge = {
	from?: string
	to?: string
	source?: string
	target?: string
	type?: 'implication' | 'counterexample' | 'bidirectional' | 'semantic' | string
	weight?: number
	rule?: string
	priority?: number
}

export function validateRule(_rule?: string, _modes?: Partial<Record<LogicMode, boolean>>): boolean {
	// TODO: implement per-mode rule validation
	return true
}

export function evaluateInference(
	active: Record<string, boolean>,
	edges: InferenceEdge[],
	modes: Partial<Record<LogicMode, boolean>> = { classical: true }
): Record<string, boolean> {
	const next: Record<string, boolean> = { ...active }
	const threshold = modes.fuzzy ? 0 : (modes.epistemic ? 65 : modes.temporal || modes.informal ? 60 : 70)
	// adjacency for forward propagation (ignore counterexamples here; handled in evaluateStates)
	const forward = new Map<string, InferenceEdge[]>()
	for (const e of edges) {
		const src = (e.from ?? e.source) as string | undefined
		const tgt = (e.to ?? e.target) as string | undefined
		if (!src || !tgt) continue
		if (e.type === 'counterexample') continue
		if (!forward.has(src)) forward.set(src, [])
		forward.get(src)!.push(e)
		if (e.type === 'bidirectional') {
			if (!forward.has(tgt)) forward.set(tgt, [])
			forward.get(tgt)!.push({ ...e, from: tgt, to: src })
		}
	}
	// queue-based propagation seeded with currently active nodes
	const q: string[] = Object.keys(next).filter(k => next[k])
	const seen = new Set<string>(q)
	while (q.length) {
		const src = q.shift()!
		for (const e of (forward.get(src) || [])) {
			const tgt = (e.to ?? e.target) as string
			const w = e.weight ?? 0
			if (!modes.fuzzy && w < threshold) continue
			if (!validateRule(e.rule, modes)) continue
			if (!next[tgt]) {
				next[tgt] = true
				if (!seen.has(tgt)) { q.push(tgt); seen.add(tgt) }
			}
		}
	}
	return next
}

export type NodeState = { value: 'T' | 'F' | 'B' | number; weight?: number }

export function buildDependencyMap(edges: InferenceEdge[]): Map<string, string[]> {
	const map = new Map<string, string[]>()
	for (const e of edges) {
		const s = (e.from ?? e.source) as string | undefined
		const t = (e.to ?? e.target) as string | undefined
		if (!s || !t) continue
		if (!map.has(s)) map.set(s, [])
		map.get(s)!.push(t)
	}
	return map
}

export function topoOrder(nodes: string[], edges: InferenceEdge[]): string[] {
	const outgoing = buildDependencyMap(edges)
	const incomingCount = new Map<string, number>(nodes.map(n => [n, 0]))
	for (const entry of outgoing) { const arr = entry[1]; for (const t of arr) incomingCount.set(t, (incomingCount.get(t) || 0) + 1) }
	const q: string[] = []
	for (const [n, c] of incomingCount) if ((c || 0) === 0) q.push(n)
	const out: string[] = []
	while (q.length) {
		const n = q.shift()!
		out.push(n)
		for (const t of outgoing.get(n) || []) {
			const c = (incomingCount.get(t) || 0) - 1
			incomingCount.set(t, c)
			if (c === 0) q.push(t)
		}
	}
	return out.length ? out : nodes
}

export function evaluateStates(
	active: Record<string, boolean>,
	edges: InferenceEdge[],
	modes: Partial<Record<LogicMode, boolean>> = { classical: true }
): { nodeStates: Record<string, NodeState>; conflicts: string[] } {
	const trueSet = new Set<string>(Object.keys(active).filter(k => active[k]))
	const falseSet = new Set<string>()
	const score: Record<string, number> = {}
	const threshold = modes.fuzzy ? 0 : (modes.epistemic ? 65 : modes.temporal || modes.informal ? 60 : 70)
	for (const e of edges) {
		const src = (e.from ?? e.source) as string | undefined
		const tgt = (e.to ?? e.target) as string | undefined
		if (!src || !tgt) continue
		if (!validateRule(e.rule, modes)) continue
		const w = e.weight ?? 0
		if (e.type === 'counterexample') {
			if (trueSet.has(src)) falseSet.add(tgt)
			continue
		}
		if (trueSet.has(src)) {
			if (modes.fuzzy) {
				const v = Math.max(0, Math.min(1, w / 100))
				score[tgt] = Math.max(score[tgt] ?? 0, v)
			} else if (w >= threshold) {
				score[tgt] = 1
			}
		}
	}
	const out: Record<string, NodeState> = {}
	const conflicts: string[] = []
	const ids = new Set<string>([...Object.keys(score), ...trueSet, ...falseSet])
	for (const id of ids) {
		const t = score[id] ?? (trueSet.has(id) ? 1 : 0)
		const f = falseSet.has(id)
		if (modes.fuzzy) {
			if (f && t > 0 && !modes.paraconsistent) conflicts.push(id)
			if (t > 0 || f) out[id] = { value: t, weight: Math.round(t * 100) }
			continue
		}
		if (t > 0 && f) { out[id] = { value: 'B' }; if (!modes.paraconsistent) conflicts.push(id) }
		else if (t > 0) { out[id] = { value: 'T' } }
		else if (f) { out[id] = { value: 'F' } }
	}
	return { nodeStates: out, conflicts }
}
