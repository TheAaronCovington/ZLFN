// Enhanced Export Service for ZLFN Visualizations
// Supports LaTeX, PNG/SVG, proof steps, and academic formats

export interface ExportOptions {
  format: 'latex' | 'png' | 'svg' | 'proof-steps' | 'json' | 'academic-paper'
  includeMetadata: boolean
  includeStyles: boolean
  resolution?: number // For PNG export
  paperSize?: 'a4' | 'letter' | 'custom'
  customSize?: { width: number, height: number }
  title?: string
  author?: string
  description?: string
}

export interface ProofStep {
  step: number
  rule: string
  premises: string[]
  conclusion: string
  justification: string
  type: 'assumption' | 'inference' | 'conclusion'
}

export interface ExportResult {
  content: string | Blob
  filename: string
  mimeType: string
  success: boolean
  error?: string
}

export class EnhancedExporter {
  private svgElement: SVGSVGElement | null = null
  private nodes: any[] = []
  private edges: any[] = []

  constructor(svgElement?: SVGSVGElement) {
    this.svgElement = svgElement || null
  }

  /**
   * Set the graph data for export
   */
  setGraphData(nodes: any[], edges: any[]) {
    this.nodes = nodes
    this.edges = edges
  }

  /**
   * Export to LaTeX format for academic papers
   */
  async exportToLatex(options: ExportOptions): Promise<ExportResult> {
    try {
      const latex = this.generateLatexDocument(options)
      
      return {
        content: latex,
        filename: `${options.title || 'zlfn-graph'}.tex`,
        mimeType: 'text/plain',
        success: true
      }
    } catch (error) {
      return {
        content: '',
        filename: '',
        mimeType: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Export to PNG format
   */
  async exportToPng(options: ExportOptions): Promise<ExportResult> {
    if (!this.svgElement) {
      return {
        content: '',
        filename: '',
        mimeType: '',
        success: false,
        error: 'No SVG element available for export'
      }
    }

    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      
      const svgRect = this.svgElement.getBoundingClientRect()
      const resolution = options.resolution || 2
      
      canvas.width = svgRect.width * resolution
      canvas.height = svgRect.height * resolution
      
      // Scale context for high resolution
      ctx.scale(resolution, resolution)
      
      // Create SVG data URL
      const svgData = new XMLSerializer().serializeToString(this.svgElement)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const svgUrl = URL.createObjectURL(svgBlob)
      
      return new Promise<ExportResult>((resolve) => {
        const img = new Image()
        img.onload = () => {
          // Fill background
          ctx.fillStyle = '#0a0a0f' // Dark theme background
          ctx.fillRect(0, 0, svgRect.width, svgRect.height)
          
          // Draw SVG
          ctx.drawImage(img, 0, 0, svgRect.width, svgRect.height)
          
          // Convert to blob
          canvas.toBlob((blob) => {
            URL.revokeObjectURL(svgUrl)
            
            if (blob) {
              resolve({
                content: blob,
                filename: `${options.title || 'zlfn-graph'}.png`,
                mimeType: 'image/png',
                success: true
              })
            } else {
              resolve({
                content: '',
                filename: '',
                mimeType: '',
                success: false,
                error: 'Failed to create PNG blob'
              })
            }
          }, 'image/png', 0.95)
        }
        
        img.onerror = () => {
          URL.revokeObjectURL(svgUrl)
          resolve({
            content: '',
            filename: '',
            mimeType: '',
            success: false,
            error: 'Failed to load SVG image'
          })
        }
        
        img.src = svgUrl
      })
    } catch (error) {
      return {
        content: '',
        filename: '',
        mimeType: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Export to SVG format
   */
  async exportToSvg(options: ExportOptions): Promise<ExportResult> {
    if (!this.svgElement) {
      return {
        content: '',
        filename: '',
        mimeType: '',
        success: false,
        error: 'No SVG element available for export'
      }
    }

    try {
      // Clone the SVG element
      const svgClone = this.svgElement.cloneNode(true) as SVGSVGElement
      
      // Add metadata if requested
      if (options.includeMetadata) {
        this.addSvgMetadata(svgClone, options)
      }
      
      // Include styles if requested
      if (options.includeStyles) {
        this.embedSvgStyles(svgClone)
      }
      
      const svgData = new XMLSerializer().serializeToString(svgClone)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      
      return {
        content: svgBlob,
        filename: `${options.title || 'zlfn-graph'}.svg`,
        mimeType: 'image/svg+xml',
        success: true
      }
    } catch (error) {
      return {
        content: '',
        filename: '',
        mimeType: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Export proof steps as structured document
   */
  async exportProofSteps(options: ExportOptions): Promise<ExportResult> {
    try {
      const proofSteps = this.generateProofSteps()
      const document = this.formatProofStepsDocument(proofSteps, options)
      
      return {
        content: document,
        filename: `${options.title || 'proof-steps'}.md`,
        mimeType: 'text/markdown',
        success: true
      }
    } catch (error) {
      return {
        content: '',
        filename: '',
        mimeType: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Generate LaTeX document
   */
  private generateLatexDocument(options: ExportOptions): string {
    const title = options.title || 'ZLFN Argument Graph'
    const author = options.author || 'ZLFN Visualizer'
    
    let latex = `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usepackage{graphicx}
\\usepackage{tikz}
\\usepackage{forest}
\\usetikzlibrary{arrows.meta}

\\title{${this.escapeLatex(title)}}
\\author{${this.escapeLatex(author)}}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Argument Structure}

This document presents the logical structure of the argument graph generated by the ZLFN Visualizer.

\\subsection{Nodes}

The argument contains ${this.nodes.length} nodes:

\\begin{itemize}
`

    // Add nodes
    this.nodes.forEach(node => {
      const nodeType = node.type || 'term'
      const label = this.escapeLatex(node.label || node.id)
      latex += `\\item \\textbf{${label}} (${nodeType})\n`
    })

    latex += `\\end{itemize}

\\subsection{Relationships}

The argument contains ${this.edges.length} relationships:

\\begin{itemize}
`

    // Add edges
    this.edges.forEach(edge => {
      const fromNode = this.nodes.find(n => n.id === edge.from)
      const toNode = this.nodes.find(n => n.id === edge.to)
      const fromLabel = this.escapeLatex(fromNode?.label || edge.from)
      const toLabel = this.escapeLatex(toNode?.label || edge.to)
      const edgeType = edge.type || 'implication'
      
      latex += `\\item ${fromLabel} $\\${this.getLatexSymbol(edgeType)}$ ${toLabel}\n`
    })

    latex += `\\end{itemize}

\\subsection{Logical Structure}

\\begin{forest}
for tree={
  draw,
  rounded corners,
  align=center,
  minimum width=2cm,
  minimum height=1cm
}
`

    // Generate tree structure (simplified)
    const rootNodes = this.nodes.filter(node => 
      !this.edges.some(edge => edge.to === node.id)
    )

    rootNodes.forEach(root => {
      latex += this.generateLatexTreeNode(root, 0)
    })

    latex += `\\end{forest}

\\section{Conclusion}

${options.description || 'This argument graph represents the logical structure of the analyzed argument.'}

\\end{document}`

    return latex
  }

  /**
   * Generate proof steps from graph structure
   */
  private generateProofSteps(): ProofStep[] {
    const steps: ProofStep[] = []
    let stepNumber = 1

    // Find premises (nodes with no incoming edges)
    const premises = this.nodes.filter(node => 
      !this.edges.some(edge => edge.to === node.id)
    )

    // Add premises as assumptions
    premises.forEach(premise => {
      steps.push({
        step: stepNumber++,
        rule: 'Assumption',
        premises: [],
        conclusion: premise.label || premise.id,
        justification: 'Given premise',
        type: 'assumption'
      })
    })

    // Process inference steps
    const processed = new Set(premises.map(p => p.id))
    let changed = true

    while (changed) {
      changed = false
      
      this.edges.forEach(edge => {
        if (processed.has(edge.from) && !processed.has(edge.to)) {
          const fromNode = this.nodes.find(n => n.id === edge.from)
          const toNode = this.nodes.find(n => n.id === edge.to)
          
          if (fromNode && toNode) {
            steps.push({
              step: stepNumber++,
              rule: this.getRuleName(edge.type),
              premises: [fromNode.label || fromNode.id],
              conclusion: toNode.label || toNode.id,
              justification: `By ${this.getRuleName(edge.type)} from step ${steps.find(s => s.conclusion === (fromNode.label || fromNode.id))?.step || '?'}`,
              type: 'inference'
            })
            
            processed.add(edge.to)
            changed = true
          }
        }
      })
    }

    return steps
  }

  /**
   * Format proof steps as markdown document
   */
  private formatProofStepsDocument(steps: ProofStep[], options: ExportOptions): string {
    const title = options.title || 'Proof Steps'
    
    let document = `# ${title}

Generated by ZLFN Visualizer on ${new Date().toLocaleDateString()}

## Proof Structure

| Step | Rule | Premises | Conclusion | Justification |
|------|------|----------|------------|---------------|
`

    steps.forEach(step => {
      const premises = step.premises.join(', ') || '—'
      document += `| ${step.step} | ${step.rule} | ${premises} | ${step.conclusion} | ${step.justification} |\n`
    })

    document += `

## Summary

- **Total Steps**: ${steps.length}
- **Assumptions**: ${steps.filter(s => s.type === 'assumption').length}
- **Inferences**: ${steps.filter(s => s.type === 'inference').length}

## Logical Flow

`

    steps.forEach((step) => {
      const indent = step.type === 'assumption' ? '' : '  '
      document += `${indent}${step.step}. **${step.conclusion}** (${step.rule})\n`
    })

    if (options.description) {
      document += `

## Description

${options.description}
`
    }

    return document
  }

  /**
   * Add metadata to SVG
   */
  private addSvgMetadata(svg: SVGSVGElement, options: ExportOptions) {
    const metadata = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'metadata')
    
    const rdf = `
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:dc="http://purl.org/dc/elements/1.1/">
  <rdf:Description>
    <dc:title>${options.title || 'ZLFN Graph'}</dc:title>
    <dc:creator>${options.author || 'ZLFN Visualizer'}</dc:creator>
    <dc:description>${options.description || 'Logical argument visualization'}</dc:description>
    <dc:date>${new Date().toISOString()}</dc:date>
    <dc:format>image/svg+xml</dc:format>
  </rdf:Description>
</rdf:RDF>
`
    
    metadata.innerHTML = rdf
    svg.insertBefore(metadata, svg.firstChild)
  }

  /**
   * Embed CSS styles into SVG
   */
  private embedSvgStyles(svg: SVGSVGElement) {
    const style = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.textContent = `
      .node { fill: var(--ai-bg-elevated); stroke: var(--ai-border-primary); }
      .edge { stroke: var(--ai-cyan); }
      .node text { fill: var(--ai-text-primary); font-family: Inter, sans-serif; }
      .premise { fill: var(--ai-green); }
      .conclusion { fill: var(--ai-blue); }
      .conflict { fill: var(--ai-red); }
    `
    svg.insertBefore(style, svg.firstChild)
  }

  /**
   * Escape LaTeX special characters
   */
  private escapeLatex(text: string): string {
    return text
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/[{}]/g, '\\$&')
      .replace(/[#$%&_^]/g, '\\$&')
      .replace(/~/g, '\\textasciitilde{}')
  }

  /**
   * Get LaTeX symbol for edge type
   */
  private getLatexSymbol(edgeType: string): string {
    switch (edgeType) {
      case 'implication': return 'rightarrow'
      case 'biconditional': return 'leftrightarrow'
      case 'support': return 'Rightarrow'
      case 'attack': return 'nrightarrow'
      default: return 'rightarrow'
    }
  }

  /**
   * Get rule name for edge type
   */
  private getRuleName(edgeType: string): string {
    switch (edgeType) {
      case 'implication': return 'Modus Ponens'
      case 'biconditional': return 'Biconditional Elimination'
      case 'support': return 'Support'
      case 'attack': return 'Rebuttal'
      default: return 'Inference'
    }
  }

  /**
   * Generate LaTeX tree node recursively
   */
  private generateLatexTreeNode(node: any, depth: number): string {
    const label = this.escapeLatex(node.label || node.id)
    const children = this.edges
      .filter(edge => edge.from === node.id)
      .map(edge => this.nodes.find(n => n.id === edge.to))
      .filter(Boolean)

    let latex = `[${label}`
    
    if (children.length > 0) {
      children.forEach(child => {
        latex += this.generateLatexTreeNode(child, depth + 1)
      })
    }
    
    latex += ']'
    return latex
  }
}

/**
 * Create enhanced exporter instance
 */
export function createEnhancedExporter(svgElement?: SVGSVGElement): EnhancedExporter {
  return new EnhancedExporter(svgElement)
}

/**
 * Quick export function for common formats
 */
export async function quickExport(
  format: 'png' | 'svg' | 'latex' | 'proof-steps',
  svgElement: SVGSVGElement,
  nodes: any[],
  edges: any[],
  options: Partial<ExportOptions> = {}
): Promise<ExportResult> {
  const exporter = createEnhancedExporter(svgElement)
  exporter.setGraphData(nodes, edges)
  
  const exportOptions: ExportOptions = {
    format,
    includeMetadata: true,
    includeStyles: true,
    resolution: 2,
    ...options
  }
  
  switch (format) {
    case 'png':
      return exporter.exportToPng(exportOptions)
    case 'svg':
      return exporter.exportToSvg(exportOptions)
    case 'latex':
      return exporter.exportToLatex(exportOptions)
    case 'proof-steps':
      return exporter.exportProofSteps(exportOptions)
    default:
      throw new Error(`Unsupported export format: ${format}`)
  }
}

/**
 * Download export result
 */
export function downloadExportResult(result: ExportResult) {
  if (!result.success) {
    console.error('Export failed:', result.error)
    return
  }
  
  const url = typeof result.content === 'string' 
    ? `data:${result.mimeType};charset=utf-8,${encodeURIComponent(result.content)}`
    : URL.createObjectURL(result.content)
  
  const link = document.createElement('a')
  link.href = url
  link.download = result.filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  if (typeof result.content !== 'string') {
    URL.revokeObjectURL(url)
  }
}
