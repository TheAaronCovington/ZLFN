// Main export file for the vis module
// This provides a clean API for importing visualization components

// Layers
export { renderZones } from './layers/zones'
export { renderEdges, updateEdgePositions } from './layers/edges'
export { renderNodes, updateNodePositions, setupNodeDrag } from './layers/nodes'
export { renderEdgeLabels, updateLabelPositions, createLabelCollisionAvoidance } from './layers/labels'

// Simulation
export { createCustomForces, createSimulation } from './simulation/forces'
export { useSimulation } from './hooks/useSimulation'

// Facets
export { createFacetIcons } from './facets/icons'
export { createFacetOverlay } from './facets/overlay'

// Utils
export { isVennRelevant, isTruthTableRelevant, isTimelineRelevant, isCounterRelevant } from './utils/relevance'
export { clamp, distance, midpoint } from './utils/graphMath'
export { truncateText, formatNumber } from './utils/format'

// Constants
export { DEFAULT_ZONES, COLORS, PERFORMANCE_THRESHOLDS } from './constants'

// Types
export type { EdgeData, RiverConfig } from './layers/edges'
export type { NodeData, NodeRenderConfig } from './layers/nodes'
export type { LabelData, LabelConfig } from './layers/labels'
export type { ForceConfig, BoundaryConfig } from './simulation/forces'
export type { UseSimulationConfig } from './hooks/useSimulation'
