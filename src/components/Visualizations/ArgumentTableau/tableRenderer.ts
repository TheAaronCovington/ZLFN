/**
 * ATN Table Renderer - Tabular Layout for Argument Analysis
 * Provides a structured table view of arguments and relationships
 */

import * as d3 from 'd3'
import type { 
  ArgumentNode, 
  ArgumentEdge, 
  ArgumentData, 
  ArgumentRenderConfig 
} from './types'
import { ARGUMENT_COLORS } from './types'

export interface TableRenderState {
  container: HTMLElement
  width: number
  height: number
}

export interface ArgumentRow {
  node: ArgumentNode
  supportingNodes: ArgumentNode[]
  attackingNodes: ArgumentNode[]
  undercuttingNodes: ArgumentNode[]
  schemes: string[]
  overallStrength: number
}

/**
 * Initialize table container
 */
export function initializeTableContainer(
  container: HTMLElement,
  config: ArgumentRenderConfig
): TableRenderState {
  // Clear existing content
  d3.select(container).selectAll('*').remove()

  return {
    container,
    width: config.width,
    height: config.height
  }
}

/**
 * Render table layout
 */
export function renderTableLayout(
  state: TableRenderState,
  argumentData: ArgumentData,
  _config: ArgumentRenderConfig,
  onNodeClick?: (node: ArgumentNode) => void,
  _onEdgeClick?: (edge: ArgumentEdge) => void
): void {
  const { container, width } = state

  // Prepare argument rows
  const argumentRows = prepareArgumentRows(argumentData)

  // Create table structure
  const tableContainer = d3.select(container)
    .append('div')
    .style('width', `${width}px`)
    .style('height', '100%')
    .style('overflow', 'auto')
    .style('background', 'var(--ai-bg-primary)')
    .style('color', 'var(--ai-text-primary)')
    .style('font-family', 'system-ui, -apple-system, sans-serif')

  // Add table header
  const headerRow = tableContainer
    .append('div')
    .style('display', 'grid')
    .style('grid-template-columns', '2fr 1fr 1fr 1fr 1fr 1fr')
    .style('gap', '1px')
    .style('background', 'rgba(64,196,255,0.3)')
    .style('padding', '12px')
    .style('font-weight', '600')
    .style('border-bottom', '2px solid rgba(64,196,255,0.5)')
    .style('position', 'sticky')
    .style('top', '0')
    .style('z-index', '10')

  const headers = ['Argument', 'Type', 'Strength', 'Support', 'Attacks', 'Schemes']
  headers.forEach(header => {
    headerRow.append('div')
      .text(header)
      .style('padding', '8px')
      .style('text-align', 'center')
      .style('background', 'var(--ai-bg-secondary)')
      .style('border-radius', '4px')
  })

  // Add argument rows
  const rowsContainer = tableContainer.append('div')

  argumentRows.forEach((row, index) => {
    renderArgumentRow(rowsContainer, row, index, onNodeClick, _onEdgeClick)
  })

  // Add summary section
  renderSummarySection(tableContainer, argumentData, argumentRows)
}

/**
 * Prepare argument data for table display
 */
function prepareArgumentRows(argumentData: ArgumentData): ArgumentRow[] {
  const allNodes = [argumentData.core, ...argumentData.components]
  const relationships = argumentData.relationships

  return allNodes.map(node => {
    // Find supporting nodes
    const supportingEdges = relationships.filter(edge => 
      edge.to === node.id && edge.relationshipType === 'support'
    )
    const supportingNodes = supportingEdges
      .map(edge => allNodes.find(n => n.id === edge.from))
      .filter(Boolean) as ArgumentNode[]

    // Find attacking nodes
    const attackingEdges = relationships.filter(edge => 
      edge.to === node.id && edge.relationshipType === 'attack'
    )
    const attackingNodes = attackingEdges
      .map(edge => allNodes.find(n => n.id === edge.from))
      .filter(Boolean) as ArgumentNode[]

    // Find undercutting nodes
    const undercuttingEdges = relationships.filter(edge => 
      edge.to === node.id && edge.relationshipType === 'undercut'
    )
    const undercuttingNodes = undercuttingEdges
      .map(edge => allNodes.find(n => n.id === edge.from))
      .filter(Boolean) as ArgumentNode[]

    // Collect schemes
    const relatedEdges = relationships.filter(edge => 
      edge.from === node.id || edge.to === node.id
    )
    const schemes = [...new Set(relatedEdges.map(edge => edge.scheme))]

    // Calculate overall strength (base strength adjusted by attacks)
    let overallStrength = node.strength || 50
    const attackStrength = attackingNodes.reduce((sum, attacker) => 
      sum + (attacker.strength || 50), 0
    )
    const supportStrength = supportingNodes.reduce((sum, supporter) => 
      sum + (supporter.strength || 50), 0
    )
    
    // Simple strength calculation
    if (attackingNodes.length > 0) {
      overallStrength = Math.max(0, overallStrength - (attackStrength / attackingNodes.length) * 0.3)
    }
    if (supportingNodes.length > 0) {
      overallStrength = Math.min(100, overallStrength + (supportStrength / supportingNodes.length) * 0.2)
    }

    return {
      node,
      supportingNodes,
      attackingNodes,
      undercuttingNodes,
      schemes,
      overallStrength: Math.round(overallStrength)
    }
  })
}

/**
 * Render individual argument row
 */
function renderArgumentRow(
  container: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  row: ArgumentRow,
  index: number,
  onNodeClick?: (node: ArgumentNode) => void,
  _onEdgeClick?: (edge: ArgumentEdge) => void
): void {
  const rowElement = container
    .append('div')
    .style('display', 'grid')
    .style('grid-template-columns', '2fr 1fr 1fr 1fr 1fr 1fr')
    .style('gap', '1px')
    .style('padding', '12px')
    .style('border-bottom', '1px solid rgba(64,196,255,0.2)')
    .style('background', index % 2 === 0 ? 'var(--ai-bg-primary)' : 'rgba(64,196,255,0.05)')
    .style('transition', 'background-color 0.2s')
    .on('mouseenter', function() {
      d3.select(this).style('background', 'rgba(64,196,255,0.1)')
    })
    .on('mouseleave', function() {
      d3.select(this).style('background', 
        index % 2 === 0 ? 'var(--ai-bg-primary)' : 'rgba(64,196,255,0.05)'
      )
    })

  // Argument column
  const argumentCell = rowElement.append('div')
    .style('padding', '8px')

  argumentCell.append('div')
    .style('font-weight', '600')
    .style('margin-bottom', '4px')
    .style('cursor', 'pointer')
    .style('color', ARGUMENT_COLORS[row.node.argumentType])
    .text(row.node.name || row.node.label || 'Untitled')
    .on('click', () => onNodeClick?.(row.node))

  argumentCell.append('div')
    .style('font-size', '12px')
    .style('color', 'var(--ai-text-secondary)')
    .style('line-height', '1.4')
    .text(row.node.label || 'No description')

  // Type column
  rowElement.append('div')
    .style('padding', '8px')
    .style('text-align', 'center')
    .append('span')
    .style('background', ARGUMENT_COLORS[row.node.argumentType])
    .style('color', 'white')
    .style('padding', '4px 8px')
    .style('border-radius', '12px')
    .style('font-size', '11px')
    .style('font-weight', '600')
    .style('text-transform', 'uppercase')
    .text(row.node.argumentType)

  // Strength column
  const strengthCell = rowElement.append('div')
    .style('padding', '8px')
    .style('text-align', 'center')

  strengthCell.append('div')
    .style('font-weight', '600')
    .style('color', getStrengthColor(row.overallStrength))
    .text(`${row.overallStrength}%`)

  strengthCell.append('div')
    .style('font-size', '10px')
    .style('color', 'var(--ai-text-tertiary)')
    .text(`(base: ${row.node.strength || 50}%)`)

  // Support column
  const supportCell = rowElement.append('div')
    .style('padding', '8px')
    .style('text-align', 'center')

  if (row.supportingNodes.length > 0) {
    supportCell.append('div')
      .style('font-weight', '600')
      .style('color', '#4CAF50')
      .text(`+${row.supportingNodes.length}`)

    const supportList = supportCell.append('div')
      .style('font-size', '10px')
      .style('color', 'var(--ai-text-secondary)')

    row.supportingNodes.forEach(node => {
      supportList.append('div')
        .style('cursor', 'pointer')
        .style('margin', '2px 0')
        .text(node.name || (node.label ? node.label.substring(0, 20) + '...' : 'Untitled'))
        .on('click', () => onNodeClick?.(node))
    })
  } else {
    supportCell.append('div')
      .style('color', 'var(--ai-text-tertiary)')
      .text('—')
  }

  // Attacks column
  const attackCell = rowElement.append('div')
    .style('padding', '8px')
    .style('text-align', 'center')

  const totalAttacks = row.attackingNodes.length + row.undercuttingNodes.length
  if (totalAttacks > 0) {
    attackCell.append('div')
      .style('font-weight', '600')
      .style('color', '#F44336')
      .text(`-${totalAttacks}`)

    const attackList = attackCell.append('div')
      .style('font-size', '10px')
      .style('color', 'var(--ai-text-secondary)')

    row.attackingNodes.forEach(node => {
      attackList.append('div')
        .style('cursor', 'pointer')
        .style('margin', '2px 0')
        .style('color', '#F44336')
        .text(`⚔ ${node.name || (node.label ? node.label.substring(0, 15) + '...' : 'Untitled')}`)
        .on('click', () => onNodeClick?.(node))
    })

    row.undercuttingNodes.forEach(node => {
      attackList.append('div')
        .style('cursor', 'pointer')
        .style('margin', '2px 0')
        .style('color', '#FF9800')
        .text(`⚡ ${node.name || (node.label ? node.label.substring(0, 15) + '...' : 'Untitled')}`)
        .on('click', () => onNodeClick?.(node))
    })
  } else {
    attackCell.append('div')
      .style('color', 'var(--ai-text-tertiary)')
      .text('—')
  }

  // Schemes column
  const schemeCell = rowElement.append('div')
    .style('padding', '8px')
    .style('text-align', 'center')

  if (row.schemes.length > 0) {
    row.schemes.forEach(scheme => {
      schemeCell.append('div')
        .style('background', 'rgba(64,196,255,0.2)')
        .style('color', '#40c4ff')
        .style('padding', '2px 6px')
        .style('margin', '2px')
        .style('border-radius', '8px')
        .style('font-size', '10px')
        .style('display', 'inline-block')
        .text(scheme)
    })
  } else {
    schemeCell.append('div')
      .style('color', 'var(--ai-text-tertiary)')
      .text('—')
  }
}

/**
 * Render summary section
 */
function renderSummarySection(
  container: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  argumentData: ArgumentData,
  rows: ArgumentRow[]
): void {
  const summarySection = container
    .append('div')
    .style('margin-top', '20px')
    .style('padding', '16px')
    .style('background', 'var(--ai-bg-secondary)')
    .style('border-radius', '8px')
    .style('border', '1px solid rgba(64,196,255,0.3)')

  summarySection.append('h3')
    .style('margin', '0 0 12px 0')
    .style('color', '#40c4ff')
    .style('font-size', '16px')
    .text('Argument Analysis Summary')

  const stats = summarySection.append('div')
    .style('display', 'grid')
    .style('grid-template-columns', 'repeat(auto-fit, minmax(200px, 1fr))')
    .style('gap', '16px')

  // Total arguments by type
  const typeCounts = rows.reduce((acc, row) => {
    acc[row.node.argumentType] = (acc[row.node.argumentType] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const typeStats = stats.append('div')
  typeStats.append('h4')
    .style('margin', '0 0 8px 0')
    .style('color', 'var(--ai-text-primary)')
    .style('font-size', '14px')
    .text('Argument Types')

  Object.entries(typeCounts).forEach(([type, count]) => {
    typeStats.append('div')
      .style('display', 'flex')
      .style('justify-content', 'space-between')
      .style('margin', '4px 0')
      .style('font-size', '12px')
      .html(`
        <span style="color: ${ARGUMENT_COLORS[type as keyof typeof ARGUMENT_COLORS]}">${type}</span>
        <span>${count}</span>
      `)
  })

  // Relationship statistics
  const relationshipCounts = argumentData.relationships.reduce((acc, rel) => {
    acc[rel.relationshipType] = (acc[rel.relationshipType] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const relStats = stats.append('div')
  relStats.append('h4')
    .style('margin', '0 0 8px 0')
    .style('color', 'var(--ai-text-primary)')
    .style('font-size', '14px')
    .text('Relationships')

  Object.entries(relationshipCounts).forEach(([type, count]) => {
    const color = type === 'support' ? '#4CAF50' : type === 'attack' ? '#F44336' : '#FF9800'
    relStats.append('div')
      .style('display', 'flex')
      .style('justify-content', 'space-between')
      .style('margin', '4px 0')
      .style('font-size', '12px')
      .html(`
        <span style="color: ${color}">${type}</span>
        <span>${count}</span>
      `)
  })

  // Strength distribution
  const strengthStats = stats.append('div')
  strengthStats.append('h4')
    .style('margin', '0 0 8px 0')
    .style('color', 'var(--ai-text-primary)')
    .style('font-size', '14px')
    .text('Strength Distribution')

  const avgStrength = rows.reduce((sum, row) => sum + row.overallStrength, 0) / rows.length
  const strongArgs = rows.filter(row => row.overallStrength >= 70).length
  const weakArgs = rows.filter(row => row.overallStrength < 50).length

  strengthStats.append('div')
    .style('font-size', '12px')
    .style('margin', '4px 0')
    .html(`Average: <span style="color: ${getStrengthColor(avgStrength)}">${avgStrength.toFixed(1)}%</span>`)

  strengthStats.append('div')
    .style('font-size', '12px')
    .style('margin', '4px 0')
    .html(`Strong (≥70%): <span style="color: #4CAF50">${strongArgs}</span>`)

  strengthStats.append('div')
    .style('font-size', '12px')
    .style('margin', '4px 0')
    .html(`Weak (<50%): <span style="color: #F44336">${weakArgs}</span>`)
}

/**
 * Get color based on strength value
 */
function getStrengthColor(strength: number): string {
  if (strength >= 70) return '#4CAF50' // Green
  if (strength >= 50) return '#FF9800' // Orange
  return '#F44336' // Red
}
