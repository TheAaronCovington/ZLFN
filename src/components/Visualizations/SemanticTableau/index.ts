/**
 * SemanticTableau Module Exports
 * Consolidated exports for all SemanticTableau modules
 */

// Tableau Logic
export type {
  TableauNode,
  ProofStatus
} from './tableauLogic'

export {
  astToTableau,
  isAlpha,
  isBeta,
  isImplication,
  isBiconditional,
  isDoubleNeg,
  isQuantifier,
  decomposeNode,
  detectClosure,
  checkAllBranchesClosed,
  findOpenBranches,
  calculateProofStatus,
  validateTableauRule,
  getRuleName
} from './tableauLogic'

// Tree Renderer
export type {
  TreeRenderConfig,
  TreeCallbacks
} from './treeRenderer'

export {
  renderTableauTree,
  highlightPath,
  fitTreeToViewport,
  centerTree
} from './treeRenderer'

// Export Functions
export type {
  ProofStep,
  LatexExportOptions,
  ImageExportOptions
} from './exportFunctions'

export {
  generateTableauLatex,
  exportTableauLatex,
  exportTableauImage,
  collectProofSteps,
  exportProofSteps,
  generateProofText
} from './exportFunctions'
