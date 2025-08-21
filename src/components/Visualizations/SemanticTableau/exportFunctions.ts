/**
 * Export Functions for SemanticTableau
 * Handles LaTeX, image, and proof steps export functionality
 */

import { astToString } from '../../../services/logic'
import type { TableauNode } from './tableauLogic'
import { getRuleName, checkAllBranchesClosed, findOpenBranches } from './tableauLogic'

export interface ProofStep {
  step: number
  action: string
  formula: string
  rule: string
  justification: string
  branchStatus: 'open' | 'closed' | 'continuing'
}

export interface LatexExportOptions {
  includeProofSteps?: boolean
  usePackages?: string[]
  documentClass?: string
}

export interface ImageExportOptions {
  format: 'png' | 'svg'
  backgroundColor?: string
  padding?: number
  filename?: string
}

/**
 * Generates LaTeX document for semantic tableau
 */
export function generateTableauLatex(
  tableauRoot: TableauNode,
  expression: string,
  options: LatexExportOptions = {}
): string {
  const {
    includeProofSteps = true,
    usePackages = ['amsmath', 'amsfonts', 'amssyb', 'proof', 'bussproofs', 'tikz'],
    documentClass = 'article'
  } = options

  const lines: string[] = []
  
  // LaTeX document header
  lines.push(`\\documentclass{${documentClass}}`)
  usePackages.forEach(pkg => {
    lines.push(`\\usepackage{${pkg}}`)
  })
  lines.push('\\usetikzlibrary{trees}')
  lines.push('')
  lines.push('\\begin{document}')
  lines.push('')
  lines.push(`\\title{Semantic Tableau for: $${latexifyFormula(expression)}$}`)
  lines.push('\\maketitle')
  lines.push('')
  
  // Generate tableau using tikz
  lines.push('\\begin{figure}[h]')
  lines.push('\\centering')
  lines.push('\\begin{tikzpicture}[')
  lines.push('  level distance=1.5cm,')
  lines.push('  level 1/.style={sibling distance=4cm},')
  lines.push('  level 2/.style={sibling distance=2cm},')
  lines.push('  level 3/.style={sibling distance=1cm}')
  lines.push(']')
  
  // Generate tree structure
  function generateLatexNode(node: TableauNode): string {
    const formula = latexifyFormula(node.label)
    let nodeStr = `node {$${formula}$}`
    
    if (node.type === 'closed') {
      nodeStr += ' [fill=red!20]'
    } else if (node.type === 'root') {
      nodeStr += ' [fill=blue!20]'
    }
    
    if (node.children && node.children.length > 0) {
      const childrenStr = node.children.map(child => 
        `child { ${generateLatexNode(child)} }`
      ).join(' ')
      nodeStr += ` ${childrenStr}`
    }
    
    return nodeStr
  }
  
  lines.push(`\\${generateLatexNode(tableauRoot)};`)
  lines.push('\\end{tikzpicture}')
  lines.push(`\\caption{Semantic tableau for $${latexifyFormula(expression)}$}`)
  lines.push('\\end{figure}')
  lines.push('')
  
  if (includeProofSteps) {
    lines.push('\\section{Proof Steps}')
    lines.push('\\begin{enumerate}')
    
    const addLatexProofSteps = (node: TableauNode) => {
      const formula = latexifyFormula(node.label)
      lines.push(`\\item $${formula}$`)
      
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => addLatexProofSteps(child))
      }
      
      if (node.type === 'closed') {
        lines.push('\\item[$\\bot$] Contradiction - branch closes')
      }
    }
    
    addLatexProofSteps(tableauRoot)
    lines.push('\\end{enumerate}')
  }
  
  // Conclusion
  const allClosed = checkAllBranchesClosed(tableauRoot)
  lines.push('')
  lines.push('\\section{Conclusion}')
  if (allClosed) {
    lines.push('All branches are closed, therefore the original formula is unsatisfiable.')
  } else {
    lines.push('Some branches remain open, therefore the formula is satisfiable.')
  }
  
  lines.push('')
  lines.push('\\end{document}')
  
  return lines.join('\n')
}

/**
 * Exports tableau as LaTeX file
 */
export function exportTableauLatex(
  tableauRoot: TableauNode,
  expression: string,
  options: LatexExportOptions = {}
): void {
  const latexContent = generateTableauLatex(tableauRoot, expression, options)
  const filename = `tableau-${expression.replace(/[^a-zA-Z0-9]/g, '_')}.tex`
  
  const blob = new Blob([latexContent], { type: 'text/plain' })
  downloadBlob(blob, filename)
}

/**
 * Exports tableau as image (PNG or SVG)
 */
export async function exportTableauImage(
  svgElement: SVGSVGElement,
  options: ImageExportOptions
): Promise<void> {
  const {
    format,
    backgroundColor = '#1a1a1a',
    padding = 50,
    filename
  } = options

  // Clone the SVG to avoid modifying the original
  const clonedSvg = svgElement.cloneNode(true) as SVGElement
  
  // Set background for better visibility in exports
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  rect.setAttribute('width', '100%')
  rect.setAttribute('height', '100%')
  rect.setAttribute('fill', backgroundColor)
  clonedSvg.insertBefore(rect, clonedSvg.firstChild)
  
  // Get the bounding box and set proper dimensions
  const bbox = svgElement.getBBox()
  clonedSvg.setAttribute('width', String(bbox.width + padding * 2))
  clonedSvg.setAttribute('height', String(bbox.height + padding * 2))
  clonedSvg.setAttribute('viewBox', `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`)
  
  const defaultFilename = filename || `tableau-export.${format}`
  
  if (format === 'svg') {
    // Direct SVG export
    const svgData = new XMLSerializer().serializeToString(clonedSvg)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    downloadBlob(blob, defaultFilename)
  } else {
    // PNG export via canvas
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }
      
      const img = new Image()
      const svgData = new XMLSerializer().serializeToString(clonedSvg)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      
      img.onload = () => {
        canvas.width = bbox.width + padding * 2
        canvas.height = bbox.height + padding * 2
        ctx.drawImage(img, 0, 0)
        
        canvas.toBlob((blob) => {
          if (blob) {
            downloadBlob(blob, defaultFilename)
            resolve()
          } else {
            reject(new Error('Failed to create PNG blob'))
          }
          URL.revokeObjectURL(url)
        }, 'image/png')
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load SVG image'))
      }
      
      img.src = url
    })
  }
}

/**
 * Collects proof steps from tableau
 */
export function collectProofSteps(root: TableauNode): ProofStep[] {
  if (!root) return []
  
  const steps: ProofStep[] = []
  let stepCounter = 1
  
  function collectSteps(node: TableauNode, depth: number = 0, branchPath: string = '') {
    if (!node.ast) return
    
    const formula = astToString(node.ast)
    let rule = 'Assumption'
    let action = 'Assume'
    let justification = 'Initial assumption for proof by contradiction'
    
    if (depth > 0) {
      rule = getRuleName(node)
      action = getActionDescription(node)
      justification = getJustification(node)
    }
    
    const branchStatus: 'open' | 'closed' | 'continuing' = 
      node.type === 'closed' ? 'closed' :
      (!node.children || node.children.length === 0) ? 'open' :
      'continuing'
    
    steps.push({
      step: stepCounter++,
      action,
      formula,
      rule,
      justification,
      branchStatus
    })
    
    if (node.children) {
      node.children.forEach(child => collectSteps(child, depth + 1, branchPath))
    }
  }
  
  collectSteps(root)
  return steps
}

/**
 * Exports proof steps in various formats
 */
export function exportProofSteps(
  steps: ProofStep[],
  format: 'json' | 'csv' | 'markdown' | 'html',
  filename?: string
): void {
  const defaultFilename = filename || `proof-steps.${format}`
  
  switch (format) {
    case 'json':
      const jsonContent = JSON.stringify(steps, null, 2)
      const jsonBlob = new Blob([jsonContent], { type: 'application/json' })
      downloadBlob(jsonBlob, defaultFilename)
      break
      
    case 'csv':
      const csvHeader = 'Step,Action,Formula,Rule,Justification,Branch Status\n'
      const csvRows = steps.map(step => 
        `${step.step},"${step.action}","${step.formula}","${step.rule}","${step.justification}","${step.branchStatus}"`
      ).join('\n')
      const csvContent = csvHeader + csvRows
      const csvBlob = new Blob([csvContent], { type: 'text/csv' })
      downloadBlob(csvBlob, defaultFilename)
      break
      
    case 'markdown':
      let mdContent = '# Proof Steps\n\n'
      mdContent += '| Step | Action | Formula | Rule | Justification | Branch Status |\n'
      mdContent += '|------|--------|---------|------|---------------|---------------|\n'
      steps.forEach(step => {
        mdContent += `| ${step.step} | ${step.action} | \`${step.formula}\` | ${step.rule} | ${step.justification} | ${step.branchStatus} |\n`
      })
      const mdBlob = new Blob([mdContent], { type: 'text/markdown' })
      downloadBlob(mdBlob, defaultFilename)
      break
      
    case 'html':
      let htmlContent = '<!DOCTYPE html>\n<html>\n<head>\n<title>Proof Steps</title>\n'
      htmlContent += '<style>table{border-collapse:collapse;width:100%;}th,td{border:1px solid #ddd;padding:8px;text-align:left;}th{background-color:#f2f2f2;}</style>\n'
      htmlContent += '</head>\n<body>\n<h1>Proof Steps</h1>\n<table>\n'
      htmlContent += '<tr><th>Step</th><th>Action</th><th>Formula</th><th>Rule</th><th>Justification</th><th>Branch Status</th></tr>\n'
      steps.forEach(step => {
        htmlContent += `<tr><td>${step.step}</td><td>${escapeHTML(step.action)}</td><td><code>${escapeHTML(step.formula)}</code></td><td>${escapeHTML(step.rule)}</td><td>${escapeHTML(step.justification)}</td><td>${step.branchStatus}</td></tr>\n`
      })
      htmlContent += '</table>\n</body>\n</html>'
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' })
      downloadBlob(htmlBlob, defaultFilename)
      break
      
    default:
      throw new Error(`Unsupported proof steps format: ${format}`)
  }
}

/**
 * Generates natural language proof from tableau
 */
export function generateProofText(root: TableauNode): string {
  const lines: string[] = []
  
  lines.push('# Semantic Tableau Proof\n')
  
  // Traverse the tableau and generate proof text
  function traverseForProof(node: TableauNode, depth: number = 0) {
    const indent = '  '.repeat(depth)
    const formula = node.label
    
    if (depth === 0) {
      lines.push(`${indent}1. Assume ${formula} (for contradiction)`)
    } else {
      const rule = getRuleName(node)
      lines.push(`${indent}${depth + 1}. ${formula} (by ${rule})`)
    }
    
    if (node.children) {
      node.children.forEach(child => traverseForProof(child, depth + 1))
    }
    
    if (node.type === 'closed') {
      lines.push(`${indent}   ⊥ Contradiction found - branch closes`)
    }
  }
  
  traverseForProof(root)
  
  // Add conclusion
  const allClosed = checkAllBranchesClosed(root)
  const openBranches = findOpenBranches(root)
  
  lines.push('\n## Conclusion\n')
  if (allClosed) {
    lines.push('All branches are closed, therefore the original formula is **unsatisfiable**.')
    lines.push('The proof by contradiction succeeds.')
  } else {
    lines.push(`${openBranches.length} branch(es) remain open, therefore the formula is **satisfiable**.`)
    lines.push('A countermodel can be constructed from the open branches.')
  }
  
  return lines.join('\n')
}

/**
 * Helper to convert logical formulas to LaTeX
 */
function latexifyFormula(formula: string): string {
  return formula
    .replace(/¬/g, '\\neg ')
    .replace(/∧/g, ' \\land ')
    .replace(/∨/g, ' \\lor ')
    .replace(/→/g, ' \\rightarrow ')
    .replace(/↔/g, ' \\leftrightarrow ')
    .replace(/∀/g, '\\forall ')
    .replace(/∃/g, '\\exists ')
    .replace(/⊻/g, ' \\oplus ')
    .replace(/⊥/g, '\\bot')
}

/**
 * Gets action description for a node
 */
function getActionDescription(node: TableauNode): string {
  const rule = getRuleName(node)
  
  if (rule.includes('α-rule')) return 'Decompose conjunction'
  if (rule.includes('β-rule')) return 'Branch on disjunction'
  if (rule.includes('Implication')) return 'Decompose implication'
  if (rule.includes('Biconditional')) return 'Decompose biconditional'
  if (rule.includes('Double Negation')) return 'Remove double negation'
  if (rule.includes('Quantifier')) return 'Instantiate quantifier'
  
  return 'Apply rule'
}

/**
 * Gets justification for a node
 */
function getJustification(node: TableauNode): string {
  const rule = getRuleName(node)
  
  if (rule.includes('α-rule')) return 'From conjunction, both conjuncts must be true'
  if (rule.includes('β-rule')) return 'From disjunction, at least one disjunct must be true'
  if (rule.includes('Implication')) return 'P → Q is equivalent to ¬P ∨ Q'
  if (rule.includes('Biconditional')) return 'P ↔ Q is equivalent to (P → Q) ∧ (Q → P)'
  if (rule.includes('Double Negation')) return '¬¬P is equivalent to P'
  if (rule.includes('Quantifier')) return 'Apply quantifier rule with appropriate witness'
  
  return 'Standard tableau rule application'
}

/**
 * Downloads a blob as a file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Escapes HTML characters
 */
function escapeHTML(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
