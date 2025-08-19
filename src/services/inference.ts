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

// Enhanced context-aware rule validation
export function validateRule(
	rule?: string, 
	modes?: Partial<Record<LogicMode, boolean>>,
	context?: {
		sourceNode?: { type?: string; symbol?: string }
		targetNode?: { type?: string; symbol?: string }
		edgeType?: string
		weight?: number
		argumentComplexity?: 'simple' | 'moderate' | 'complex'
	}
): boolean {
	if (!rule) return true // Unknown rules are allowed by default
	
	const ruleInfo = LOGICAL_RULES[rule as keyof typeof LOGICAL_RULES]
	if (!ruleInfo) return true // Unknown rules are allowed
	
	if (!modes) return true // No mode restrictions
	
	// Check if rule is valid in at least one active mode
	const activeModes = Object.keys(modes).filter(m => modes[m as LogicMode])
	if (activeModes.length === 0) return true // No active modes
	
	// Basic mode compatibility check
	const basicValidation = ruleInfo.modes.some(validMode => activeModes.includes(validMode))
	if (!basicValidation) return false
	
	// Enhanced context-specific validation
	if (context) {
		// Validate based on edge type and rule compatibility
		if (context.edgeType === 'counterexample' && !rule.toLowerCase().includes('fallacy') && !rule.toLowerCase().includes('counter')) {
			// Counterexample edges should generally use fallacy or counter rules
			if (ruleInfo.strength > 0) return false
		}
		
		// Validate based on node type compatibility
		if (context.sourceNode?.type === 'premise' && context.targetNode?.type === 'conclusion') {
			// Direct premise-to-conclusion should use strong inference rules
			if (['Analogy', 'Authority', 'Testimony'].includes(rule)) {
				return activeModes.includes('informal') // Only allow in informal mode
			}
		}
		
		// Validate based on weight and rule strength consistency
		if (context.weight !== undefined) {
			const expectedStrength = Math.abs(ruleInfo.strength)
			const weightThreshold = context.weight / 100
			
			// Strong rules should have high weights, weak rules should have low weights
			if (expectedStrength > 0.8 && weightThreshold < 0.6) return false
			if (expectedStrength < 0.5 && weightThreshold > 0.8) return false
		}
		
		// Validate based on argument complexity
		if (context.argumentComplexity) {
			switch (context.argumentComplexity) {
				case 'simple':
					// Simple arguments should avoid complex epistemic or deontic rules
					if (['Knowledge Closure', 'Belief Revision', 'Deontic Closure'].includes(rule)) return false
					break
				case 'complex':
					// Complex arguments can benefit from sophisticated reasoning rules
					if (rule === 'Authority' && !activeModes.includes('informal')) return false
					break
			}
		}
		
		// Temporal logic specific validations
		if (activeModes.includes('temporal')) {
			if (context.sourceNode?.type === 'temporal' || context.targetNode?.type === 'temporal') {
				// Temporal nodes should primarily use temporal rules
				const validTemporalRules = ['Temporal Succession', 'Causality', 'Before/After']
				const hasTemporal = ruleInfo.modes.some(m => m === 'temporal')
				if (!validTemporalRules.includes(rule) && !hasTemporal) {
					return false
				}
			}
		}
		
		// Paraconsistent logic validations
		if (activeModes.includes('paraconsistent')) {
			// In paraconsistent logic, classical contradictions are handled differently
			if (rule === 'Explosion Prevention') return true // Always valid in paraconsistent
			if (['Double Negation', 'Contraposition'].includes(rule)) {
				// These may not hold in paraconsistent systems
				return context.weight ? context.weight < 80 : false
			}
		}
	}
	
	return true
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

// Dynamic representation with adaptive algorithms
export function dynamicEvaluate(
	nodes: Array<{ id: string; type?: string; symbol?: string; complexity?: string }>,
	edges: InferenceEdge[],
	active: Record<string, boolean>,
	modes: Partial<Record<LogicMode, boolean>>,
	options: {
		adaptiveThreshold?: boolean
		learningRate?: number
		maxIterations?: number
		confidenceTracking?: boolean
	} = {}
): {
	result: Record<string, boolean>
	confidence: Record<string, number>
	adaptedThresholds: Record<string, number>
	reasoning: Array<{ step: number; action: string; rule?: string; confidence: number }>
} {
	const {
		adaptiveThreshold = true,
		learningRate = 0.1,
		maxIterations = 20,
		confidenceTracking = true
	} = options
	
	let current = { ...active }
	const confidence: Record<string, number> = {}
	const adaptedThresholds: Record<string, number> = {}
	const reasoning: Array<{ step: number; action: string; rule?: string; confidence: number }> = []
	
	// Initialize confidence and thresholds
	Object.keys(current).forEach(nodeId => {
		confidence[nodeId] = current[nodeId] ? 1.0 : 0.0
		adaptedThresholds[nodeId] = getAdaptiveThreshold(nodeId, modes, nodes.find(n => n.id === nodeId))
	})
	
	for (let iteration = 0; iteration < maxIterations; iteration++) {
		let changed = false
		
		for (const edge of edges) {
			const src = (edge.from ?? edge.source) as string | undefined
			const tgt = (edge.to ?? edge.target) as string | undefined
			if (!src || !tgt) continue
			
			const sourceNode = nodes.find(n => n.id === src)
			const targetNode = nodes.find(n => n.id === tgt)
			
			// Context-aware validation
			const context = {
				sourceNode,
				targetNode,
				edgeType: edge.type,
				weight: edge.weight,
				argumentComplexity: (sourceNode?.complexity as any) || 'moderate'
			}
			
			if (!validateRule(edge.rule, modes, context)) {
				reasoning.push({
					step: iteration,
					action: `Rejected rule ${edge.rule} for ${src} → ${tgt}`,
					rule: edge.rule,
					confidence: 0
				})
				continue
			}
			
			const srcConfidence = confidence[src] || 0
			const currentTargetConfidence = confidence[tgt] || 0
			const ruleStrength = getRuleStrength(edge.rule, modes)
			const weight = (edge.weight || 100) / 100
			
			// Dynamic confidence propagation
			let newConfidence = srcConfidence * ruleStrength * weight
			
			// Apply mode-specific adjustments
			if (modes.epistemic && confidenceTracking) {
				// Epistemic reasoning with uncertainty
				newConfidence *= 0.95 // Slight degradation for epistemic uncertainty
			}
			
			if (modes.fuzzy) {
				// Fuzzy logic composition
				newConfidence = Math.min(srcConfidence, weight) * ruleStrength
			}
			
			if (modes.paraconsistent && edge.type === 'counterexample') {
				// Paraconsistent handling of contradictions
				newConfidence = Math.max(0, currentTargetConfidence - newConfidence)
			}
			
			// Adaptive threshold adjustment
			if (adaptiveThreshold) {
				const baseThreshold = adaptedThresholds[tgt]
				const performance = calculatePerformance(tgt, current, edges, nodes)
				adaptedThresholds[tgt] = adjustThreshold(baseThreshold, performance, learningRate)
			}
			
			const threshold = adaptedThresholds[tgt] || 0.5
			
			if (newConfidence > currentTargetConfidence && newConfidence >= threshold) {
				confidence[tgt] = newConfidence
				const wasActive = current[tgt]
				current[tgt] = true
				
				if (!wasActive) {
					changed = true
					reasoning.push({
						step: iteration,
						action: `Activated ${tgt} via ${edge.rule}`,
						rule: edge.rule,
						confidence: newConfidence
					})
				}
			}
		}
		
		if (!changed) break
	}
	
	return { result: current, confidence, adaptedThresholds, reasoning }
}

function getAdaptiveThreshold(
	_nodeId: string, 
	modes: Partial<Record<LogicMode, boolean>>, 
	node?: { type?: string; complexity?: string }
): number {
	let baseThreshold = 0.7 // Default
	
	// Mode-specific thresholds
	if (modes.epistemic) baseThreshold = 0.65
	if (modes.temporal || modes.informal) baseThreshold = 0.6
	if (modes.fuzzy) baseThreshold = 0.1
	if (modes.paraconsistent) baseThreshold = 0.5
	
	// Node-specific adjustments
	if (node) {
		if (node.type === 'premise') baseThreshold *= 0.9 // Lower threshold for premises
		if (node.type === 'conclusion') baseThreshold *= 1.1 // Higher threshold for conclusions
		if (node.type === 'fallacy') baseThreshold *= 1.3 // Much higher threshold for fallacies
		
		if (node.complexity === 'simple') baseThreshold *= 0.9
		if (node.complexity === 'complex') baseThreshold *= 1.1
	}
	
	return Math.min(0.95, Math.max(0.1, baseThreshold))
}

function calculatePerformance(
	nodeId: string, 
	current: Record<string, boolean>, 
	edges: InferenceEdge[], 
	_nodes: Array<{ id: string; type?: string }>
): number {
	// Simple performance metric based on consistency with neighbors
	let score = 0
	let connections = 0
	
	for (const edge of edges) {
		const src = (edge.from ?? edge.source) as string | undefined
		const tgt = (edge.to ?? edge.target) as string | undefined
		
		if (src === nodeId || tgt === nodeId) {
			connections++
			const otherId = src === nodeId ? tgt : src
			if (otherId && edge.type !== 'counterexample') {
				// Positive connection should have consistent activation
				if (current[nodeId] === current[otherId]) score++
			} else if (otherId && edge.type === 'counterexample') {
				// Counterexample should have opposite activation
				if (current[nodeId] !== current[otherId]) score++
			}
		}
	}
	
	return connections > 0 ? score / connections : 0.5
}

function adjustThreshold(currentThreshold: number, performance: number, learningRate: number): number {
	// Adaptive threshold adjustment based on performance
	const target = 0.75 // Target performance
	const error = target - performance
	const adjustment = learningRate * error
	
	return Math.min(0.95, Math.max(0.1, currentThreshold - adjustment))
}

// Real-time state monitoring and updates
export function createStateMonitor(
	onStateChange: (state: Record<string, boolean>, metadata: { 
		confidence: Record<string, number>
		conflicts: string[]
		reasoning: string 
	}) => void
) {
	let lastState: Record<string, boolean> = {}
	
	return {
		update: (
			nodes: Array<{ id: string; type?: string; symbol?: string }>,
			edges: InferenceEdge[],
			active: Record<string, boolean>,
			modes: Partial<Record<LogicMode, boolean>>
		) => {
			const result = dynamicEvaluate(nodes, edges, active, modes, {
				adaptiveThreshold: true,
				confidenceTracking: true,
				learningRate: 0.05
			})
			
			// Detect changes
			const stateChanged = Object.keys(result.result).some(
				key => result.result[key] !== lastState[key]
			)
			
			if (stateChanged) {
				const conflicts = detectConflicts(result.result, edges)
				const reasoning = generateReasoningExplanation(result.reasoning)
				
				onStateChange(result.result, {
					confidence: result.confidence,
					conflicts,
					reasoning
				})
				
				lastState = result.result
			}
		}
	}
}

function detectConflicts(state: Record<string, boolean>, edges: InferenceEdge[]): string[] {
	const conflicts: string[] = []
	
	for (const edge of edges) {
		if (edge.type === 'counterexample') {
			const src = (edge.from ?? edge.source) as string | undefined
			const tgt = (edge.to ?? edge.target) as string | undefined
			
			if (src && tgt && state[src] && state[tgt]) {
				conflicts.push(tgt)
			}
		}
	}
	
	return conflicts
}

function generateReasoningExplanation(reasoning: Array<{ step: number; action: string; rule?: string; confidence: number }>): string {
	if (reasoning.length === 0) return "No inference steps taken."
	
	const steps = reasoning.slice(-3) // Last 3 steps
	return steps.map(step => 
		`Step ${step.step}: ${step.action} (confidence: ${(step.confidence * 100).toFixed(1)}%)`
	).join(' • ')
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
