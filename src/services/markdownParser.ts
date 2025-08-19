// Markdown structure parser for generating accordion navigation
// Extracts headings, sections, and content for hierarchical navigation

export interface MarkdownSection {
	id: string
	title: string
	level: number
	content: string
	startLine: number
	endLine: number
	children: MarkdownSection[]
	hasLogicContent: boolean
	expressionCount: number
	argumentCount: number
}

export interface MarkdownStructure {
	sections: MarkdownSection[]
	expressions: Array<{
		expression: string
		line: number
		sectionId: string
	}>
	totalHeadings: number
	maxDepth: number
}

/**
 * Parse markdown content into hierarchical structure
 */
export function parseMarkdownStructure(content: string): MarkdownStructure {
	const lines = content.split('\n')
	const sections: MarkdownSection[] = []
	const expressions: MarkdownStructure['expressions'] = []
	
	let currentSections: MarkdownSection[] = []
	let sectionIdCounter = 1
	
	// Track current position for content extraction
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		const trimmedLine = line.trim()
		
		// Detect headings
		const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/)
		if (headingMatch) {
			const level = headingMatch[1].length
			const title = headingMatch[2].trim()
			const id = `section-${sectionIdCounter++}`
			
			// Extract content from previous section
			if (currentSections.length > 0) {
				const prevSection = currentSections[currentSections.length - 1]
				prevSection.endLine = i - 1
				prevSection.content = extractSectionContent(lines, prevSection.startLine + 1, prevSection.endLine)
				
				// Analyze content for logic elements
				const analysis = analyzeSectionContent(prevSection.content)
				prevSection.hasLogicContent = analysis.hasLogicContent
				prevSection.expressionCount = analysis.expressionCount
				prevSection.argumentCount = analysis.argumentCount
			}
			
			const section: MarkdownSection = {
				id,
				title,
				level,
				content: '',
				startLine: i,
				endLine: lines.length - 1, // Will be updated when next section is found
				children: [],
				hasLogicContent: false,
				expressionCount: 0,
				argumentCount: 0
			}
			
			// Handle nesting based on heading levels
			if (level === 1) {
				// Top-level section
				sections.push(section)
				currentSections = [section]
			} else {
				// Find appropriate parent
				let parentLevel = level - 1
				let parent: MarkdownSection | null = null
				
				// Find the most recent section at the parent level
				for (let j = currentSections.length - 1; j >= 0; j--) {
					if (currentSections[j].level === parentLevel) {
						parent = currentSections[j]
						break
					} else if (currentSections[j].level < parentLevel) {
						parent = currentSections[j]
						break
					}
				}
				
				if (parent) {
					parent.children.push(section)
					// Update current sections stack
					currentSections = currentSections.slice(0, parent.level).concat(section)
				} else {
					// No appropriate parent found, add as top-level
					sections.push(section)
					currentSections = [section]
				}
			}
			

		}
		
		// Detect expressions for cross-referencing
		const expressionMatch = detectExpression(line, i)
		if (expressionMatch) {
			const sectionId = currentSections.length > 0 ? currentSections[currentSections.length - 1].id : 'root'
			expressions.push({
				expression: expressionMatch,
				line: i,
				sectionId
			})
		}
	}
	
	// Handle the last section
	if (currentSections.length > 0) {
		const lastSection = currentSections[currentSections.length - 1]
		lastSection.endLine = lines.length - 1
		lastSection.content = extractSectionContent(lines, lastSection.startLine + 1, lastSection.endLine)
		
		const analysis = analyzeSectionContent(lastSection.content)
		lastSection.hasLogicContent = analysis.hasLogicContent
		lastSection.expressionCount = analysis.expressionCount
		lastSection.argumentCount = analysis.argumentCount
	}
	
	const totalHeadings = countHeadings(sections)
	const maxDepth = calculateMaxDepth(sections)
	
	return {
		sections,
		expressions,
		totalHeadings,
		maxDepth
	}
}

/**
 * Extract content between line ranges
 */
function extractSectionContent(lines: string[], startLine: number, endLine: number): string {
	if (startLine >= lines.length || endLine < startLine) return ''
	return lines.slice(startLine, endLine + 1).join('\n')
}

/**
 * Detect logical expressions in a line
 */
function detectExpression(line: string, _lineNumber: number): string | null {
	// Detect fenced code blocks
	const fencedMatch = line.match(/```\s*(expr|expression|logic)\s+(.*)/i)
	if (fencedMatch && fencedMatch[2]) {
		return fencedMatch[2].trim()
	}
	
	// Detect inline expressions
	const inlineMatch = line.match(/<expr>(.*?)<\/expr>/i)
	if (inlineMatch && inlineMatch[1]) {
		return inlineMatch[1].trim()
	}
	
	return null
}

/**
 * Analyze section content for logical elements
 */
function analyzeSectionContent(content: string): {
	hasLogicContent: boolean
	expressionCount: number
	argumentCount: number
} {
	// Count expressions
	const expressionMatches = content.match(/```\s*(expr|expression|logic)|<expr>.*?<\/expr>/gi) || []
	const expressionCount = expressionMatches.length
	
	// Count arguments (sections with premise/conclusion structure)
	const argumentMatches = content.match(/\*\*premise\*\*|\*\*conclusion\*\*/gi) || []
	const argumentCount = argumentMatches.length > 0 ? Math.ceil(argumentMatches.length / 2) : 0
	
	// Check for logical terminology
	const logicTerms = [
		'premise', 'conclusion', 'argument', 'inference', 'syllogism',
		'modus ponens', 'modus tollens', 'fallacy', 'valid', 'sound',
		'deductive', 'inductive', 'transcendental', 'logic', 'reasoning'
	]
	
	const hasLogicTerms = logicTerms.some(term => 
		content.toLowerCase().includes(term)
	)
	
	const hasLogicSymbols = /[→↔⇒⇔¬∧∨⊻∀∃⊢⊨]/.test(content)
	
	const hasLogicContent = expressionCount > 0 || argumentCount > 0 || hasLogicTerms || hasLogicSymbols
	
	return {
		hasLogicContent,
		expressionCount,
		argumentCount
	}
}

/**
 * Count total headings recursively
 */
function countHeadings(sections: MarkdownSection[]): number {
	return sections.reduce((count, section) => {
		return count + 1 + countHeadings(section.children)
	}, 0)
}

/**
 * Calculate maximum nesting depth
 */
function calculateMaxDepth(sections: MarkdownSection[], currentDepth = 1): number {
	let maxDepth = currentDepth
	for (const section of sections) {
		if (section.children.length > 0) {
			const childDepth = calculateMaxDepth(section.children, currentDepth + 1)
			maxDepth = Math.max(maxDepth, childDepth)
		}
	}
	return maxDepth
}



/**
 * Find section by ID in the structure
 */
export function findSectionById(sections: MarkdownSection[], id: string): MarkdownSection | null {
	for (const section of sections) {
		if (section.id === id) {
			return section
		}
		const found = findSectionById(section.children, id)
		if (found) {
			return found
		}
	}
	return null
}

/**
 * Generate table of contents from structure
 */
export function generateTableOfContents(sections: MarkdownSection[]): Array<{
	id: string
	title: string
	level: number
	hasLogicContent: boolean
	anchor: string
}> {
	const toc: Array<{
		id: string
		title: string
		level: number
		hasLogicContent: boolean
		anchor: string
	}> = []
	
	function processSection(section: MarkdownSection) {
		toc.push({
			id: section.id,
			title: section.title,
			level: section.level,
			hasLogicContent: section.hasLogicContent,
			anchor: `#${section.id}`
		})
		
		section.children.forEach(child => processSection(child))
	}
	
	sections.forEach(section => processSection(section))
	return toc
}
