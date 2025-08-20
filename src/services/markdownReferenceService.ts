/**
 * Markdown Reference Service
 * Manages linking between ZLFN nodes and markdown document sections
 */

import { parseMarkdownStructure, type MarkdownSection } from './markdownParser';

export interface MarkdownReference {
  documentId: string;
  documentTitle: string;
  sectionId: string;
  sectionTitle: string;
  sectionPath: string;
  content?: string;
  lineRange?: { start: number; end: number };
}

export interface DocumentInfo {
  id: string;
  title: string;
  content: string;
  lastModified?: string;
  sections?: MarkdownSection[];
}

class MarkdownReferenceService {
  private documentCache = new Map<string, DocumentInfo>();
  private sectionCache = new Map<string, MarkdownSection[]>();

  /**
   * Parse a reference string into components
   * Format: "documentId#sectionId" or "documentId#sectionId:lineStart-lineEnd"
   */
  parseReference(reference: string): { documentId: string; sectionId: string; lineRange?: { start: number; end: number } } | null {
    try {
      const [docPart, linePart] = reference.split(':');
      const [documentId, sectionId] = docPart.split('#');
      
      if (!documentId || !sectionId) {
        return null;
      }

      let lineRange: { start: number; end: number } | undefined;
      if (linePart) {
        const [start, end] = linePart.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          lineRange = { start, end };
        }
      }

      return { documentId, sectionId, lineRange };
    } catch (error) {
      console.error('Error parsing reference:', error);
      return null;
    }
  }

  /**
   * Create a reference string from components
   */
  createReference(documentId: string, sectionId: string, lineRange?: { start: number; end: number }): string {
    let reference = `${documentId}#${sectionId}`;
    if (lineRange) {
      reference += `:${lineRange.start}-${lineRange.end}`;
    }
    return reference;
  }

  /**
   * Load available documents
   */
  async getAvailableDocuments(): Promise<DocumentInfo[]> {
    try {
      // In a real implementation, this would fetch from the API
      // For now, return mock documents
      const mockDocuments: DocumentInfo[] = [
        {
          id: 'logic_demo',
          title: 'Logic Demo Document',
          content: `# Logic Fundamentals

## Introduction
This document covers the basic principles of logical reasoning and argumentation theory.

### Core Concepts
Logic is the systematic study of valid inference and correct reasoning. It provides the foundation for all rational thought and scientific inquiry.

#### Premises and Conclusions
Arguments consist of premises that support conclusions. The strength of an argument depends on both the truth of its premises and the validity of its logical structure.

##### Example: Basic Syllogism
- Premise 1: All humans are mortal
- Premise 2: Socrates is human
- Conclusion: Therefore, Socrates is mortal

## Advanced Topics

### Formal Logic
Mathematical approach to logical reasoning using symbols and formal systems.

#### Propositional Logic
Deals with propositions and their logical relationships using operators like AND, OR, NOT.

#### Predicate Logic
Extends propositional logic with quantifiers and predicates to handle more complex statements.

### Informal Logic
Natural language reasoning and argumentation in everyday contexts.

#### Fallacies
Common errors in reasoning that undermine the validity of arguments.

##### Ad Hominem
Attacking the person making the argument rather than the argument itself.

##### Straw Man
Misrepresenting someone's argument to make it easier to attack.

## Practical Applications

### Critical Thinking
Applying logical principles to evaluate information and make sound decisions.

### Debate and Argumentation
Using logical structures to construct persuasive and valid arguments.`,
          lastModified: new Date().toISOString()
        },
        {
          id: 'argument_analysis',
          title: 'Argument Analysis Guide',
          content: `# Argument Analysis

## Structure Analysis
Breaking down arguments into their component parts for better understanding and evaluation.

### Premise Identification
How to identify supporting statements that provide evidence for the conclusion.

#### Types of Premises
- Factual premises: Based on observable facts
- Value premises: Based on moral or aesthetic judgments
- Definitional premises: Based on the meaning of terms

### Conclusion Recognition
Finding the main claim being argued and distinguishing it from supporting evidence.

#### Indicator Words
- Conclusion indicators: therefore, thus, hence, so, consequently
- Premise indicators: because, since, given that, for, as

## Validity Assessment

### Logical Validity
When conclusions follow logically from premises, regardless of whether the premises are true.

#### Deductive Validity
Arguments where the conclusion must be true if the premises are true.

#### Inductive Strength
Arguments where the conclusion is probably true if the premises are true.

### Soundness
Valid arguments with true premises - the gold standard of logical reasoning.

## Common Argument Patterns

### Modus Ponens
If P then Q; P; therefore Q

### Modus Tollens
If P then Q; not Q; therefore not P

### Hypothetical Syllogism
If P then Q; if Q then R; therefore if P then R`,
          lastModified: new Date().toISOString()
        }
      ];

      // Cache the documents
      mockDocuments.forEach(doc => {
        this.documentCache.set(doc.id, doc);
      });

      return mockDocuments;
    } catch (error) {
      console.error('Error loading documents:', error);
      return [];
    }
  }

  /**
   * Get a specific document by ID
   */
  async getDocument(documentId: string): Promise<DocumentInfo | null> {
    try {
      // Check cache first
      if (this.documentCache.has(documentId)) {
        return this.documentCache.get(documentId)!;
      }

      // In a real implementation, fetch from API
      const documents = await this.getAvailableDocuments();
      return documents.find(doc => doc.id === documentId) || null;
    } catch (error) {
      console.error('Error getting document:', error);
      return null;
    }
  }

  /**
   * Get sections for a document
   */
  async getDocumentSections(documentId: string): Promise<MarkdownSection[]> {
    try {
      // Check cache first
      if (this.sectionCache.has(documentId)) {
        return this.sectionCache.get(documentId)!;
      }

      const document = await this.getDocument(documentId);
      if (!document) {
        return [];
      }

      const structure = parseMarkdownStructure(document.content);
      this.sectionCache.set(documentId, structure.sections);
      
      return structure.sections;
    } catch (error) {
      console.error('Error getting document sections:', error);
      return [];
    }
  }

  /**
   * Find a specific section by ID
   */
  findSectionById(sectionId: string, sections: MarkdownSection[]): MarkdownSection | null {
    for (const section of sections) {
      if (section.id === sectionId) {
        return section;
      }
      if (section.children.length > 0) {
        const found = this.findSectionById(sectionId, section.children);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Get the full path to a section
   */
  getSectionPath(sectionId: string, sections: MarkdownSection[], path: string[] = []): string[] | null {
    for (const section of sections) {
      const currentPath = [...path, section.title];
      if (section.id === sectionId) {
        return currentPath;
      }
      if (section.children.length > 0) {
        const childPath = this.getSectionPath(sectionId, section.children, currentPath);
        if (childPath) {
          return childPath;
        }
      }
    }
    return null;
  }

  /**
   * Resolve a reference string to full reference information
   */
  async resolveReference(reference: string): Promise<MarkdownReference | null> {
    try {
      const parsed = this.parseReference(reference);
      if (!parsed) {
        return null;
      }

      const document = await this.getDocument(parsed.documentId);
      if (!document) {
        return null;
      }

      const sections = await this.getDocumentSections(parsed.documentId);
      const section = this.findSectionById(parsed.sectionId, sections);
      if (!section) {
        return null;
      }

      const sectionPath = this.getSectionPath(parsed.sectionId, sections);
      if (!sectionPath) {
        return null;
      }

      return {
        documentId: parsed.documentId,
        documentTitle: document.title,
        sectionId: parsed.sectionId,
        sectionTitle: section.title,
        sectionPath: sectionPath.join(' > '),
        content: section.content,
        lineRange: parsed.lineRange || { start: section.startLine, end: section.endLine }
      };
    } catch (error) {
      console.error('Error resolving reference:', error);
      return null;
    }
  }

  /**
   * Get all nodes that reference a specific document section
   */
  async getNodesReferencingSection(_documentId: string, _sectionId: string): Promise<string[]> {
    try {
      // In a real implementation, this would query the database
      // For now, return empty array as this would require scanning all nodes
      return [];
    } catch (error) {
      console.error('Error getting nodes referencing section:', error);
      return [];
    }
  }

  /**
   * Validate that a reference is still valid
   */
  async validateReference(reference: string): Promise<boolean> {
    try {
      const resolved = await this.resolveReference(reference);
      return resolved !== null;
    } catch (error) {
      console.error('Error validating reference:', error);
      return false;
    }
  }

  /**
   * Get content excerpt from a reference
   */
  async getContentExcerpt(reference: string, maxLength: number = 200): Promise<string | null> {
    try {
      const resolved = await this.resolveReference(reference);
      if (!resolved || !resolved.content) {
        return null;
      }

      const content = resolved.content.trim();
      if (content.length <= maxLength) {
        return content;
      }

      return content.substring(0, maxLength) + '...';
    } catch (error) {
      console.error('Error getting content excerpt:', error);
      return null;
    }
  }

  /**
   * Clear caches
   */
  clearCache(): void {
    this.documentCache.clear();
    this.sectionCache.clear();
  }
}

// Export singleton instance
export const markdownReferenceService = new MarkdownReferenceService();
export default markdownReferenceService;
