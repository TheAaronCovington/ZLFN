/**
 * Tableau Logic for SemanticTableau
 * Handles AST to tableau conversion, rule validation, and logical operations
 */

import { astToString, type AstNodeRec } from '../../../services/logic'
import type { LogicMode } from '../../../services/inference'

export interface TableauNode {
  id: string
  label: string
  type: 'root' | 'open' | 'closed' | 'intermediate'
  children?: TableauNode[]
  ast?: AstNodeRec
  decomposed?: boolean
  x?: number
  y?: number
  depth?: number
}

export interface ProofStatus {
  isComplete: boolean
  openBranches: number
  closedBranches: number
  totalNodes: number
  contradictions: string[]
}

/**
 * Converts AST to initial tableau structure
 */
export function astToTableau(ast: AstNodeRec): TableauNode {
  const map = (node: AstNodeRec, depth: number): TableauNode => {
    const label = node.label || node.id || '?'
    const isLeaf = !node.children || node.children.length === 0
    const t: TableauNode = {
      id: node.id || `${label}-${depth}-${Math.random().toString(36).slice(2, 7)}`,
      label,
      type: depth === 0 ? 'root' : (isLeaf ? 'open' : 'intermediate'),
      ast: node,
      depth
    }
    // Stepped expansion: do not attach children initially; they are created via Decompose (D)
    return t
  }
  return map(ast, 0)
}

/**
 * Checks if a formula is an alpha rule (conjunction-like)
 */
export function isAlpha(ast: AstNodeRec): boolean {
  const label = ast.label
  return label === '∧' || (label === '¬' && ast.children?.[0]?.label === '∨')
}

/**
 * Checks if a formula is a beta rule (disjunction-like)
 */
export function isBeta(ast: AstNodeRec): boolean {
  const label = ast.label
  return label === '∨' || (label === '¬' && ast.children?.[0]?.label === '∧')
}

/**
 * Checks if a formula is an implication
 */
export function isImplication(ast: AstNodeRec): boolean {
  return ast.label === '→'
}

/**
 * Checks if a formula is a biconditional
 */
export function isBiconditional(ast: AstNodeRec): boolean {
  return ast.label === '↔'
}

/**
 * Checks if a formula is a double negation
 */
export function isDoubleNeg(ast: AstNodeRec): boolean {
  return ast.label === '¬' && ast.children?.[0]?.label === '¬'
}

/**
 * Checks if a formula involves quantifiers
 */
export function isQuantifier(ast: AstNodeRec): boolean {
  return ast.label === '∀' || ast.label === '∃'
}

/**
 * Decomposes a tableau node according to tableau rules
 */
export function decomposeNode(node: TableauNode, _logicMode: LogicMode): TableauNode[] {
  if (!node.ast || node.decomposed) return []

  const ast = node.ast
  const children: TableauNode[] = []

  // Alpha rules (linear expansion)
  if (isAlpha(ast)) {
    if (ast.label === '∧' && ast.children) {
      // A ∧ B → A, B (both on same branch)
      ast.children.forEach((child, index) => {
        children.push({
          id: `${node.id}-alpha-${index}`,
          label: astToString(child),
          type: 'intermediate',
          ast: child,
          depth: (node.depth || 0) + 1
        })
      })
    } else if (ast.label === '¬' && ast.children?.[0]?.label === '∨') {
      // ¬(A ∨ B) → ¬A, ¬B (both on same branch)
      const disjunction = ast.children[0]
      disjunction.children?.forEach((child, index) => {
        const negatedChild: AstNodeRec = {
          id: `neg-${child.id}`,
          label: '¬',
          children: [child]
        }
        children.push({
          id: `${node.id}-alpha-${index}`,
          label: astToString(negatedChild),
          type: 'intermediate',
          ast: negatedChild,
          depth: (node.depth || 0) + 1
        })
      })
    }
  }

  // Beta rules (branching expansion)
  else if (isBeta(ast)) {
    if (ast.label === '∨' && ast.children) {
      // A ∨ B → A | B (separate branches)
      ast.children.forEach((child, index) => {
        children.push({
          id: `${node.id}-beta-${index}`,
          label: astToString(child),
          type: 'intermediate',
          ast: child,
          depth: (node.depth || 0) + 1
        })
      })
    } else if (ast.label === '¬' && ast.children?.[0]?.label === '∧') {
      // ¬(A ∧ B) → ¬A | ¬B (separate branches)
      const conjunction = ast.children[0]
      conjunction.children?.forEach((child, index) => {
        const negatedChild: AstNodeRec = {
          id: `neg-${child.id}`,
          label: '¬',
          children: [child]
        }
        children.push({
          id: `${node.id}-beta-${index}`,
          label: astToString(negatedChild),
          type: 'intermediate',
          ast: negatedChild,
          depth: (node.depth || 0) + 1
        })
      })
    }
  }

  // Implication rules
  else if (isImplication(ast) && ast.children?.length === 2) {
    // A → B ≡ ¬A ∨ B (beta rule)
    const [antecedent, consequent] = ast.children
    const negatedAntecedent: AstNodeRec = {
      id: `neg-${antecedent.id}`,
      label: '¬',
      children: [antecedent]
    }
    
    children.push(
      {
        id: `${node.id}-impl-0`,
        label: astToString(negatedAntecedent),
        type: 'intermediate',
        ast: negatedAntecedent,
        depth: (node.depth || 0) + 1
      },
      {
        id: `${node.id}-impl-1`,
        label: astToString(consequent),
        type: 'intermediate',
        ast: consequent,
        depth: (node.depth || 0) + 1
      }
    )
  }

  // Biconditional rules
  else if (isBiconditional(ast) && ast.children?.length === 2) {
    // A ↔ B ≡ (A → B) ∧ (B → A) (alpha rule)
    const [left, right] = ast.children
    const leftToRight: AstNodeRec = {
      id: `${left.id}-to-${right.id}`,
      label: '→',
      children: [left, right]
    }
    const rightToLeft: AstNodeRec = {
      id: `${right.id}-to-${left.id}`,
      label: '→',
      children: [right, left]
    }
    
    children.push(
      {
        id: `${node.id}-bicond-0`,
        label: astToString(leftToRight),
        type: 'intermediate',
        ast: leftToRight,
        depth: (node.depth || 0) + 1
      },
      {
        id: `${node.id}-bicond-1`,
        label: astToString(rightToLeft),
        type: 'intermediate',
        ast: rightToLeft,
        depth: (node.depth || 0) + 1
      }
    )
  }

  // Double negation elimination
  else if (isDoubleNeg(ast)) {
    // ¬¬A → A
    const innerFormula = ast.children?.[0]?.children?.[0]
    if (innerFormula) {
      children.push({
        id: `${node.id}-doubleneg`,
        label: astToString(innerFormula),
        type: 'intermediate',
        ast: innerFormula,
        depth: (node.depth || 0) + 1
      })
    }
  }

  // Quantifier rules (simplified)
  else if (isQuantifier(ast) && ast.children && ast.children.length > 0) {
    // For now, just expand to the body
    const body = ast.children[ast.children.length - 1]
    children.push({
      id: `${node.id}-quant`,
      label: astToString(body),
      type: 'intermediate',
      ast: body,
      depth: (node.depth || 0) + 1
    })
  }

  return children
}

/**
 * Detects if a branch should be closed due to contradiction
 */
export function detectClosure(branchNodes: TableauNode[]): boolean {
  const formulas = new Set<string>()
  const negatedFormulas = new Set<string>()

  branchNodes.forEach(node => {
    if (!node.ast) return

    const formula = astToString(node.ast)
    
    if (node.ast.label === '¬' && node.ast.children?.[0]) {
      // This is a negated formula
      const innerFormula = astToString(node.ast.children[0])
      negatedFormulas.add(innerFormula)
      
      // Check if we have both P and ¬P
      if (formulas.has(innerFormula)) {
        return true
      }
    } else {
      // This is a positive formula
      formulas.add(formula)
      
      // Check if we have both P and ¬P
      if (negatedFormulas.has(formula)) {
        return true
      }
    }
  })

  return false
}

/**
 * Checks if all branches in a tableau are closed
 */
export function checkAllBranchesClosed(root: TableauNode): boolean {
  const openBranches = findOpenBranches(root)
  return openBranches.length === 0
}

/**
 * Finds all open branches in a tableau
 */
export function findOpenBranches(root: TableauNode): TableauNode[][] {
  const branches: TableauNode[][] = []
  
  function traverse(node: TableauNode, currentBranch: TableauNode[]) {
    const newBranch = [...currentBranch, node]
    
    if (node.type === 'closed') {
      // This branch is closed, don't add it
      return
    }
    
    if (!node.children || node.children.length === 0) {
      // This is a leaf node and not closed, so it's an open branch
      branches.push(newBranch)
      return
    }
    
    // Continue traversing children
    node.children.forEach(child => {
      traverse(child, newBranch)
    })
  }
  
  traverse(root, [])
  return branches
}

/**
 * Calculates proof status for a tableau
 */
export function calculateProofStatus(root: TableauNode): ProofStatus {
  const openBranches = findOpenBranches(root)
  const allBranches = findAllBranches(root)
  const closedBranches = allBranches.length - openBranches.length
  
  return {
    isComplete: openBranches.length === 0,
    openBranches: openBranches.length,
    closedBranches,
    totalNodes: countNodes(root),
    contradictions: findContradictions(root)
  }
}

/**
 * Finds all branches (open and closed) in a tableau
 */
function findAllBranches(root: TableauNode): TableauNode[][] {
  const branches: TableauNode[][] = []
  
  function traverse(node: TableauNode, currentBranch: TableauNode[]) {
    const newBranch = [...currentBranch, node]
    
    if (!node.children || node.children.length === 0) {
      // This is a leaf node
      branches.push(newBranch)
      return
    }
    
    // Continue traversing children
    node.children.forEach(child => {
      traverse(child, newBranch)
    })
  }
  
  traverse(root, [])
  return branches
}

/**
 * Counts total nodes in a tableau
 */
function countNodes(root: TableauNode): number {
  let count = 1
  if (root.children) {
    root.children.forEach(child => {
      count += countNodes(child)
    })
  }
  return count
}

/**
 * Finds contradictions in a tableau
 */
function findContradictions(root: TableauNode): string[] {
  const contradictions: string[] = []
  const branches = findAllBranches(root)
  
  branches.forEach((branch, index) => {
    if (detectClosure(branch)) {
      contradictions.push(`Branch ${index + 1}`)
    }
  })
  
  return contradictions
}

/**
 * Validates a tableau rule application
 */
export function validateTableauRule(
  node: TableauNode,
  rule: string,
  _logicMode: LogicMode
): boolean {
  if (!node.ast) return false
  
  // Use the existing validateRule function from inference service
  // Note: validateRule expects different signature, simplified for now
  return rule !== 'Unknown'
}

/**
 * Gets the appropriate rule name for a node decomposition
 */
export function getRuleName(node: TableauNode): string {
  if (!node.ast) return 'Unknown'
  
  const ast = node.ast
  
  if (isAlpha(ast)) {
    if (ast.label === '∧') return 'α-rule (Conjunction)'
    if (ast.label === '¬' && ast.children?.[0]?.label === '∨') return 'α-rule (Negated Disjunction)'
  }
  
  if (isBeta(ast)) {
    if (ast.label === '∨') return 'β-rule (Disjunction)'
    if (ast.label === '¬' && ast.children?.[0]?.label === '∧') return 'β-rule (Negated Conjunction)'
  }
  
  if (isImplication(ast)) return 'Implication Elimination'
  if (isBiconditional(ast)) return 'Biconditional Elimination'
  if (isDoubleNeg(ast)) return 'Double Negation Elimination'
  if (isQuantifier(ast)) return 'Quantifier Instantiation'
  
  return 'Unknown Rule'
}
