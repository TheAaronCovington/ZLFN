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
	const threshold = 70
	const isClassical = !!modes.classical
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
			if (isClassical && w < threshold) continue
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
	for (const e of edges) {
		const src = (e.from ?? e.source) as string | undefined
		const tgt = (e.to ?? e.target) as string | undefined
		if (!src || !tgt) continue
		const w = e.weight ?? 0
		if (!!modes.classical && w < 70) continue
		if (!validateRule(e.rule, modes)) continue
		if (e.type === 'counterexample' && trueSet.has(src)) {
			falseSet.add(tgt)
		}
	}
	const out: Record<string, NodeState> = {}
	const conflicts: string[] = []
	const ids = new Set<string>([...trueSet, ...falseSet])
	for (const id of ids) {
		const t = trueSet.has(id)
		const f = falseSet.has(id)
		if (t && f) { out[id] = { value: 'B' }; conflicts.push(id) }
		else if (t) { out[id] = { value: 'T' } }
		else if (f) { out[id] = { value: 'F' } }
	}
	return { nodeStates: out, conflicts }
}
