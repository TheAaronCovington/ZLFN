/**
 * ATN Export Service
 * Handles various export formats for Argument Tableau Network analyses
 */

import type { 
  ArgumentData, 
  SchemeCluster 
} from './types'
import type { 
  StrengthCalculationResult
} from './strengthPropagation'

export interface ATNExportOptions {
  includeMetadata?: boolean
  includeStrengthAnalysis?: boolean
  includeConflictAnalysis?: boolean
  includeSchemeAnalysis?: boolean
  format?: 'json' | 'csv' | 'latex' | 'markdown' | 'xml'
}

export interface ATNAnalysisReport {
  argument: ArgumentData
  strengthAnalysis?: StrengthCalculationResult
  schemeAnalysis?: {
    clusters: SchemeCluster[]
    dominantSchemes: string[]
    schemeEffectiveness: Record<string, number>
  }
  summary: {
    totalNodes: number
    totalEdges: number
    overallStrength: number
    coherenceScore: number
    conflictCount: number
    recommendedActions: string[]
  }
  exportMetadata: {
    timestamp: string
    version: string
    exportOptions: ATNExportOptions
  }
}

/**
 * Generate comprehensive ATN analysis report
 */
export function generateATNReport(
  argumentData: ArgumentData,
  strengthResult?: StrengthCalculationResult,
  schemeClusters?: SchemeCluster[],
  options: ATNExportOptions = {}
): ATNAnalysisReport {
  const allNodes = [argumentData.core, ...argumentData.components]
  const allEdges = argumentData.relationships

  // Calculate scheme effectiveness
  let schemeAnalysis: ATNAnalysisReport['schemeAnalysis'] | undefined
  if (options.includeSchemeAnalysis && schemeClusters) {
    const schemeEffectiveness: Record<string, number> = {}
    const dominantSchemes: string[] = []

    schemeClusters.forEach(cluster => {
      schemeEffectiveness[cluster.scheme] = cluster.priority
      if (cluster.priority > 70) {
        dominantSchemes.push(cluster.scheme)
      }
    })

    schemeAnalysis = {
      clusters: schemeClusters,
      dominantSchemes,
      schemeEffectiveness
    }
  }

  // Calculate overall metrics
  const avgNodeStrength = strengthResult 
    ? Array.from(strengthResult.nodeStrengths.values()).reduce((sum, s) => sum + s, 0) / strengthResult.nodeStrengths.size
    : allNodes.reduce((sum, n) => sum + (n.strength || 50), 0) / allNodes.length

  const coherenceScore = strengthResult?.overallCoherence || 50
  const conflictCount = strengthResult?.conflicts.length || 0

  // Generate recommendations
  const recommendedActions = generateRecommendations(
    argumentData,
    strengthResult,
    schemeAnalysis
  )

  return {
    argument: argumentData,
    strengthAnalysis: options.includeStrengthAnalysis ? strengthResult : undefined,
    schemeAnalysis,
    summary: {
      totalNodes: allNodes.length,
      totalEdges: allEdges.length,
      overallStrength: Math.round(avgNodeStrength),
      coherenceScore,
      conflictCount,
      recommendedActions
    },
    exportMetadata: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      exportOptions: options
    }
  }
}

/**
 * Generate actionable recommendations based on analysis
 */
function generateRecommendations(
  argumentData: ArgumentData,
  strengthResult?: StrengthCalculationResult,
  schemeAnalysis?: ATNAnalysisReport['schemeAnalysis']
): string[] {
  const recommendations: string[] = []

  // Strength-based recommendations
  if (strengthResult) {
    const weakNodes = Array.from(strengthResult.nodeStrengths.entries())
      .filter(([_, strength]) => strength < 40)
      .map(([id, _]) => id)

    if (weakNodes.length > 0) {
      recommendations.push(`Strengthen weak arguments: ${weakNodes.join(', ')}`)
    }

    // Conflict recommendations
    strengthResult.conflicts.forEach(conflict => {
      switch (conflict.type) {
        case 'circular_reasoning':
          recommendations.push(`Resolve circular reasoning in: ${conflict.involvedNodes.join(' → ')}`)
          break
        case 'direct_attack':
          recommendations.push(`Address conflicting strong arguments: ${conflict.involvedNodes.join(' vs ')}`)
          break
        case 'inconsistent_strength':
          recommendations.push(`Rebalance argument strengths: ${conflict.description}`)
          break
      }
    })

    if (strengthResult.overallCoherence < 60) {
      recommendations.push('Improve overall argument coherence by addressing conflicts and strengthening weak links')
    }
  }

  // Scheme-based recommendations
  if (schemeAnalysis) {
    const weakSchemes = Object.entries(schemeAnalysis.schemeEffectiveness)
      .filter(([_, effectiveness]) => effectiveness < 50)
      .map(([scheme, _]) => scheme)

    if (weakSchemes.length > 0) {
      recommendations.push(`Consider alternative schemes for: ${weakSchemes.join(', ')}`)
    }

    if (schemeAnalysis.dominantSchemes.length === 0) {
      recommendations.push('Develop stronger argumentation schemes to improve persuasiveness')
    }
  }

  // Structure-based recommendations
  const supportRatio = argumentData.relationships.filter(e => e.relationshipType === 'support').length / 
                      Math.max(argumentData.relationships.length, 1)
  
  if (supportRatio < 0.3) {
    recommendations.push('Add more supporting evidence to strengthen the argument structure')
  }

  if (argumentData.components.filter(n => n.argumentType === 'rebuttal').length === 0) {
    recommendations.push('Consider potential rebuttals to strengthen the argument against counterarguments')
  }

  return recommendations.slice(0, 5) // Limit to top 5 recommendations
}

/**
 * Export ATN report to JSON
 */
export function exportToJSON(report: ATNAnalysisReport): string {
  return JSON.stringify(report, null, 2)
}

/**
 * Export ATN report to CSV
 */
export function exportToCSV(report: ATNAnalysisReport): string {
  const lines: string[] = []
  
  // Header
  lines.push('Type,ID,Name,Argument Type,Strength,Relationships,Schemes')
  
  // Core argument
  const core = report.argument.core
  lines.push(`Core,${core.id},${core.name || core.label},${core.argumentType},${core.strength || 50},,`)
  
  // Components
  report.argument.components.forEach(node => {
    const relationships = report.argument.relationships
      .filter(e => e.from === node.id || e.to === node.id)
      .map(e => `${e.relationshipType}:${e.scheme}`)
      .join(';')
    
    const schemes = [...new Set(report.argument.relationships
      .filter(e => e.from === node.id || e.to === node.id)
      .map(e => e.scheme))]
      .join(';')
    
    lines.push(`Component,${node.id},${node.name || node.label},${node.argumentType},${node.strength || 50},"${relationships}","${schemes}"`)
  })
  
  // Summary
  lines.push('')
  lines.push('Summary')
  lines.push(`Total Nodes,${report.summary.totalNodes}`)
  lines.push(`Total Edges,${report.summary.totalEdges}`)
  lines.push(`Overall Strength,${report.summary.overallStrength}`)
  lines.push(`Coherence Score,${report.summary.coherenceScore}`)
  lines.push(`Conflict Count,${report.summary.conflictCount}`)
  
  return lines.join('\n')
}

/**
 * Export ATN report to LaTeX
 */
export function exportToLaTeX(report: ATNAnalysisReport): string {
  const latex: string[] = []
  
  latex.push('\\documentclass{article}')
  latex.push('\\usepackage[utf8]{inputenc}')
  latex.push('\\usepackage{amsmath}')
  latex.push('\\usepackage{amsfonts}')
  latex.push('\\usepackage{amssymb}')
  latex.push('\\usepackage{graphicx}')
  latex.push('\\usepackage{booktabs}')
  latex.push('\\usepackage{xcolor}')
  latex.push('')
  latex.push('\\title{Argument Tableau Network Analysis}')
  latex.push(`\\author{Generated on ${new Date().toLocaleDateString()}}`)
  latex.push('\\date{\\today}')
  latex.push('')
  latex.push('\\begin{document}')
  latex.push('\\maketitle')
  latex.push('')
  
  // Abstract
  latex.push('\\begin{abstract}')
  latex.push(`This report presents an analysis of the argument "${report.argument.name}" using the Argument Tableau Network (ATN) methodology. `)
  latex.push(`The analysis includes ${report.summary.totalNodes} argument components connected by ${report.summary.totalEdges} relationships, `)
  latex.push(`with an overall coherence score of ${report.summary.coherenceScore}\\%.`)
  latex.push('\\end{abstract}')
  latex.push('')
  
  // Argument Structure
  latex.push('\\section{Argument Structure}')
  latex.push('')
  latex.push('\\subsection{Core Claim}')
  latex.push(`\\textbf{${escapeLatex(report.argument.core.name || report.argument.core.label || 'Untitled')}}`)
  latex.push(`\\\\Strength: ${report.argument.core.strength || 50}\\%`)
  latex.push('')
  
  latex.push('\\subsection{Supporting Components}')
  latex.push('\\begin{itemize}')
  report.argument.components.forEach(node => {
    latex.push(`\\item \\textbf{${escapeLatex(node.name || node.label || 'Untitled')}} (${node.argumentType})`)
    latex.push(`\\\\Strength: ${node.strength || 50}\\%`)
  })
  latex.push('\\end{itemize}')
  latex.push('')
  
  // Relationships
  latex.push('\\section{Relationships}')
  latex.push('\\begin{table}[h]')
  latex.push('\\centering')
  latex.push('\\begin{tabular}{@{}llll@{}}')
  latex.push('\\toprule')
  latex.push('From & To & Type & Scheme \\\\')
  latex.push('\\midrule')
  
  report.argument.relationships.forEach(edge => {
    const fromNode = [report.argument.core, ...report.argument.components]
      .find(n => n.id === edge.from)
    const toNode = [report.argument.core, ...report.argument.components]
      .find(n => n.id === edge.to)
    
    latex.push(`${escapeLatex(fromNode?.name || fromNode?.label || edge.from || '')} & `)
    latex.push(`${escapeLatex(toNode?.name || toNode?.label || edge.to || '')} & `)
    latex.push(`${edge.relationshipType} & `)
    latex.push(`${escapeLatex(edge.scheme || '')} \\\\`)
  })
  
  latex.push('\\bottomrule')
  latex.push('\\end{tabular}')
  latex.push('\\caption{Argument Relationships}')
  latex.push('\\end{table}')
  latex.push('')
  
  // Analysis Summary
  latex.push('\\section{Analysis Summary}')
  latex.push('\\begin{itemize}')
  latex.push(`\\item Total Nodes: ${report.summary.totalNodes}`)
  latex.push(`\\item Total Edges: ${report.summary.totalEdges}`)
  latex.push(`\\item Overall Strength: ${report.summary.overallStrength}\\%`)
  latex.push(`\\item Coherence Score: ${report.summary.coherenceScore}\\%`)
  latex.push(`\\item Conflicts Detected: ${report.summary.conflictCount}`)
  latex.push('\\end{itemize}')
  latex.push('')
  
  // Recommendations
  if (report.summary.recommendedActions.length > 0) {
    latex.push('\\section{Recommendations}')
    latex.push('\\begin{enumerate}')
    report.summary.recommendedActions.forEach(action => {
      latex.push(`\\item ${escapeLatex(action)}`)
    })
    latex.push('\\end{enumerate}')
    latex.push('')
  }
  
  latex.push('\\end{document}')
  
  return latex.join('\n')
}

/**
 * Export ATN report to Markdown
 */
export function exportToMarkdown(report: ATNAnalysisReport): string {
  const md: string[] = []
  
  md.push(`# Argument Tableau Network Analysis`)
  md.push(`**Argument:** ${report.argument.name}`)
  md.push(`**Generated:** ${new Date().toLocaleDateString()}`)
  md.push('')
  
  // Summary
  md.push('## Summary')
  md.push(`- **Total Nodes:** ${report.summary.totalNodes}`)
  md.push(`- **Total Edges:** ${report.summary.totalEdges}`)
  md.push(`- **Overall Strength:** ${report.summary.overallStrength}%`)
  md.push(`- **Coherence Score:** ${report.summary.coherenceScore}%`)
  md.push(`- **Conflicts Detected:** ${report.summary.conflictCount}`)
  md.push('')
  
  // Core Claim
  md.push('## Core Claim')
  md.push(`**${report.argument.core.name || report.argument.core.label}**`)
  md.push(`- Type: ${report.argument.core.argumentType}`)
  md.push(`- Strength: ${report.argument.core.strength || 50}%`)
  md.push('')
  
  // Components
  md.push('## Argument Components')
  report.argument.components.forEach(node => {
    md.push(`### ${node.name || node.label}`)
    md.push(`- **Type:** ${node.argumentType}`)
    md.push(`- **Strength:** ${node.strength || 50}%`)
    if (node.label !== node.name) {
      md.push(`- **Description:** ${node.label}`)
    }
    md.push('')
  })
  
  // Relationships
  md.push('## Relationships')
  md.push('| From | To | Type | Scheme | Confidence |')
  md.push('|------|----|----- |--------|------------|')
  
  report.argument.relationships.forEach(edge => {
    const fromNode = [report.argument.core, ...report.argument.components]
      .find(n => n.id === edge.from)
    const toNode = [report.argument.core, ...report.argument.components]
      .find(n => n.id === edge.to)
    
    md.push(`| ${fromNode?.name || fromNode?.label || edge.from || ''} | ${toNode?.name || toNode?.label || edge.to || ''} | ${edge.relationshipType} | ${edge.scheme || ''} | ${edge.confidence || 70}% |`)
  })
  md.push('')
  
  // Conflicts
  if (report.strengthAnalysis?.conflicts && report.strengthAnalysis.conflicts.length > 0) {
    md.push('## Detected Conflicts')
    report.strengthAnalysis.conflicts.forEach((conflict, index) => {
      md.push(`### ${index + 1}. ${conflict.type.replace('_', ' ').toUpperCase()}`)
      md.push(`- **Severity:** ${conflict.severity}%`)
      md.push(`- **Involved Nodes:** ${conflict.involvedNodes.join(', ')}`)
      md.push(`- **Description:** ${conflict.description}`)
      md.push('')
    })
  }
  
  // Recommendations
  if (report.summary.recommendedActions.length > 0) {
    md.push('## Recommendations')
    report.summary.recommendedActions.forEach((action, index) => {
      md.push(`${index + 1}. ${action}`)
    })
    md.push('')
  }
  
  return md.join('\n')
}

/**
 * Download file with given content
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}

/**
 * Escape special LaTeX characters
 */
function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/[{}]/g, '\\$&')
    .replace(/[#$%&_]/g, '\\$&')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}')
}

/**
 * Export ATN analysis with all formats
 */
export function exportATNAnalysis(
  argumentData: ArgumentData,
  strengthResult?: StrengthCalculationResult,
  schemeClusters?: SchemeCluster[],
  format: 'json' | 'csv' | 'latex' | 'markdown' = 'json',
  options: ATNExportOptions = {}
): void {
  const report = generateATNReport(argumentData, strengthResult, schemeClusters, options)
  const timestamp = new Date().toISOString().split('T')[0]
  const baseFilename = `atn-analysis-${argumentData.name.replace(/[^a-zA-Z0-9]/g, '-')}-${timestamp}`
  
  let content: string
  let filename: string
  let mimeType: string
  
  switch (format) {
    case 'json':
      content = exportToJSON(report)
      filename = `${baseFilename}.json`
      mimeType = 'application/json'
      break
    case 'csv':
      content = exportToCSV(report)
      filename = `${baseFilename}.csv`
      mimeType = 'text/csv'
      break
    case 'latex':
      content = exportToLaTeX(report)
      filename = `${baseFilename}.tex`
      mimeType = 'text/plain'
      break
    case 'markdown':
      content = exportToMarkdown(report)
      filename = `${baseFilename}.md`
      mimeType = 'text/markdown'
      break
    default:
      throw new Error(`Unsupported export format: ${format}`)
  }
  
  downloadFile(content, filename, mimeType)
}
