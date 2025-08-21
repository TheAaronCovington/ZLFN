# Deduplication & Refactoring Plan

**Version**: 1.0  
**Last Updated**: 2024-12-19  
**Goal**: Eliminate code duplication while preserving all functionality and styling

## Overview

This plan addresses 6 major areas of code duplication identified in the codebase analysis. Each phase is designed to be **safe**, **incremental**, and **non-breaking**.

---

## Phase A: Infrastructure Services (Foundation)

### A1: Shared Storage Service
**Target**: Consolidate localStorage patterns across components

**Current Duplication**:
- `LogicVisualizer.tsx`: 8+ localStorage operations with try/catch
- `LibrarySidebar.tsx`: Custom `loadSet`/`saveSet` functions
- `SemanticTableau.tsx`: Multiple localStorage operations
- Various components: Inconsistent error handling

**Solution**: Create `src/services/storage.ts`

```typescript
// New file: src/services/storage.ts
export interface StorageService {
  // Basic operations
  getItem(key: string): string | null
  setItem(key: string, value: string): boolean
  removeItem(key: string): boolean
  
  // JSON operations
  getJSON<T>(key: string, defaultValue?: T): T | null
  setJSON<T>(key: string, value: T): boolean
  
  // Set operations (for LibrarySidebar)
  getSet(key: string): Set<string>
  setSet(key: string, set: Set<string>): boolean
  
  // Cross-tab events
  onStorageChange(key: string, callback: (newValue: string | null) => void): () => void
}
```

**Implementation Steps**:
1. Create `storage.ts` with all methods
2. Add comprehensive error handling and logging
3. Include cross-tab synchronization helpers
4. Add TypeScript generics for type safety

**Migration Strategy**:
- Phase A1a: Create service (no consumers)
- Phase A1b: Migrate `LibrarySidebar.tsx` first (smallest impact)
- Phase A1c: Migrate `LogicVisualizer.tsx` drawer states
- Phase A1d: Migrate `SemanticTableau.tsx` preferences
- Phase A1e: Update other components as discovered

**Safety**: Each migration is a single component, easy to revert

---

### A2: Global Shortcuts Hook
**Target**: Consolidate keyboard shortcut handling

**Current Duplication**:
- `ZlfnGraph.tsx`: Lines 480-610, complex key handling with context detection
- `LogicVisualizer.tsx`: Lines 290-321, simpler shortcuts
- `SemanticTableau.tsx`: Arrow key navigation (lines 338+)

**Solution**: Create `src/hooks/useGlobalShortcuts.ts`

```typescript
// New file: src/hooks/useGlobalShortcuts.ts
export interface ShortcutBinding {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  action: () => void
  description: string
  enabled?: boolean
}

export interface ShortcutOptions {
  disableInInputs?: boolean
  disableInDialogs?: boolean
  debugLogging?: boolean
}

export function useGlobalShortcuts(
  bindings: ShortcutBinding[],
  options: ShortcutOptions = {}
): {
  registerShortcut: (binding: ShortcutBinding) => void
  unregisterShortcut: (key: string) => void
  getActiveShortcuts: () => ShortcutBinding[]
}
```

**Implementation Steps**:
1. Extract context detection logic from `ZlfnGraph.tsx`
2. Create flexible binding system
3. Add debug logging (reuse existing pattern)
4. Support dynamic registration/unregistration

**Migration Strategy**:
- Phase A2a: Create hook with ZlfnGraph's context detection
- Phase A2b: Migrate `LogicVisualizer.tsx` (simpler case)
- Phase A2c: Migrate `ZlfnGraph.tsx` (preserve all existing shortcuts)
- Phase A2d: Migrate `SemanticTableau.tsx` arrow keys

**Safety**: Hook wraps existing logic, no behavior change

---

### A3: Enhanced Export Service
**Target**: Consolidate export/download functionality

**Current Duplication**:
- `LogicVisualizer.tsx`: Basic JSON export (lines 224-236)
- `SemanticTableau.tsx`: LaTeX, PNG, SVG, proof steps export
- `ZlfnGraph.tsx`: SVG export functionality
- `exportService.ts`: Existing but incomplete
- `io.ts`: Basic `downloadJson`

**Solution**: Extend `src/services/exportService.ts`

```typescript
// Enhanced exportService.ts
export interface ExportService {
  // Existing methods...
  
  // New consolidated methods
  exportTableauLatex(tableau: any, options: LatexOptions): Promise<void>
  exportTableauImage(svgElement: SVGElement, format: 'png' | 'svg', options: ImageOptions): Promise<void>
  exportProofSteps(steps: ProofStep[], format: 'json' | 'csv' | 'markdown' | 'html'): Promise<void>
  exportGraphSvg(svgElement: SVGElement, options: SvgOptions): Promise<void>
  
  // Unified download helper
  downloadFile(content: string | Blob, filename: string, mimeType?: string): void
}
```

**Implementation Steps**:
1. Move all export logic from components to service
2. Create unified download helper
3. Add proper TypeScript interfaces
4. Preserve all existing export options

**Migration Strategy**:
- Phase A3a: Extend `exportService.ts` with new methods
- Phase A3b: Migrate `SemanticTableau.tsx` exports (most complex)
- Phase A3c: Migrate `ZlfnGraph.tsx` SVG export
- Phase A3d: Migrate `LogicVisualizer.tsx` JSON export

**Safety**: Service methods wrap existing component logic

---

## Phase B: UI Component Consolidation

### B1: Status Chip Component
**Target**: Consolidate status/legend chip creation

**Current Duplication**:
- `SemanticTableau.tsx`: Proof status chips, branch legend
- `ZlfnGraph.tsx`: Various status indicators
- `ControlsDrawer.tsx`: Mode chips
- `VersionControl/*`: Status chips

**Solution**: Create `src/components/UI/StatusChip.tsx`

```typescript
// New file: src/components/UI/StatusChip.tsx
export interface StatusChipProps {
  variant: 'proof' | 'branch' | 'mode' | 'status' | 'legend'
  status: string
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info'
  size?: 'small' | 'medium'
  tooltip?: string
  icon?: React.ReactNode
  onClick?: () => void
}

export const StatusChip: React.FC<StatusChipProps>
```

**Implementation Steps**:
1. Extract common chip patterns from components
2. Create flexible variant system
3. Preserve all existing styling
4. Add consistent tooltip support

**Migration Strategy**:
- Phase B1a: Create component with all variants
- Phase B1b: Replace chips in `SemanticTableau.tsx`
- Phase B1c: Replace chips in other components
- Phase B1d: Verify styling matches exactly

**Safety**: Component replicates existing MUI Chip usage

---

### B2: Legend Component
**Target**: Consolidate legend/guide displays

**Current Duplication**:
- `SemanticTableau.tsx`: Branch legend tooltip
- `ZlfnGraph.tsx`: Various legends and guides
- `SymbolGuide.tsx`: Symbol reference

**Solution**: Create `src/components/UI/Legend.tsx`

```typescript
// New file: src/components/UI/Legend.tsx
export interface LegendItem {
  key: string
  label: string
  color?: string
  style?: 'solid' | 'dashed' | 'dotted'
  description?: string
}

export interface LegendProps {
  title: string
  items: LegendItem[]
  variant: 'tooltip' | 'panel' | 'inline'
  compact?: boolean
}

export const Legend: React.FC<LegendProps>
```

**Implementation Steps**:
1. Extract legend patterns from components
2. Support multiple display variants
3. Preserve all visual styling
4. Add flexible item configuration

**Migration Strategy**:
- Phase B2a: Create component with all variants
- Phase B2b: Replace legend in `SemanticTableau.tsx`
- Phase B2c: Replace legends in `ZlfnGraph.tsx`
- Phase B2d: Integrate with `SymbolGuide.tsx`

**Safety**: Component wraps existing legend logic

---

## Phase C: Large File Refactoring

### C1: ZlfnGraph Modularization
**Target**: Break down 4400-line `ZlfnGraph.tsx` into manageable modules

**Current Structure Analysis**:
- Lines 1-100: Imports, types, interfaces
- Lines 100-500: Component state and hooks
- Lines 500-1000: D3 setup and simulation
- Lines 1000-2000: Event handlers (keyboard, mouse, drag)
- Lines 2000-3000: Rendering logic (nodes, edges, facets)
- Lines 3000-4000: Dialog management and UI
- Lines 4000-4400: Export and utility functions

**Refactoring Plan**:

#### C1a: Extract D3 Simulation Logic
```typescript
// New file: src/vis/simulation/zlfnSimulation.ts
export interface ZlfnSimulationConfig {
  width: number
  height: number
  nodeRadius: number
  linkDistance: number
  // ... other config
}

export class ZlfnSimulation {
  private simulation: d3.Simulation<any, any>
  
  constructor(config: ZlfnSimulationConfig)
  updateNodes(nodes: ZlfnNode[]): void
  updateEdges(edges: ZlfnEdge[]): void
  start(): void
  stop(): void
  // ... other methods
}
```

#### C1b: Extract Event Handlers
```typescript
// New file: src/hooks/useZlfnInteractions.ts
export interface ZlfnInteractionHandlers {
  onNodeClick: (node: ZlfnNode) => void
  onNodeDrag: (node: ZlfnNode, x: number, y: number) => void
  onEdgeClick: (edge: ZlfnEdge) => void
  // ... other handlers
}

export function useZlfnInteractions(
  svgRef: React.RefObject<SVGSVGElement>,
  handlers: ZlfnInteractionHandlers
): {
  bindEvents: () => void
  unbindEvents: () => void
}
```

#### C1c: Extract Rendering Logic
```typescript
// New file: src/vis/renderers/zlfnRenderer.ts
export class ZlfnRenderer {
  constructor(private svg: d3.Selection<SVGSVGElement, any, any, any>)
  
  renderNodes(nodes: ZlfnNode[]): void
  renderEdges(edges: ZlfnEdge[]): void
  renderFacets(nodes: ZlfnNode[]): void
  updateLayout(): void
}
```

**Migration Strategy**:
- Phase C1a: Extract simulation (no UI changes)
- Phase C1b: Extract event handlers (preserve all interactions)
- Phase C1c: Extract rendering (preserve all visuals)
- Phase C1d: Slim down main component to orchestration only

**Safety**: Each extraction preserves exact behavior

---

### C2: SemanticTableau Modularization
**Target**: Break down 1800-line `SemanticTableau.tsx` into focused modules

**Current Structure Analysis**:
- Lines 1-100: Imports, types, state setup
- Lines 100-400: Tableau logic (expansion, closure, validation)
- Lines 400-800: D3 rendering and layout
- Lines 800-1200: Export functions (LaTeX, PNG, SVG, proof steps)
- Lines 1200-1600: Event handlers and interactions
- Lines 1600-1800: UI rendering and dialogs

**Refactoring Plan**:

#### C2a: Extract Tableau Rules Engine
```typescript
// New file: src/services/tableauRules.ts
export interface TableauRule {
  name: string
  type: 'alpha' | 'beta' | 'closure' | 'negation'
  apply(node: TableauNode): TableauNode[]
  validate(node: TableauNode, logicMode: LogicMode): boolean
}

export class TableauEngine {
  constructor(private logicMode: LogicMode)
  
  expandNode(node: TableauNode): TableauNode[]
  detectClosure(branch: TableauNode[]): boolean
  validateProof(root: TableauNode): ProofValidation
}
```

#### C2b: Extract Export Logic
```typescript
// New file: src/services/tableauExport.ts
export class TableauExporter {
  generateLatex(root: TableauNode, options: LatexOptions): string
  generateProofSteps(root: TableauNode): ProofStep[]
  exportImage(svgElement: SVGElement, format: 'png' | 'svg'): Promise<void>
}
```

#### C2c: Extract D3 Rendering
```typescript
// New file: src/vis/renderers/tableauRenderer.ts
export class TableauRenderer {
  constructor(private svg: d3.Selection<SVGSVGElement, any, any, any>)
  
  renderTree(root: TableauNode, layoutMode: 'tree' | 'hierarchy'): void
  highlightPath(nodeId: string): void
  updateSelection(nodeId: string | null): void
}
```

**Migration Strategy**:
- Phase C2a: Extract rules engine (preserve all logic)
- Phase C2b: Extract export logic (preserve all formats)
- Phase C2c: Extract D3 rendering (preserve all visuals)
- Phase C2d: Slim down main component

**Safety**: Each module wraps existing component logic

---

## Implementation Timeline

### Week 1: Foundation (Phase A)
- **Day 1-2**: A1 - Storage service
- **Day 3-4**: A2 - Global shortcuts hook  
- **Day 5**: A3 - Enhanced export service

### Week 2: UI Consolidation (Phase B)
- **Day 1-2**: B1 - Status chip component
- **Day 3**: B2 - Legend component
- **Day 4-5**: Migration and testing

### Week 3: Large File Refactoring (Phase C)
- **Day 1-3**: C1 - ZlfnGraph modularization
- **Day 4-5**: C2 - SemanticTableau modularization

### Week 4: Testing & Documentation
- **Day 1-2**: Comprehensive testing
- **Day 3**: Performance validation
- **Day 4**: Documentation updates
- **Day 5**: CodeMap updates

---

## Safety Measures

### 1. Incremental Migration
- Each phase builds on the previous
- No "big bang" changes
- Easy rollback at each step

### 2. Behavior Preservation
- All existing functionality preserved
- All styling preserved exactly
- All keyboard shortcuts preserved
- All export formats preserved

### 3. Testing Strategy
- Build verification after each step
- Visual regression testing
- Functional testing of all features
- Performance benchmarking

### 4. Rollback Plan
- Git branch for each phase
- Component-level rollback possible
- Service facade pattern for gradual adoption

---

## Success Metrics

### Code Quality
- **ZlfnGraph.tsx**: 4400 → ~800 lines (80% reduction)
- **SemanticTableau.tsx**: 1800 → ~600 lines (67% reduction)
- **Duplication**: 6 major areas → 0 duplicated patterns

### Maintainability
- Single source of truth for each concern
- Consistent patterns across components
- Easier testing and debugging
- Better TypeScript coverage

### Performance
- No performance regression
- Potential improvements from better separation
- Smaller bundle sizes per feature

---

## Risk Mitigation

### High-Risk Areas
1. **D3 Integration**: Complex state management
   - **Mitigation**: Extract gradually, preserve all D3 patterns
2. **Keyboard Shortcuts**: Complex context detection
   - **Mitigation**: Wrap existing logic, don't rewrite
3. **Export Functions**: Multiple formats and edge cases
   - **Mitigation**: Move logic as-is, add tests

### Medium-Risk Areas
1. **localStorage**: Cross-tab synchronization
   - **Mitigation**: Preserve existing patterns, add error handling
2. **Component State**: Complex interdependencies
   - **Mitigation**: Extract services first, then UI components

### Low-Risk Areas
1. **UI Components**: Well-isolated
2. **Type Definitions**: No runtime impact
3. **Documentation**: No functional impact

---

*This plan prioritizes safety and incremental progress while achieving significant code quality improvements.*
