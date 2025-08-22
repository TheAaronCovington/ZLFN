// Service to convert markdown documents into SharedArgument objects
// Integrates with the unified data model for cross-view compatibility

import { parseMarkdownStructure, type MarkdownStructure, type MarkdownSection } from './markdownParser'
import type { SharedArgument, Note } from '../context/types'

export interface MarkdownArgumentExtraction {
  arguments: SharedArgument[]
  documentMetadata: {
    title: string
    totalSections: number
    totalExpressions: number
    logicSections: number
  }
}

/**
 * Extract arguments from markdown document content
 */
export function extractArgumentsFromMarkdown(
  documentId: string,
  content: string,
  title?: string
): MarkdownArgumentExtraction {
  const structure = parseMarkdownStructure(content)
  const extractedArguments: SharedArgument[] = []
  
  // Extract document-level argument (all expressions)
  if (structure.expressions.length > 0) {
    const documentArgument: SharedArgument = {
      id: `${documentId}-document`,
      title: title || `Document: ${documentId}`,
      markdown: { documentId, content },
      expressions: structure.expressions.map(expr => expr.expression),
      refs: generateSectionReferences(structure.sections),
      notes: {}
    }
    extractedArguments.push(documentArgument)
  }
  
  // Extract section-level arguments
  const sectionArguments = extractSectionArguments(documentId, structure.sections)
  extractedArguments.push(...sectionArguments)
  
  // Extract expression-level arguments (individual expressions)
  const expressionArguments = extractExpressionArguments(documentId, structure.expressions)
  extractedArguments.push(...expressionArguments)
  
  return {
    arguments: extractedArguments,
    documentMetadata: {
      title: title || documentId,
      totalSections: structure.totalHeadings,
      totalExpressions: structure.expressions.length,
      logicSections: structure.sections.filter(s => s.hasLogicContent).length
    }
  }
}

/**
 * Extract arguments from individual sections
 */
function extractSectionArguments(
  documentId: string,
  sections: MarkdownSection[]
): SharedArgument[] {
  const sectionArguments: SharedArgument[] = []
  
  function processSections(sectionList: MarkdownSection[], parentPath = '') {
    for (const section of sectionList) {
      if (section.hasLogicContent && section.expressionCount > 0) {
        // Extract expressions from this section
        const sectionExpressions = extractExpressionsFromContent(section.content)
        
        if (sectionExpressions.length > 0) {
          const sectionId = `${documentId}-${section.id}`
          const sectionPath = parentPath ? `${parentPath} > ${section.title}` : section.title
          
          const sectionArgument: SharedArgument = {
            id: sectionId,
            title: `Section: ${sectionPath}`,
            markdown: { 
              documentId, 
              content: section.content 
            },
            expressions: sectionExpressions,
            refs: {
              sectionId: section.id,
              sectionTitle: section.title,
              sectionLevel: section.level.toString(),
              documentPath: sectionPath
            },
            notes: {}
          }
          sectionArguments.push(sectionArgument)
        }
      }
      
      // Process child sections recursively
      if (section.children.length > 0) {
        const childPath = parentPath ? `${parentPath} > ${section.title}` : section.title
        processSections(section.children, childPath)
      }
    }
  }
  
  processSections(sections)
  return sectionArguments
}

/**
 * Extract individual expression arguments
 */
function extractExpressionArguments(
  documentId: string,
  expressions: MarkdownStructure['expressions']
): SharedArgument[] {
  return expressions.map((expr, index) => ({
    id: `${documentId}-expr-${index}`,
    title: `Expression ${index + 1}: ${expr.expression.substring(0, 30)}${expr.expression.length > 30 ? '...' : ''}`,
    markdown: { 
      documentId, 
      content: `Expression from line ${expr.line + 1}:\n\n\`\`\`expression\n${expr.expression}\n\`\`\`` 
    },
    expressions: [expr.expression],
    refs: {
      lineNumber: (expr.line + 1).toString(),
      sectionId: expr.sectionId,
      expressionIndex: index.toString()
    },
    notes: {}
  }))
}

/**
 * Extract expressions from markdown content
 */
function extractExpressionsFromContent(content: string): string[] {
  const expressions: string[] = []
  
  // Extract from fenced code blocks
  const fencedRegex = /```\s*(expr|expression|logic)\s+([\s\S]*?)```/gi
  let match: RegExpExecArray | null
  while ((match = fencedRegex.exec(content)) !== null) {
    const expr = match[2]?.trim()
    if (expr) expressions.push(expr)
  }
  
  // Extract from inline expressions
  const inlineRegex = /<expr>(.*?)<\/expr>/gi
  while ((match = inlineRegex.exec(content)) !== null) {
    const expr = match[1]?.trim()
    if (expr) expressions.push(expr)
  }
  
  return expressions
}

/**
 * Generate section references for navigation
 */
function generateSectionReferences(sections: MarkdownSection[]): Record<string, string> {
  const refs: Record<string, string> = {}
  
  function processSections(sectionList: MarkdownSection[], parentPath = '') {
    for (const section of sectionList) {
      const sectionPath = parentPath ? `${parentPath} > ${section.title}` : section.title
      refs[section.id] = sectionPath
      
      if (section.children.length > 0) {
        processSections(section.children, sectionPath)
      }
    }
  }
  
  processSections(sections)
  return refs
}

/**
 * Create notes from markdown comments and annotations
 */
export function extractNotesFromMarkdown(content: string, argumentId: string): Record<string, Note[]> {
  const notes: Record<string, Note[]> = {}
  
  // Extract HTML comments as notes
  const commentRegex = /<!--\s*(.*?)\s*-->/gs
  let match: RegExpExecArray | null
  let noteIndex = 0
  
  while ((match = commentRegex.exec(content)) !== null) {
    const noteText = match[1]?.trim()
    if (noteText) {
      const noteId = `${argumentId}-note-${noteIndex++}`
      const note: Note = {
        id: noteId,
        text: noteText,
        createdAt: new Date().toISOString(),
        author: 'Document Author'
      }
      
      if (!notes['document']) notes['document'] = []
      notes['document'].push(note)
    }
  }
  
  return notes
}

/**
 * Merge multiple markdown documents into unified arguments
 */
export function mergeMarkdownDocuments(
  documents: Array<{ id: string; content: string; title?: string }>
): MarkdownArgumentExtraction {
  const allArguments: SharedArgument[] = []
  let totalSections = 0
  let totalExpressions = 0
  let logicSections = 0
  
  for (const doc of documents) {
    const extraction = extractArgumentsFromMarkdown(doc.id, doc.content, doc.title)
    allArguments.push(...extraction.arguments)
    
    totalSections += extraction.documentMetadata.totalSections
    totalExpressions += extraction.documentMetadata.totalExpressions
    logicSections += extraction.documentMetadata.logicSections
  }
  
  return {
    arguments: allArguments,
    documentMetadata: {
      title: `Merged Documents (${documents.length} documents)`,
      totalSections,
      totalExpressions,
      logicSections
    }
  }
}

/**
 * Update shared argument with new markdown content
 */
export function updateArgumentFromMarkdown(
  existingArgument: SharedArgument,
  newContent: string
): SharedArgument {
  const expressions = extractExpressionsFromContent(newContent)
  const notes = extractNotesFromMarkdown(newContent, existingArgument.id)
  
  return {
    ...existingArgument,
    markdown: {
      ...existingArgument.markdown,
      content: newContent
    },
    expressions: expressions.length > 0 ? expressions : existingArgument.expressions,
    notes: {
      ...existingArgument.notes,
      ...notes
    },
    // Clear cached data to force regeneration
    ast: undefined,
    zlfnGraph: undefined,
    atn: undefined
  }
}
