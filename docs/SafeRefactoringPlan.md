# Safe Refactoring Plan

**Version**: 1.0  
**Last Updated**: 2024-12-19  
**Goal**: Modularize large files while preserving ALL functionality and styling

## Overview

This plan provides **step-by-step, safe refactoring** for the two largest files in the codebase:
- `ZlfnGraph.tsx` (4400 lines) → Modular architecture
- `SemanticTableau.tsx` (1800 lines) → Focused modules

**Safety Principles**:
1. **No behavior changes** - All functionality preserved exactly
2. **No styling changes** - All visual elements preserved exactly  
3. **Incremental steps** - Each step is independently verifiable
4. **Easy rollback** - Each step can be reverted without affecting others
5. **Build-green guarantee** - TypeScript compilation succeeds at each step

---

## Part 1: ZlfnGraph.tsx Refactoring

### Current Analysis
**File**: `src/components/Visualizations/ZlfnGraph.tsx` (4400 lines)

**Major Sections**:
1. **Imports & Types** (Lines 1-136): 35+ imports, complex type definitions
2. **Component State** (Lines 137-300): 20+ useState hooks, complex state management
3. **D3 Simulation** (Lines 300-800): Force simulation setup, node/edge management
4. **Event Handlers** (Lines 800-1200): Keyboard shortcuts, mouse events, drag handlers
5. **Rendering Logic** (Lines 1200-2800): D3 rendering, SVG manipulation, facet overlays
6. **Dialog Management** (Lines 2800-3600): Venn, Truth Table, Timeline, Counter dialogs
7. **Export Functions** (Lines 3600-4000): SVG export, layout saving
8. **Utility Functions** (Lines 4000-4400): Helper functions, performance optimization

### Refactoring Strategy: "Extract and Preserve"

#### Step 1: Extract D3 Simulation Logic
**Target**: Lines 300-800 (D3 simulation setup)
**Goal**: Move simulation logic to dedicated service while preserving exact behavior

**New File**: `src/vis/simulation/ZlfnSimulation.ts`
```typescript
import * as d3 from 'd3'
import type { ZlfnNode, ZlfnEdge } from '../../components/Visualizations/ZlfnGraph'

export interface SimulationConfig {
  width: number
  height: number
  nodeRadius: number
  linkDistance: number
  chargeStrength: number
  centerForce: number
  collisionRadius: number
}

export class ZlfnSimulation {
  private simulation: d3.Simulation<ZlfnNode, ZlfnEdge>
  private config: SimulationConfig
  
  constructor(config: SimulationConfig) {
    this.config = config
    this.simulation = this.createSimulation()
  }
  
  private createSimulation(): d3.Simulation<ZlfnNode, ZlfnEdge> {
    // Extract exact simulation setup from ZlfnGraph.tsx lines 300-800
    // Preserve all force configurations, alpha settings, etc.
  }
  
  updateNodes(nodes: ZlfnNode[]): void {
    // Extract node update logic, preserve all D3 patterns
  }
  
  updateEdges(edges: ZlfnEdge[]): void {
    // Extract edge update logic, preserve all D3 patterns
  }
  
  // ... other methods that wrap existing simulation logic
}
```

**Migration Steps**:
1. **Step 1a**: Create `ZlfnSimulation.ts` with empty class
2. **Step 1b**: Copy simulation setup code from `ZlfnGraph.tsx` (preserve exactly)
3. **Step 1c**: Replace simulation code in `ZlfnGraph.tsx` with service calls
4. **Step 1d**: Verify build and test all simulation behavior
5. **Step 1e**: Remove commented-out code from `ZlfnGraph.tsx`

**Safety Checks**:
- [ ] TypeScript compiles without errors
- [ ] All D3 forces work identically
- [ ] Node positioning behavior unchanged
- [ ] Performance characteristics maintained

---

#### Step 2: Extract Event Handling Logic
**Target**: Lines 800-1200 (Keyboard shortcuts, mouse events, drag handlers)
**Goal**: Move event handling to reusable hook

**New File**: `src/hooks/useZlfnInteractions.ts`
```typescript
import { useEffect, useCallback } from 'react'
import * as d3 from 'd3'
import type { ZlfnNode, ZlfnEdge } from '../components/Visualizations/ZlfnGraph'

export interface InteractionHandlers {
  onNodeClick: (node: ZlfnNode, event: MouseEvent) => void
  onNodeDoubleClick: (node: ZlfnNode, event: MouseEvent) => void
  onNodeDragStart: (node: ZlfnNode, event: d3.D3DragEvent<any, any, any>) => void
  onNodeDrag: (node: ZlfnNode, event: d3.D3DragEvent<any, any, any>) => void
  onNodeDragEnd: (node: ZlfnNode, event: d3.D3DragEvent<any, any, any>) => void
  onEdgeClick: (edge: ZlfnEdge, event: MouseEvent) => void
  onCanvasClick: (event: MouseEvent) => void
  onKeyDown: (event: KeyboardEvent) => void
}

export interface InteractionOptions {
  disableShortcuts?: boolean
  enableDrag?: boolean
  enableZoom?: boolean
}

export function useZlfnInteractions(
  svgRef: React.RefObject<SVGSVGElement>,
  handlers: InteractionHandlers,
  options: InteractionOptions = {}
) {
  // Extract all event handling logic from ZlfnGraph.tsx lines 800-1200
  // Preserve exact keyboard shortcut behavior, drag logic, etc.
  
  const bindEvents = useCallback(() => {
    // Extract event binding logic, preserve all D3 event patterns
  }, [/* dependencies */])
  
  const unbindEvents = useCallback(() => {
    // Extract cleanup logic
  }, [])
  
  useEffect(() => {
    bindEvents()
    return unbindEvents
  }, [bindEvents, unbindEvents])
  
  return {
    bindEvents,
    unbindEvents
  }
}
```

**Migration Steps**:
1. **Step 2a**: Create `useZlfnInteractions.ts` with interface definitions
2. **Step 2b**: Copy all event handling code from `ZlfnGraph.tsx` (preserve exactly)
3. **Step 2c**: Replace event code in `ZlfnGraph.tsx` with hook usage
4. **Step 2d**: Verify all keyboard shortcuts work identically
5. **Step 2e**: Verify all mouse interactions work identically

**Safety Checks**:
- [ ] All keyboard shortcuts preserved (F, C, P, Z, S, M, R, X, H, O, T, etc.)
- [ ] Drag and drop behavior identical
- [ ] Context detection logic preserved (inputs, dialogs, etc.)
- [ ] Debug logging preserved

---

#### Step 3: Extract Rendering Logic
**Target**: Lines 1200-2800 (D3 rendering, SVG manipulation, facet overlays)
**Goal**: Move rendering to dedicated renderer class

**New File**: `src/vis/renderers/ZlfnRenderer.ts`
```typescript
import * as d3 from 'd3'
import type { ZlfnNode, ZlfnEdge, ZlfnZone } from '../../components/Visualizations/ZlfnGraph'

export interface RenderConfig {
  showLabels: boolean
  showZones: boolean
  showFacets: boolean
  nodeRadius: number
  fontSize: number
  // ... other render options
}

export class ZlfnRenderer {
  private svg: d3.Selection<SVGSVGElement, any, any, any>
  private config: RenderConfig
  
  constructor(
    svg: d3.Selection<SVGSVGElement, any, any, any>,
    config: RenderConfig
  ) {
    this.svg = svg
    this.config = config
  }
  
  renderNodes(nodes: ZlfnNode[]): void {
    // Extract node rendering logic from ZlfnGraph.tsx
    // Preserve all SVG elements, styling, animations
  }
  
  renderEdges(edges: ZlfnEdge[]): void {
    // Extract edge rendering logic
    // Preserve all path calculations, styling, arrows
  }
  
  renderZones(zones: ZlfnZone[]): void {
    // Extract zone rendering logic
    // Preserve all zone styling, conflict detection
  }
  
  renderFacets(nodes: ZlfnNode[]): void {
    // Extract facet overlay logic
    // Preserve all icon positioning, click handlers
  }
  
  updateLayout(): void {
    // Extract layout update logic
    // Preserve all positioning calculations
  }
  
  // ... other rendering methods
}
```

**Migration Steps**:
1. **Step 3a**: Create `ZlfnRenderer.ts` with class structure
2. **Step 3b**: Copy node rendering code (preserve all SVG creation)
3. **Step 3c**: Copy edge rendering code (preserve all path calculations)
4. **Step 3d**: Copy zone rendering code (preserve all styling)
5. **Step 3e**: Copy facet rendering code (preserve all overlays)
6. **Step 3f**: Replace rendering code in `ZlfnGraph.tsx` with renderer calls
7. **Step 3g**: Verify all visuals are identical

**Safety Checks**:
- [ ] All node shapes and colors identical
- [ ] All edge paths and styling identical
- [ ] All zone rendering identical
- [ ] All facet icons positioned identically
- [ ] All animations preserved

---

#### Step 4: Extract Dialog Management
**Target**: Lines 2800-3600 (Dialog state and handlers)
**Goal**: Move dialog orchestration to dedicated hook

**New File**: `src/hooks/useZlfnDialogs.ts`
```typescript
import { useState, useCallback } from 'react'
import type { ZlfnNode } from '../components/Visualizations/ZlfnGraph'
import type { VennDiagramData, NecessarySufficientExample } from '../components/Visualizations/VennDiagram'

export interface DialogState {
  venn: { open: boolean; node: ZlfnNode | null; data: VennDiagramData | null }
  truthTable: { open: boolean; node: ZlfnNode | null; expression: string | null }
  timeline: { open: boolean; node: ZlfnNode | null }
  counterarguments: { open: boolean; node: ZlfnNode | null }
  batchOps: { open: boolean }
  export: { open: boolean }
  search: { open: boolean }
  nodeEdit: { open: boolean; node: ZlfnNode | null }
}

export function useZlfnDialogs() {
  // Extract all dialog state management from ZlfnGraph.tsx
  // Preserve all dialog opening/closing logic
  
  const [dialogs, setDialogs] = useState<DialogState>({
    // Initialize all dialog states
  })
  
  const openVennDialog = useCallback((node: ZlfnNode, data: VennDiagramData) => {
    // Extract venn dialog opening logic
  }, [])
  
  const openTruthTableDialog = useCallback((node: ZlfnNode, expression: string) => {
    // Extract truth table dialog opening logic
  }, [])
  
  // ... other dialog methods
  
  return {
    dialogs,
    openVennDialog,
    openTruthTableDialog,
    // ... other methods
  }
}
```

**Migration Steps**:
1. **Step 4a**: Create `useZlfnDialogs.ts` with state structure
2. **Step 4b**: Copy all dialog state management (preserve exact behavior)
3. **Step 4c**: Copy all dialog opening/closing handlers
4. **Step 4d**: Replace dialog code in `ZlfnGraph.tsx` with hook usage
5. **Step 4e**: Verify all dialogs open/close identically

**Safety Checks**:
- [ ] All dialogs open with correct data
- [ ] All dialog closing behavior preserved
- [ ] All dialog state management identical

---

#### Step 5: Extract Export Functions
**Target**: Lines 3600-4000 (SVG export, layout saving)
**Goal**: Move to enhanced export service

**Enhancement**: Extend existing `src/services/exportService.ts`
```typescript
// Add to existing exportService.ts
export interface ZlfnExportOptions {
  includeFacets: boolean
  includeZones: boolean
  format: 'svg' | 'png' | 'json'
  // ... other options
}

export class ExportService {
  // ... existing methods
  
  exportZlfnGraph(
    svgElement: SVGSVGElement,
    nodes: ZlfnNode[],
    edges: ZlfnEdge[],
    options: ZlfnExportOptions
  ): Promise<void> {
    // Extract SVG export logic from ZlfnGraph.tsx
    // Preserve all export formats and options
  }
  
  saveZlfnLayout(
    nodes: ZlfnNode[],
    edges: ZlfnEdge[],
    storageKey: string
  ): void {
    // Extract layout saving logic
    // Preserve all localStorage patterns
  }
  
  loadZlfnLayout(storageKey: string): any {
    // Extract layout loading logic
  }
}
```

**Migration Steps**:
1. **Step 5a**: Add ZLFN export methods to `exportService.ts`
2. **Step 5b**: Copy export logic from `ZlfnGraph.tsx` (preserve exactly)
3. **Step 5c**: Replace export code in `ZlfnGraph.tsx` with service calls
4. **Step 5d**: Verify all export formats work identically

**Safety Checks**:
- [ ] SVG export produces identical files
- [ ] PNG export works identically
- [ ] Layout save/load preserves all data

---

#### Step 6: Final ZlfnGraph Cleanup
**Target**: Remaining utility functions and cleanup
**Goal**: Slim down main component to orchestration only

**Final `ZlfnGraph.tsx` Structure** (~800 lines):
```typescript
// Imports (reduced to essentials)
import { ZlfnSimulation } from '../../vis/simulation/ZlfnSimulation'
import { useZlfnInteractions } from '../../hooks/useZlfnInteractions'
import { ZlfnRenderer } from '../../vis/renderers/ZlfnRenderer'
import { useZlfnDialogs } from '../../hooks/useZlfnDialogs'
// ... other focused imports

export const ZlfnGraph: React.FC<ZlfnGraphProps> = (props) => {
  // Essential state only
  const [nodes, setNodes] = useState<ZlfnNode[]>([])
  const [edges, setEdges] = useState<ZlfnEdge[]>([])
  // ... other essential state
  
  // Service instances
  const simulation = useMemo(() => new ZlfnSimulation(config), [config])
  const renderer = useMemo(() => new ZlfnRenderer(svg, renderConfig), [svg, renderConfig])
  
  // Hooks
  const dialogs = useZlfnDialogs()
  useZlfnInteractions(svgRef, interactionHandlers, interactionOptions)
  
  // Orchestration logic only
  useEffect(() => {
    simulation.updateNodes(nodes)
    renderer.renderNodes(nodes)
  }, [nodes, simulation, renderer])
  
  // Render (UI only, no complex logic)
  return (
    <Box>
      <svg ref={svgRef} />
      {/* Dialog components */}
    </Box>
  )
}
```

**Migration Steps**:
1. **Step 6a**: Remove all extracted code from `ZlfnGraph.tsx`
2. **Step 6b**: Add service/hook imports and usage
3. **Step 6c**: Simplify component to orchestration only
4. **Step 6d**: Verify all functionality works identically
5. **Step 6e**: Remove unused imports and variables

**Safety Checks**:
- [ ] All features work identically
- [ ] Performance is maintained or improved
- [ ] File size reduced to ~800 lines
- [ ] TypeScript compilation successful

---

## Part 2: SemanticTableau.tsx Refactoring

### Current Analysis
**File**: `src/components/Visualizations/SemanticTableau.tsx` (1800 lines)

**Major Sections**:
1. **Imports & Types** (Lines 1-100): Component setup, type definitions
2. **Tableau Logic** (Lines 100-400): Rule application, expansion, closure detection
3. **D3 Rendering** (Lines 400-800): Tree layout, SVG rendering, node positioning
4. **Export Functions** (Lines 800-1200): LaTeX, PNG, SVG, proof steps export
5. **Event Handlers** (Lines 1200-1600): Arrow navigation, node selection, interactions
6. **UI Rendering** (Lines 1600-1800): Component JSX, dialog management

### Refactoring Strategy: "Domain-Driven Extraction"

#### Step 1: Extract Tableau Rules Engine
**Target**: Lines 100-400 (Rule application, expansion, closure)
**Goal**: Move tableau logic to dedicated service

**New File**: `src/services/tableauRules.ts`
```typescript
import type { AstNodeRec } from './logic'
import type { LogicMode } from './inference'

export interface TableauNode {
  id: string
  label: string
  type: 'root' | 'open' | 'closed' | 'intermediate'
  children?: TableauNode[]
  ast?: AstNodeRec
  decomposed?: boolean
  parent?: TableauNode
  depth?: number
}

export interface TableauRule {
  name: string
  type: 'alpha' | 'beta' | 'closure' | 'negation' | 'implication' | 'biconditional' | 'quantifier'
  applies: (node: TableauNode) => boolean
  apply: (node: TableauNode) => TableauNode[]
  validate: (node: TableauNode, logicMode: LogicMode) => boolean
}

export class TableauEngine {
  private rules: TableauRule[]
  private logicMode: LogicMode
  
  constructor(logicMode: LogicMode) {
    this.logicMode = logicMode
    this.rules = this.initializeRules()
  }
  
  private initializeRules(): TableauRule[] {
    // Extract all rule definitions from SemanticTableau.tsx
    // Preserve exact rule application logic
  }
  
  expandNode(node: TableauNode): TableauNode[] {
    // Extract node expansion logic (preserve exactly)
  }
  
  detectClosure(branch: TableauNode[]): boolean {
    // Extract closure detection (preserve exactly)
  }
  
  validateProof(root: TableauNode): ProofValidation {
    // Extract proof validation (preserve exactly)
  }
  
  autoExpand(root: TableauNode, maxDepth: number): TableauNode {
    // Extract auto-expansion logic (preserve exactly)
  }
  
  autoClose(root: TableauNode): TableauNode {
    // Extract auto-closure logic (preserve exactly)
  }
}
```

**Migration Steps**:
1. **Step 1a**: Create `tableauRules.ts` with interfaces
2. **Step 1b**: Copy all rule definitions (preserve exact logic)
3. **Step 1c**: Copy expansion/closure algorithms (preserve exactly)
4. **Step 1d**: Replace tableau logic in `SemanticTableau.tsx` with engine calls
5. **Step 1e**: Verify all tableau operations work identically

**Safety Checks**:
- [ ] All tableau rules apply identically
- [ ] Node expansion produces same results
- [ ] Closure detection works identically
- [ ] Auto-expand/close behavior preserved

---

#### Step 2: Extract Export Logic
**Target**: Lines 800-1200 (LaTeX, PNG, SVG, proof steps export)
**Goal**: Move to dedicated export service

**New File**: `src/services/tableauExport.ts`
```typescript
import type { TableauNode } from './tableauRules'

export interface LatexOptions {
  includeProofSteps: boolean
  usePackages: string[]
  documentClass: string
}

export interface ProofStep {
  stepNumber: number
  action: string
  formula: string
  rule: string
  justification: string
  branchStatus: 'open' | 'closed'
}

export class TableauExporter {
  generateLatex(root: TableauNode, options: LatexOptions): string {
    // Extract LaTeX generation logic (preserve exactly)
  }
  
  generateProofSteps(root: TableauNode): ProofStep[] {
    // Extract proof steps generation (preserve exactly)
  }
  
  generateProofText(root: TableauNode): string {
    // Extract natural language proof generation (preserve exactly)
  }
  
  async exportImage(
    svgElement: SVGSVGElement,
    format: 'png' | 'svg',
    filename: string
  ): Promise<void> {
    // Extract image export logic (preserve exactly)
  }
  
  exportProofSteps(
    steps: ProofStep[],
    format: 'json' | 'csv' | 'markdown' | 'html'
  ): void {
    // Extract proof steps export (preserve exactly)
  }
}
```

**Migration Steps**:
1. **Step 2a**: Create `tableauExport.ts` with class structure
2. **Step 2b**: Copy LaTeX generation logic (preserve exactly)
3. **Step 2c**: Copy proof steps generation (preserve exactly)
4. **Step 2d**: Copy image export logic (preserve exactly)
5. **Step 2e**: Replace export code in `SemanticTableau.tsx` with service calls
6. **Step 2f**: Verify all export formats produce identical results

**Safety Checks**:
- [ ] LaTeX output identical
- [ ] PNG/SVG exports identical
- [ ] Proof steps format identical
- [ ] All export options preserved

---

#### Step 3: Extract D3 Rendering Logic
**Target**: Lines 400-800 (Tree layout, SVG rendering, node positioning)
**Goal**: Move to dedicated renderer

**New File**: `src/vis/renderers/TableauRenderer.ts`
```typescript
import * as d3 from 'd3'
import type { TableauNode } from '../../services/tableauRules'

export interface TableauRenderConfig {
  layoutMode: 'tree' | 'hierarchy'
  nodeSize: [number, number]
  separation: (a: any, b: any) => number
  nodeRadius: number
  fontSize: number
  showRuleBadges: boolean
}

export class TableauRenderer {
  private svg: d3.Selection<SVGSVGElement, any, any, any>
  private config: TableauRenderConfig
  
  constructor(
    svg: d3.Selection<SVGSVGElement, any, any, any>,
    config: TableauRenderConfig
  ) {
    this.svg = svg
    this.config = config
  }
  
  renderTree(root: TableauNode): void {
    // Extract tree rendering logic (preserve exactly)
  }
  
  renderNodes(nodes: d3.HierarchyPointNode<TableauNode>[]): void {
    // Extract node rendering (preserve all styling)
  }
  
  renderLinks(links: d3.HierarchyPointLink<TableauNode>[]): void {
    // Extract link rendering (preserve all branch styling)
  }
  
  renderRuleBadges(nodes: d3.HierarchyPointNode<TableauNode>[]): void {
    // Extract rule badge rendering (preserve exactly)
  }
  
  highlightPath(nodeId: string): void {
    // Extract path highlighting (preserve exactly)
  }
  
  updateSelection(nodeId: string | null): void {
    // Extract selection updates (preserve exactly)
  }
  
  fitToView(): void {
    // Extract fit-to-view logic (preserve exactly)
  }
}
```

**Migration Steps**:
1. **Step 3a**: Create `TableauRenderer.ts` with class structure
2. **Step 3b**: Copy D3 tree layout logic (preserve exactly)
3. **Step 3c**: Copy node rendering logic (preserve all styling)
4. **Step 3d**: Copy link rendering logic (preserve branch colors)
5. **Step 3e**: Copy selection/highlighting logic (preserve exactly)
6. **Step 3f**: Replace rendering code in `SemanticTableau.tsx` with renderer calls
7. **Step 3g**: Verify all visuals are identical

**Safety Checks**:
- [ ] Tree layout identical
- [ ] Node styling identical
- [ ] Branch colors and styles identical
- [ ] Selection highlighting identical
- [ ] Rule badges positioned identically

---

#### Step 4: Extract Interaction Logic
**Target**: Lines 1200-1600 (Arrow navigation, node selection, interactions)
**Goal**: Move to dedicated hook

**New File**: `src/hooks/useTableauInteractions.ts`
```typescript
import { useEffect, useCallback } from 'react'
import type { TableauNode } from '../services/tableauRules'

export interface TableauInteractionHandlers {
  onNodeClick: (node: TableauNode) => void
  onNodeExpand: (node: TableauNode) => void
  onNodeClose: (node: TableauNode) => void
  onArrowNavigation: (direction: 'up' | 'down' | 'left' | 'right') => void
}

export function useTableauInteractions(
  root: TableauNode | null,
  selectedNodeId: string | null,
  handlers: TableauInteractionHandlers
) {
  const navigateWithArrows = useCallback((direction: string) => {
    // Extract arrow navigation logic (preserve exactly)
  }, [root, selectedNodeId])
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Extract keyboard handling (preserve exactly)
  }, [navigateWithArrows, handlers])
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
  
  return {
    navigateWithArrows
  }
}
```

**Migration Steps**:
1. **Step 4a**: Create `useTableauInteractions.ts` with interface
2. **Step 4b**: Copy arrow navigation logic (preserve exactly)
3. **Step 4c**: Copy keyboard handling (preserve all shortcuts)
4. **Step 4d**: Replace interaction code in `SemanticTableau.tsx` with hook
5. **Step 4e**: Verify all interactions work identically

**Safety Checks**:
- [ ] Arrow key navigation identical
- [ ] All keyboard shortcuts preserved
- [ ] Node selection behavior identical

---

#### Step 5: Final SemanticTableau Cleanup
**Target**: Simplify main component to orchestration
**Goal**: Slim down to ~600 lines focused on UI and coordination

**Final `SemanticTableau.tsx` Structure** (~600 lines):
```typescript
// Focused imports
import { TableauEngine } from '../../services/tableauRules'
import { TableauExporter } from '../../services/tableauExport'
import { TableauRenderer } from '../../vis/renderers/TableauRenderer'
import { useTableauInteractions } from '../../hooks/useTableauInteractions'
import { CompactTableauMenu } from './CompactTableauMenu'

export const SemanticTableau: React.FC<SemanticTableauProps> = ({ expression, ast, compact }) => {
  // Essential state only
  const [root, setRoot] = useState<TableauNode | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [logicMode, setLogicMode] = useState<LogicMode>('classical')
  
  // Service instances
  const engine = useMemo(() => new TableauEngine(logicMode), [logicMode])
  const exporter = useMemo(() => new TableauExporter(), [])
  const renderer = useMemo(() => new TableauRenderer(svg, renderConfig), [svg, renderConfig])
  
  // Hooks
  useTableauInteractions(root, selectedNodeId, interactionHandlers)
  
  // Orchestration logic only
  useEffect(() => {
    if (ast) {
      const newRoot = astToTableau(ast)
      setRoot(newRoot)
      renderer.renderTree(newRoot)
    }
  }, [ast, renderer])
  
  // Event handlers (delegate to services)
  const handleExpand = useCallback((node: TableauNode) => {
    const expanded = engine.expandNode(node)
    setRoot(prevRoot => /* update logic */)
  }, [engine])
  
  // Render (UI only)
  return (
    <Box>
      <CompactTableauMenu /* props */ />
      <svg ref={svgRef} />
      {/* Dialog components */}
    </Box>
  )
}
```

**Migration Steps**:
1. **Step 5a**: Remove all extracted code from `SemanticTableau.tsx`
2. **Step 5b**: Add service/hook imports and usage
3. **Step 5c**: Simplify component to orchestration only
4. **Step 5d**: Verify all functionality works identically
5. **Step 5e**: Remove unused imports and variables

**Safety Checks**:
- [ ] All tableau features work identically
- [ ] All export functions work identically
- [ ] All interactions preserved
- [ ] File size reduced to ~600 lines

---

## Implementation Schedule

### Phase 1: ZlfnGraph Refactoring (Week 1-2)
- **Day 1**: Step 1 - Extract D3 Simulation
- **Day 2**: Step 2 - Extract Event Handling  
- **Day 3**: Step 3 - Extract Rendering Logic
- **Day 4**: Step 4 - Extract Dialog Management
- **Day 5**: Step 5 - Extract Export Functions
- **Day 6**: Step 6 - Final Cleanup
- **Day 7**: Testing and verification

### Phase 2: SemanticTableau Refactoring (Week 3)
- **Day 1**: Step 1 - Extract Tableau Rules Engine
- **Day 2**: Step 2 - Extract Export Logic
- **Day 3**: Step 3 - Extract D3 Rendering
- **Day 4**: Step 4 - Extract Interaction Logic
- **Day 5**: Step 5 - Final Cleanup
- **Day 6-7**: Testing and verification

### Phase 3: Integration & Documentation (Week 4)
- **Day 1-2**: Cross-component testing
- **Day 3**: Performance validation
- **Day 4**: Documentation updates
- **Day 5**: CodeMap updates

---

## Verification Checklist

### After Each Step
- [ ] TypeScript compilation succeeds
- [ ] No console errors in browser
- [ ] All existing functionality works
- [ ] Visual appearance unchanged
- [ ] Performance not degraded

### After Each Component
- [ ] Full feature testing
- [ ] Export functions work identically
- [ ] All keyboard shortcuts preserved
- [ ] All styling preserved
- [ ] File size significantly reduced

### Final Verification
- [ ] **ZlfnGraph.tsx**: 4400 → ~800 lines (80% reduction)
- [ ] **SemanticTableau.tsx**: 1800 → ~600 lines (67% reduction)
- [ ] All tests pass
- [ ] No functionality regressions
- [ ] No styling regressions
- [ ] Performance maintained or improved

---

## Rollback Strategy

### Per-Step Rollback
Each step creates a git commit, allowing rollback to any previous state:
```bash
# Rollback last step
git reset --hard HEAD~1

# Rollback to specific step
git reset --hard <commit-hash>
```

### Per-Component Rollback
Each component refactoring is in a separate branch:
```bash
# Rollback entire ZlfnGraph refactoring
git checkout main
git branch -D refactor/zlfn-graph

# Rollback entire SemanticTableau refactoring  
git checkout main
git branch -D refactor/semantic-tableau
```

### Emergency Rollback
Complete rollback to pre-refactoring state:
```bash
git checkout main
git reset --hard <pre-refactoring-commit>
```

---

## Success Metrics

### Code Quality Improvements
- **Maintainability**: Single responsibility per module
- **Testability**: Isolated services easier to test
- **Readability**: Focused, smaller files
- **Reusability**: Services can be reused across components

### Technical Improvements
- **Bundle Size**: Potential for better tree-shaking
- **Performance**: Better separation of concerns
- **TypeScript**: Improved type safety with focused interfaces
- **Development**: Easier debugging and feature development

### Risk Mitigation
- **Zero Breaking Changes**: All functionality preserved exactly
- **Zero Visual Changes**: All styling preserved exactly
- **Easy Rollback**: Each step independently revertible
- **Incremental Progress**: Continuous verification at each step

---

*This plan ensures safe, incremental refactoring while preserving all existing functionality and styling.*
