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

// Known logical rules with their validity constraints
const LOGICAL_RULES = {
	// Classical logic rules
	'Modus Ponens': { modes: ['classical', 'epistemic', 'deontic', 'temporal', 'informal'], strength: 1.0 },
	'Modus Tollens': { modes: ['classical', 'epistemic', 'deontic', 'temporal', 'informal'], strength: 1.0 },
	'Hypothetical Syllogism': { modes: ['classical', 'epistemic', 'deontic', 'temporal', 'informal'], strength: 0.9 },
	'Disjunctive Syllogism': { modes: ['classical', 'epistemic', 'deontic', 'temporal', 'informal'], strength: 0.9 },
	'Contraposition': { modes: ['classical', 'epistemic', 'deontic', 'temporal', 'informal'], strength: 0.95 },
	'De Morgan': { modes: ['classical', 'epistemic', 'deontic', 'temporal', 'informal'], strength: 0.95 },
	'Double Negation': { modes: ['classical', 'epistemic', 'deontic', 'temporal'], strength: 0.9 },
	'Distributivity': { modes: ['classical', 'epistemic', 'deontic', 'temporal', 'informal'], strength: 0.8 },
	
	// Epistemic rules
	'Knowledge Closure': { modes: ['epistemic'], strength: 0.8 },
	'Belief Revision': { modes: ['epistemic', 'paraconsistent'], strength: 0.7 },
	'Testimony': { modes: ['epistemic', 'informal'], strength: 0.6 },
	
	// Deontic rules
	'Ought Implies Can': { modes: ['deontic'], strength: 0.9 },
	'Deontic Closure': { modes: ['deontic'], strength: 0.8 },
	'Supererogation': { modes: ['deontic'], strength: 0.7 },
	
	// Temporal rules
	'Temporal Succession': { modes: ['temporal'], strength: 0.9 },
	'Causality': { modes: ['temporal', 'informal'], strength: 0.8 },
	'Before/After': { modes: ['temporal'], strength: 0.95 },
	
	// Informal reasoning
	'Analogy': { modes: ['informal', 'fuzzy'], strength: 0.6 },
	'Induction': { modes: ['informal', 'fuzzy'], strength: 0.7 },
	'Abduction': { modes: ['informal', 'fuzzy'], strength: 0.65 },
	'Authority': { modes: ['informal'], strength: 0.5 },
	'Statistical': { modes: ['informal', 'fuzzy'], strength: 0.75 },
	
	// Paraconsistent rules
	'Explosion Prevention': { modes: ['paraconsistent'], strength: 1.0 },
	'Relevant Implication': { modes: ['paraconsistent'], strength: 0.8 },
	
	// Fuzzy rules
	'Fuzzy Modus Ponens': { modes: ['fuzzy'], strength: 0.85 },
	'Fuzzy Composition': { modes: ['fuzzy'], strength: 0.8 },
	'Degree Preservation': { modes: ['fuzzy'], strength: 0.9 },
	
	// Fallacies (negative strength)
	'Ad Hominem': { modes: ['classical', 'epistemic', 'deontic', 'temporal', 'informal'], strength: -0.3 },
	'Straw Man': { modes: ['classical', 'epistemic', 'deontic', 'temporal', 'informal'], strength: -0.4 },
	'False Dichotomy': { modes: ['classical', 'epistemic', 'deontic', 'temporal', 'informal'], strength: -0.3 },
	'Circular Reasoning': { modes: ['classical', 'epistemic', 'deontic', 'temporal', 'informal'], strength: -0.5 },
	'Appeal to Authority': { modes: ['informal'], strength: -0.2 },
	'Slippery Slope': { modes: ['informal'], strength: -0.3 },
	'Equivocation': { modes: ['classical', 'epistemic', 'deontic', 'temporal', 'informal'], strength: -0.4 }
} as const

export function validateRule(rule?: string, modes?: Partial<Record<LogicMode, boolean>>): boolean {
	if (!rule) return true // Unknown rules are allowed by default
	
	const ruleInfo = LOGICAL_RULES[rule as keyof typeof LOGICAL_RULES]
	if (!ruleInfo) return true // Unknown rules are allowed
	
	if (!modes) return true // No mode restrictions
	
	// Check if rule is valid in at least one active mode
	const activeModes = Object.keys(modes).filter(m => modes[m as LogicMode])
	if (activeModes.length === 0) return true // No active modes
	
	return ruleInfo.modes.some(validMode => activeModes.includes(validMode))
}

export function getRuleStrength(rule?: string, modes?: Partial<Record<LogicMode, boolean>>): number {
	if (!rule) return 1.0
	
	const ruleInfo = LOGICAL_RULES[rule as keyof typeof LOGICAL_RULES]
	if (!ruleInfo) return 1.0
	
	if (!validateRule(rule, modes)) return 0.0
	
	return Math.abs(ruleInfo.strength) // Return absolute value for strength calculation
}

export function isRuleFallacy(rule?: string): boolean {
	if (!rule) return false
	
	const ruleInfo = LOGICAL_RULES[rule as keyof typeof LOGICAL_RULES]
	return ruleInfo ? ruleInfo.strength < 0 : false
}

export function evaluateInference(
	active: Record<string, boolean>,
	edges: InferenceEdge[],
	modes: Partial<Record<LogicMode, boolean>> = { classical: true }
): Record<string, boolean> {
	const next: Record<string, boolean> = { ...active }
	const threshold = modes.fuzzy ? 0 : (modes.epistemic ? 65 : modes.temporal || modes.informal ? 60 : 70)
	
	// Build adjacency map for forward propagation
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
	
	// Priority queue for weighted propagation
	const q: { nodeId: string; strength: number; priority: number }[] = Object.keys(next)
		.filter(k => next[k])
		.map(k => ({ nodeId: k, strength: 1.0, priority: 0 }))
	
	const seen = new Set<string>(q.map(item => item.nodeId))
	const nodeStrengths: Record<string, number> = {}
	
	// Initialize strengths for active nodes
	q.forEach(item => { nodeStrengths[item.nodeId] = item.strength })
	
	while (q.length) {
		// Sort by priority and strength
		q.sort((a, b) => (b.priority - a.priority) || (b.strength - a.strength))
		const { nodeId: src, strength: srcStrength } = q.shift()!
		
		for (const e of (forward.get(src) || [])) {
			const tgt = (e.to ?? e.target) as string
			const weight = e.weight ?? 100
			const ruleStrength = getRuleStrength(e.rule, modes)
			const priority = e.priority ?? 0
			
			if (!validateRule(e.rule, modes)) continue
			
			// Calculate propagated strength
			let propagatedStrength = srcStrength * ruleStrength * (weight / 100)
			
			// Apply mode-specific adjustments
			if (modes.epistemic) {
				// Epistemic degradation over inference chains
				propagatedStrength *= 0.95
			}
			if (modes.fuzzy) {
				// Fuzzy composition
				propagatedStrength = Math.min(srcStrength, weight / 100) * ruleStrength
			}
			if (modes.paraconsistent && isRuleFallacy(e.rule)) {
				// Handle fallacies in paraconsistent logic
				propagatedStrength = Math.max(0, propagatedStrength - Math.abs(getRuleStrength(e.rule, modes)))
			}
			
			// Check threshold for activation
			const activationThreshold = modes.fuzzy ? 0.1 : threshold / 100
			if (propagatedStrength >= activationThreshold) {
				const currentStrength = nodeStrengths[tgt] ?? 0
				
				if (propagatedStrength > currentStrength) {
					nodeStrengths[tgt] = propagatedStrength
					if (!next[tgt]) {
						next[tgt] = true
						if (!seen.has(tgt)) {
							q.push({ nodeId: tgt, strength: propagatedStrength, priority })
							seen.add(tgt)
						}
					}
				}
			}
		}
	}
	
	return next
}

// Bayesian updating for epistemic reasoning
export function bayesianUpdate(
	priorBelief: number,
	_evidence: number, // Evidence strength (unused in this simplified implementation)
	likelihood: number,
	_baseRate: number = 0.5 // Base rate (unused in this simplified implementation)
): number {
	// P(H|E) = P(E|H) * P(H) / P(E)
	// where P(E) = P(E|H) * P(H) + P(E|¬H) * P(¬H)
	const evidenceGivenNotHypothesis = 1 - likelihood
	const evidenceTotal = likelihood * priorBelief + evidenceGivenNotHypothesis * (1 - priorBelief)
	
	if (evidenceTotal === 0) return priorBelief
	
	return (likelihood * priorBelief) / evidenceTotal
}

// Enhanced propagation with dependency tracking
export function propagateWithDependencies(
	active: Record<string, boolean>,
	edges: InferenceEdge[],
	modes: Partial<Record<LogicMode, boolean>> = { classical: true },
	maxIterations: number = 10
): { 
	result: Record<string, boolean>
	dependencies: Map<string, Set<string>>
	iterations: number 
} {
	const dependencies = new Map<string, Set<string>>()
	let current = { ...active }
	let iteration = 0
	
	// Initialize dependencies for active nodes
	Object.keys(active).forEach(nodeId => {
		if (active[nodeId]) {
			dependencies.set(nodeId, new Set([nodeId]))
		}
	})
	
	while (iteration < maxIterations) {
		const previous = { ...current }
		const next = evaluateInference(current, edges, modes)
		
		// Track dependencies
		for (const e of edges) {
			const src = (e.from ?? e.source) as string | undefined
			const tgt = (e.to ?? e.target) as string | undefined
			if (!src || !tgt) continue
			if (e.type === 'counterexample') continue
			if (!validateRule(e.rule, modes)) continue
			
			if (next[src] && next[tgt]) {
				if (!dependencies.has(tgt)) dependencies.set(tgt, new Set())
				const srcDeps = dependencies.get(src) || new Set([src])
				srcDeps.forEach(dep => dependencies.get(tgt)!.add(dep))
			}
		}
		
		// Check convergence
		const changed = Object.keys(next).some(k => next[k] !== previous[k])
		if (!changed) break
		
		current = next
		iteration++
	}
	
	return { result: current, dependencies, iterations: iteration }
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
