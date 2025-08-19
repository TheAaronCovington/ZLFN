// Enhanced document parsing service for dynamic ZLFN integration
// Extracts structured logical arguments from markdown documents

import { parseExpressionToAst, astToZlfnGraph } from './logic'
import { getDocumentContent } from './docs'
import type { ZlfnNode, ZlfnEdge } from '../components/Visualizations/ZlfnGraph'

export interface LogicalArgument {
	id: string
	title: string
	premises: string[]
	conclusions: string[]
	expressions: string[]
	type: 'deductive' | 'inductive' | 'abductive' | 'transcendental'
	validity?: 'valid' | 'invalid' | 'unknown'
	soundness?: 'sound' | 'unsound' | 'unknown'
	context?: string
	source?: {
		document: string
		section: string
		line?: number
	}
}

export interface ParsedDocument {
	id: string
	title: string
	arguments: LogicalArgument[]
	expressions: Array<{
		expression: string
		context: string
		line: number
		argumentId?: string
	}>
	metadata: {
		tags: string[]
		complexity: 'simple' | 'moderate' | 'complex'
		topics: string[]
	}
}

export interface DocumentGraphData {
	nodes: ZlfnNode[]
	edges: ZlfnEdge[]
	arguments: LogicalArgument[]
	documentId: string
}

/**
 * Extract expressions from markdown content with enhanced context
 */
export function extractExpressions(content: string, _documentId: string): ParsedDocument['expressions'] {
	const expressions: ParsedDocument['expressions'] = []
	const lines = content.split('\n')
	
	// Extract from fenced code blocks with language tags
	const fencedRegex = /```\s*(expr|expression|logic)\s+([\s\S]*?)```/gi
	let match: RegExpExecArray | null
	
	while ((match = fencedRegex.exec(content)) !== null) {
		const expr = (match[2] || '').trim()
		if (expr) {
			// Find line number
			const beforeMatch = content.substring(0, match.index)
			const lineNumber = beforeMatch.split('\n').length
			
			// Extract context (surrounding paragraph or heading)
			const contextLines = lines.slice(Math.max(0, lineNumber - 5), lineNumber)
			const context = contextLines
				.filter(line => line.trim() && !line.startsWith('```'))
				.pop() || ''
			
			expressions.push({
				expression: expr,
				context: context.replace(/[#*]/g, '').trim(),
				line: lineNumber
			})
		}
	}
	
	// Extract inline expressions with special markup
	const inlineRegex = /<expr>(.*?)<\/expr>/gi
	while ((match = inlineRegex.exec(content)) !== null) {
		const expr = (match[1] || '').trim()
		if (expr) {
			const beforeMatch = content.substring(0, match.index)
			const lineNumber = beforeMatch.split('\n').length
			const contextLine = lines[lineNumber - 1] || ''
			
			expressions.push({
				expression: expr,
				context: contextLine.replace(/[#*<>]/g, '').trim(),
				line: lineNumber
			})
		}
	}
	
	return expressions
}

/**
 * Parse logical arguments from structured markdown content
 */
export function parseLogicalArguments(content: string, documentId: string): LogicalArgument[] {
	const logicalArguments: LogicalArgument[] = []
	const lines = content.split('\n')
	
	// Look for argument structures with headers and numbered premises/conclusions
	let currentArgument: Partial<LogicalArgument> | null = null
	let currentSection = ''
	let argumentCounter = 1
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim()
		
		// Detect argument headers
		if (line.match(/^#+\s*(argument|proof|reasoning|syllogism)/i)) {
			if (currentArgument && currentArgument.premises?.length) {
				// Complete previous argument
				logicalArguments.push({
					id: `${documentId}_arg_${argumentCounter++}`,
					title: currentArgument.title || 'Untitled Argument',
					premises: currentArgument.premises || [],
					conclusions: currentArgument.conclusions || [],
					expressions: currentArgument.expressions || [],
					type: currentArgument.type || 'deductive',
					source: {
						document: documentId,
						section: currentSection
					}
				} as LogicalArgument)
			}
			
			currentArgument = {
				title: line.replace(/^#+\s*/, ''),
				premises: [],
				conclusions: [],
				expressions: [],
				type: 'deductive'
			}
			currentSection = line.replace(/^#+\s*/, '')
		}
		
		// Detect premises and conclusions
		if (currentArgument && line.match(/^\d+\.\s*\*\*premise/i)) {
			const premise = line.replace(/^\d+\.\s*\*\*premise\*\*:?\s*/i, '')
			currentArgument.premises!.push(premise)
		}
		
		if (currentArgument && line.match(/^\d+\.\s*\*\*conclusion/i)) {
			const conclusion = line.replace(/^\d+\.\s*\*\*conclusion\*\*:?\s*/i, '')
			currentArgument.conclusions!.push(conclusion)
		}
		
		// Extract argument type from context
		if (currentArgument && line.match(/\b(inductive|abductive|transcendental)\b/i)) {
			const match = line.match(/\b(inductive|abductive|transcendental)\b/i)
			if (match) {
				currentArgument.type = match[1].toLowerCase() as LogicalArgument['type']
			}
		}
	}
	
	// Complete last argument
	if (currentArgument && currentArgument.premises?.length) {
		logicalArguments.push({
			id: `${documentId}_arg_${argumentCounter}`,
			title: currentArgument.title || 'Untitled Argument',
			premises: currentArgument.premises || [],
			conclusions: currentArgument.conclusions || [],
			expressions: currentArgument.expressions || [],
			type: currentArgument.type || 'deductive',
			source: {
				document: documentId,
				section: currentSection
			}
		} as LogicalArgument)
	}
	
	return logicalArguments
}

/**
 * Analyze document complexity and generate metadata
 */
export function analyzeDocumentMetadata(content: string, expressions: string[]): ParsedDocument['metadata'] {
	const complexity = expressions.length > 10 ? 'complex' : 
					  expressions.length > 3 ? 'moderate' : 'simple'
	
	// Extract tags from content patterns
	const tags: string[] = []
	const topics: string[] = []
	
	// Common logic topics
	const topicPatterns = [
		{ pattern: /\b(modus ponens|modus tollens)\b/gi, topic: 'propositional-logic' },
		{ pattern: /\b(syllogism|categorical)\b/gi, topic: 'categorical-logic' },
		{ pattern: /\b(predicate|quantifier|∀|∃)\b/gi, topic: 'predicate-logic' },
		{ pattern: /\b(modal|necessity|possibility)\b/gi, topic: 'modal-logic' },
		{ pattern: /\b(epistemic|knowledge|belief)\b/gi, topic: 'epistemology' },
		{ pattern: /\b(deontic|ought|obligation)\b/gi, topic: 'ethics' },
		{ pattern: /\b(temporal|time|future|past)\b/gi, topic: 'temporal-logic' },
		{ pattern: /\b(transcendental|presupposition)\b/gi, topic: 'transcendental' },
		{ pattern: /\b(fallacy|fallacies|invalid)\b/gi, topic: 'fallacies' }
	]
	
	for (const { pattern, topic } of topicPatterns) {
		if (pattern.test(content)) {
			topics.push(topic)
		}
	}
	
	// Generate tags based on complexity and topics
	if (complexity === 'complex') tags.push('advanced')
	if (topics.includes('predicate-logic')) tags.push('formal')
	if (topics.includes('transcendental')) tags.push('philosophy')
	if (topics.includes('fallacies')) tags.push('critical-thinking')
	
	return { tags, complexity, topics }
}

/**
 * Convert logical arguments to ZLFN graph format
 */
export function argumentsToZlfnGraph(logicalArguments: LogicalArgument[]): { nodes: ZlfnNode[], edges: ZlfnEdge[] } {
	const nodes: ZlfnNode[] = []
	const edges: ZlfnEdge[] = []
	
	for (const arg of logicalArguments) {
		const argId = arg.id
		
		// Create premise nodes
		arg.premises.forEach((premise, idx) => {
			const nodeId = `${argId}_P${idx + 1}`
			nodes.push({
				id: nodeId,
				label: `P${idx + 1}`,
				name: premise.substring(0, 50) + (premise.length > 50 ? '...' : ''),
				color: '#20B2AA',
				type: 'premise',
				size: { width: 120, height: 35 },
				argumentId: argId,
				facets: {
					vennRelevant: true,
					truthTableRelevant: true,
					timelineRelevant: arg.type === 'transcendental',
					counterRelevant: false
				}
			})
		})
		
		// Create conclusion nodes
		arg.conclusions.forEach((conclusion, idx) => {
			const nodeId = `${argId}_C${idx + 1}`
			nodes.push({
				id: nodeId,
				label: `C${idx + 1}`,
				name: conclusion.substring(0, 50) + (conclusion.length > 50 ? '...' : ''),
				color: '#9370DB',
				type: 'conclusion',
				size: { width: 120, height: 35 },
				argumentId: argId,
				facets: {
					vennRelevant: true,
					truthTableRelevant: true,
					timelineRelevant: arg.type === 'transcendental',
					counterRelevant: false
				}
			})
		})
		
		// Create edges from premises to conclusions
		arg.premises.forEach((_, pIdx) => {
			arg.conclusions.forEach((_, cIdx) => {
				const fromId = `${argId}_P${pIdx + 1}`
				const toId = `${argId}_C${cIdx + 1}`
				
				edges.push({
					from: fromId,
					to: toId,
					weight: arg.type === 'deductive' ? 90 : arg.type === 'inductive' ? 70 : 60,
					style: arg.type === 'deductive' ? 'solid' : 'dashed',
					rule: getInferenceRule(arg.type),
					type: 'implication'
				})
			})
		})
		
		// Add intermediate reasoning nodes for complex arguments
		if (arg.premises.length > 2) {
			const intermediateId = `${argId}_INT`
			nodes.push({
				id: intermediateId,
				label: 'INT',
				name: 'Intermediate step',
				color: '#4169E1',
				type: 'term',
				size: { radius: 25 },
				argumentId: argId
			})
			
			// Connect first two premises to intermediate
			if (arg.premises.length >= 2) {
				edges.push({
					from: `${argId}_P1`,
					to: intermediateId,
					weight: 75,
					style: 'solid',
					rule: 'Conjunction',
					type: 'semantic'
				})
				edges.push({
					from: `${argId}_P2`,
					to: intermediateId,
					weight: 75,
					style: 'solid',
					rule: 'Conjunction',
					type: 'semantic'
				})
			}
		}
	}
	
	return { nodes, edges }
}

function getInferenceRule(type: LogicalArgument['type']): string {
	switch (type) {
		case 'deductive': return 'Deductive Inference'
		case 'inductive': return 'Inductive Inference'
		case 'abductive': return 'Abductive Inference'
		case 'transcendental': return 'Transcendental Argument'
		default: return 'Logical Inference'
	}
}

/**
 * Main function to parse a document and generate ZLFN graph data
 */
export async function parseDocumentToGraph(documentId: string): Promise<DocumentGraphData | null> {
	try {
		const content = await getDocumentContent(documentId)
		if (!content) return null
		
		const expressions = extractExpressions(content, documentId)
		const logicalArguments = parseLogicalArguments(content, documentId)
		
		// Parse expressions to AST and convert to ZLFN
		const expressionGraphs = expressions
			.map(expr => {
				const ast = parseExpressionToAst(expr.expression)
				return ast ? astToZlfnGraph(ast) : null
			})
			.filter(Boolean) as Array<{ nodes: ZlfnNode[], edges: ZlfnEdge[] }>
		
		// Combine AST graphs with argument structures
		const argumentGraph = argumentsToZlfnGraph(logicalArguments)
		
		// Merge all nodes and edges
		const allNodes = [
			...argumentGraph.nodes,
			...expressionGraphs.flatMap(g => g.nodes.map(n => ({
				...n,
				argumentId: documentId, // Associate with document
				facets: {
					vennRelevant: true,
					truthTableRelevant: true,
					timelineRelevant: false,
					counterRelevant: false
				}
			})))
		]
		
		const allEdges = [
			...argumentGraph.edges,
			...expressionGraphs.flatMap(g => g.edges)
		]
		
		// Remove duplicates and add IDs for uniqueness
		const uniqueNodes = allNodes.filter((node, index, array) => 
			array.findIndex(n => n.id === node.id) === index
		)
		
		const uniqueEdges = allEdges.filter((edge, index, array) => 
			array.findIndex(e => e.from === edge.from && e.to === edge.to) === index
		)
		
		return {
			nodes: uniqueNodes,
			edges: uniqueEdges,
			arguments: logicalArguments,
			documentId
		}
	} catch (error) {
		console.error(`Failed to parse document ${documentId}:`, error)
		return null
	}
}

/**
 * Generate enhanced nodes for document-based graphs with better categorization
 */
export function enhanceNodesWithDocumentContext(nodes: ZlfnNode[], _documentId: string, logicalArguments: LogicalArgument[]): ZlfnNode[] {
	return nodes.map(node => {
		// Find which argument this node belongs to
		const argument = logicalArguments.find(arg => node.argumentId === arg.id)
		
		return {
			...node,
			// Add document metadata
			zone: argument?.type === 'transcendental' ? 'Philosophy' : 
				  argument?.type === 'inductive' ? 'Informal' : 
				  'Logic',
			// Enhanced facet relevance based on argument type
			facets: {
				...node.facets,
				timelineRelevant: argument?.type === 'transcendental' || 
								 argument?.type === 'abductive',
				counterRelevant: argument?.validity === 'invalid' || 
							    argument?.soundness === 'unsound'
			},
			// Add complexity indicators
			complexity: argument ? 
						(argument.premises.length > 3 ? 'complex' : 
						 argument.premises.length > 1 ? 'moderate' : 'simple') : 
						'simple'
		}
	})
}
