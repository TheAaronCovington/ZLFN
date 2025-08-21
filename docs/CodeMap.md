# ZLFN/STN Codebase Map

**Version**: 1.0  
**Last Updated**: 2024-12-19  
**Purpose**: Comprehensive mapping of features to files for maintainability and refactoring

## Table of Contents
- [Core Architecture](#core-architecture)
- [Main Application](#main-application)
- [Visualization Components](#visualization-components)
- [Services](#services)
- [Hooks](#hooks)
- [Context & State](#context--state)
- [UI Components](#ui-components)
- [Testing](#testing)
- [File Size Analysis](#file-size-analysis)
- [Duplication Candidates](#duplication-candidates)

---

## Core Architecture

### Entry Point
- **`src/main.tsx`**: Application entry point, React root setup
- **`src/App.tsx`**: Main app shell, routing (if any)

### Main Pages
- **`src/pages/LogicVisualizer.tsx`** *(635 lines)*
  - **Features**: Main application shell, view mode switching (ZLFN/STN), drawer management
  - **Components**: CommandBar, ControlsDrawer, InspectorDrawer, StatusBar integration
  - **State**: View mode, drawer states, performance overlay, search, snackbar notifications
  - **Logic**: Expression parsing, import/export, keyboard shortcuts, responsive layout
  - **Dependencies**: LogicSharedContext, ZlfnGraphWithNotes, SemanticTableau

- **`src/pages/Phase2Demo.tsx`**: Demo page for Phase 2 features
- **`src/pages/VizSymbols.tsx`**: Symbol guide visualization page
- **`src/pages/VizVenn.tsx`**: Venn diagram standalone page
- **`src/pages/VizZlfn.tsx`**: ZLFN standalone page

---

## Main Application

### Command & Control Layer
- **`src/components/Visualizer/CommandBar.tsx`** *(~350 lines)*
  - **Features**: Top toolbar, search, simulation controls, layout actions, view mode toggle
  - **Components**: Search autocomplete, argument filter, performance toggle, help/shortcuts
  - **State**: Menu anchors, search state
  - **Dependencies**: MUI components, icons

- **`src/components/Visualizer/ControlsDrawer.tsx`**
  - **Features**: Left sidebar, expression input, logic mode controls, demo toggles
  - **Components**: Expression editor, mode checkboxes, document data toggle
  - **State**: Drawer open/close, form inputs

- **`src/components/Visualizer/InspectorDrawer.tsx`**
  - **Features**: Right sidebar, node/edge inspection, truth tables, venn diagrams
  - **Components**: Node details, edge details, truth table viewer, venn viewer
  - **State**: Selected items, truth table AST

- **`src/components/Visualizer/StatusBar.tsx`**
  - **Features**: Bottom status bar, performance metrics, status messages
  - **Components**: Node/edge counts, FPS display, memory usage, status text
  - **State**: Performance visibility

---

## Visualization Components

### ZLFN Graph System
- **`src/components/Visualizations/ZlfnGraph.tsx`** *(~4400 lines)* ✅ **REFACTORED INTO MODULES**
  - **Modular Structure**: Refactored into focused modules for better maintainability
  - **`src/components/Visualizations/ZlfnGraph/`**:
    - **`types.ts`**: Shared interfaces and type definitions
    - **`simulation.ts`**: D3 force simulation logic and layout algorithms
    - **`eventHandlers.ts`**: Mouse, keyboard, drag, and zoom interactions
    - **`rendering.ts`**: SVG rendering, visual updates, and D3 selections
    - **`utils.ts`**: Helper functions and calculations
    - **`index.ts`**: Consolidated exports
  - **Features**: D3 force-directed graph, node/edge rendering, interactions, facets
  - **Components**: Graph canvas, node shapes, edge lines, facet overlays (Venn, Truth, Timeline, Counter)
  - **State**: Simulation, selection, zoom/pan, facet dialogs, performance optimization
  - **Logic**: D3 force simulation, drag/drop, keyboard navigation, export SVG/PNG
  - **Dependencies**: D3, performance optimizer, enhanced dialogs, batch operations

- **`src/components/Visualizations/ZlfnGraphWithNotes.tsx`**
  - **Features**: ZLFN graph wrapper with notes integration
  - **Components**: ZlfnGraph + notes overlay
  - **State**: Notes data, notes dialogs
  - **Dependencies**: ZlfnGraph, notes hooks

### Semantic Tableau Network (STN)
- **`src/components/Visualizations/SemanticTableau.tsx`** *(~1800 lines)* ✅ **REFACTORED INTO MODULES**
  - **Modular Structure**: Refactored into focused modules for better maintainability
  - **`src/components/Visualizations/SemanticTableau/`**:
    - **`tableauLogic.ts`**: AST to tableau conversion, rule validation, logical operations
    - **`treeRenderer.ts`**: D3 tree layout and SVG rendering for tableau visualization
    - **`exportFunctions.ts`**: LaTeX, image, and proof steps export functionality
    - **`index.ts`**: Consolidated exports
  - **Features**: Tree-based tableau visualization, proof construction, export capabilities
  - **Components**: D3 tree layout, node expansion/closure, rule application, proof validation
  - **State**: Tableau tree, selected nodes, auto operations, step mode, proof status
  - **Logic**: Tableau rules (α, β, closure), branch validation, proof reconstruction
  - **Dependencies**: CompactTableauMenu, TableauComparison, logic services

- **`src/components/Visualizations/CompactTableauMenu.tsx`** *(~200 lines)*
  - **Features**: Redesigned single-row menu for STN with overflow dropdown
  - **Components**: Layout toggle, logic mode selector, status chips, export buttons
  - **State**: Overflow menu anchor
  - **Dependencies**: MUI components, logic types

- **`src/components/Visualizations/TableauComparison.tsx`** *(~150 lines)*
  - **Features**: Side-by-side tableau comparison dialog
  - **Components**: Multiple SemanticTableau instances, comparison insights
  - **State**: Comparison list, input expressions
  - **Dependencies**: SemanticTableau, logic parser

### Enhanced Facet Dialogs
- **`src/components/Enhanced/`**
  - **`EnhancedDialog.tsx`**: Base dialog wrapper with consistent styling
  - **`EnhancedVennDiagram.tsx`**: Enhanced Venn diagram with 3D/animation
  - **`EnhancedTruthTable.tsx`**: Enhanced truth table with highlighting
  - **`EnhancedTimeline.tsx`**: Enhanced timeline with temporal logic
  - **`EnhancedCounterarguments.tsx`**: Enhanced counterargument analysis
  - **`VennDiagramDialog.tsx`**: Dialog wrapper for Venn
  - **`TruthTableDialog.tsx`**: Dialog wrapper for Truth Table
  - **`TimelineDialog.tsx`**: Dialog wrapper for Timeline
  - **`CounterargumentsDialog.tsx`**: Dialog wrapper for Counterarguments
  - **`index.ts`**: Barrel exports for all enhanced components

### Base Visualizations
- **`src/components/Visualizations/VennDiagram.tsx`**
  - **Features**: Basic Venn diagram rendering with D3
  - **Components**: SVG circles, intersection calculations, set labels
  - **State**: Set data, intersection data
  - **Dependencies**: D3, MUI

- **`src/components/Visualizations/TruthTable.tsx`**
  - **Features**: Truth table generation and display
  - **Components**: Table rows, variable columns, result highlighting
  - **State**: Variables, truth assignments
  - **Dependencies**: Logic parser

- **`src/components/Visualizations/SymbolGuide.tsx`**
  - **Features**: Logic symbol reference guide
  - **Components**: Symbol grid, descriptions, examples
  - **State**: Symbol categories

---

## Services

### Core Logic Services
- **`src/services/logic.ts`** *(~485 lines)* 🟡 **MEDIUM-LARGE**
  - **Features**: Expression parsing, AST manipulation, logic transformations
  - **Functions**: `parseExpressionToAst`, `astToString`, `toNNF`, `toCNF`, `astToZlfnGraph`
  - **Types**: `AstNodeRec`, token types
  - **Logic**: Tokenizer, recursive descent parser, normal form converters
  - **Dependencies**: None (pure logic)

- **`src/services/inference.ts`** *(~668 lines)* 🟡 **MEDIUM-LARGE**
  - **Features**: Logical inference rules, validation, state evaluation
  - **Functions**: `validateRule`, `evaluateInference`, `evaluateStates`, `dynamicEvaluate`
  - **Types**: `LogicMode`, `InferenceEdge`
  - **Data**: `LOGICAL_RULES` constant with mode constraints
  - **Logic**: Rule validation across different logic systems
  - **Dependencies**: None (pure logic)

### Data Management Services
- **`src/services/zlfnAPI.ts`**
  - **Features**: API client for ZLFN objects, CRUD operations
  - **Functions**: Object management, version control, collaboration
  - **Dependencies**: Fetch API, error handling

- **`src/services/zlfnObjectManager.ts`**
  - **Features**: Local object management, caching, synchronization
  - **Functions**: Object lifecycle, conflict resolution
  - **Dependencies**: zlfnAPI, storage utilities

- **`src/services/batchOperations.ts`** *(~335 lines)*
  - **Features**: Bulk operations on ZLFN objects
  - **Functions**: Batch note edits, version operations, exports
  - **Classes**: `BatchOperationsService` with operation tracking
  - **Dependencies**: zlfnAPI, event system

### Export & Import Services
- **`src/services/exportService.ts`** *(~685 lines)* 🟡 **ENHANCED**
  - **Features**: Multi-format export (JSON, PDF, DOCX, SVG, PNG, Markdown, LaTeX, Proof Steps)
  - **Classes**: `ExportService` with format-specific methods
  - **Functions**: Format conversion, file generation, download triggers
  - **New Tableau Features**: LaTeX export, image export (PNG/SVG), proof steps export (JSON/CSV/Markdown/HTML)
  - **Interfaces**: `TableauNode`, `LatexExportOptions`, `ProofStep`, `ImageExportOptions`
  - **Dependencies**: File APIs, canvas manipulation, LaTeX generation

- **`src/services/io.ts`**
  - **Features**: Basic file I/O utilities
  - **Functions**: `downloadJson`, `readJsonFile`
  - **Dependencies**: File API, JSON parsing

- **`src/services/storage.ts`** *(~200 lines)* 🆕 **NEW**
  - **Features**: Consolidated localStorage operations with error handling
  - **Functions**: `getItem`, `setItem`, `getJSON`, `setJSON`, `getSet`, `setSet`, `onStorageChange`
  - **Classes**: `StorageServiceImpl` with cross-tab synchronization
  - **Compatibility**: Legacy functions for gradual migration
  - **Dependencies**: Browser localStorage API

### Document Services
- **`src/services/documentParser.ts`**
  - **Features**: Extract logical arguments from markdown documents
  - **Functions**: Document analysis, argument extraction
  - **Dependencies**: Markdown parsing, logic services

- **`src/services/markdownParser.ts`**
  - **Features**: Parse markdown into hierarchical structure
  - **Functions**: AST traversal, structure extraction
  - **Dependencies**: Unified/remark ecosystem

- **`src/services/markdownReferenceService.ts`**
  - **Features**: Manage markdown references for nodes
  - **Functions**: Reference linking, validation
  - **Dependencies**: Document services

### Performance & Optimization
- **`src/services/performanceOptimizer.ts`**
  - **Features**: Graph performance optimization, data reduction
  - **Functions**: Node clustering, edge simplification, LOD
  - **Types**: `OptimizedGraphData`
  - **Dependencies**: Graph algorithms

### Utility Services
- **`src/services/venn.ts`**
  - **Features**: Venn diagram calculations and utilities
  - **Functions**: Set operations, intersection calculations
  - **Dependencies**: Mathematical utilities

- **`src/services/eval.ts`**
  - **Features**: Safe expression evaluation (if needed)
  - **Functions**: Sandboxed evaluation
  - **Dependencies**: AST services

---

## Hooks

### Performance Hooks
- **`src/hooks/usePerformanceMonitor.ts`** *(~323 lines)*
  - **Features**: Real-time performance tracking, FPS monitoring, memory usage
  - **Functions**: Metric collection, alert thresholds, optimization suggestions
  - **Types**: `PerformanceMetrics`, `PerformanceConfig`
  - **Dependencies**: Browser performance APIs

### Interaction Hooks
- **`src/hooks/useGlobalShortcuts.ts`** *(~250 lines)* 🆕 **NEW**
  - **Features**: Consolidated keyboard shortcut handling with context detection
  - **Functions**: `useGlobalShortcuts`, `createShortcut`, context detection, dynamic registration
  - **Types**: `ShortcutBinding`, `ShortcutOptions`, `ShortcutContext`
  - **Patterns**: Common shortcuts (fit, center, save, search, help, undo/redo)
  - **Dependencies**: Keyboard event APIs, context detection logic

### Layout & Interaction Hooks
- **`src/hooks/useResizeObserver.ts`**
  - **Features**: Responsive layout detection
  - **Functions**: Element size tracking, resize callbacks
  - **Dependencies**: ResizeObserver API

- **`src/hooks/useResponsiveLayout.ts`**
  - **Features**: Responsive UI adaptations
  - **Functions**: Breakpoint detection, layout adjustments
  - **Dependencies**: Window size tracking

- **`src/hooks/useTouchGestures.ts`**
  - **Features**: Touch gesture recognition for mobile
  - **Functions**: Pinch, pan, tap gesture handling
  - **Dependencies**: Touch event APIs

### Notes & Data Hooks
- **`src/hooks/useD3Notes.ts`**
  - **Features**: D3-integrated notes management
  - **Functions**: Note positioning, D3 event integration
  - **Dependencies**: D3, notes services

- **`src/hooks/useZLFNNotes.ts`**
  - **Features**: ZLFN-specific notes functionality
  - **Functions**: Node-note associations, persistence
  - **Dependencies**: ZLFN services, storage

### Accessibility Hooks
- **`src/hooks/useAccessibility.ts`**
  - **Features**: Accessibility enhancements
  - **Functions**: ARIA management, keyboard navigation
  - **Dependencies**: Accessibility APIs

---

## Context & State

### Shared State
- **`src/context/LogicSharedContext.tsx`** *(~61 lines)*
  - **Features**: Global logic state management
  - **State**: Expression, modes, simulation state, node states, selection
  - **Functions**: State setters, reset functions
  - **Types**: `LogicMode`, `NodeState`, `NodeIdToActive`
  - **Dependencies**: React context

- **`src/context/ZLFNContext.tsx`**
  - **Features**: ZLFN-specific state management
  - **State**: Graph data, layout preferences
  - **Dependencies**: ZLFN services

---

## UI Components

### Layout Components
- **`src/components/Layout/`**
  - **`Layout.tsx`**: Main layout wrapper
  - **`DockBar.tsx`**: Dockable toolbar component
  - **`LibrarySidebar.tsx`**: Document library sidebar

### Specialized UI
- **`src/components/Search/AdvancedSearch.tsx`**
  - **Features**: Multi-faceted search interface
  - **Components**: Search filters, result display
  - **Dependencies**: Search services

- **`src/components/Export/ExportDialog.tsx`**
  - **Features**: Export options dialog
  - **Components**: Format selection, option toggles
  - **Dependencies**: Export service

- **`src/components/BatchOperations/BatchOperationsDialog.tsx`**
  - **Features**: Batch operation management UI
  - **Components**: Operation queue, progress tracking
  - **Dependencies**: Batch operations service

### Notes System
- **`src/components/Notes/`**
  - **`NotesDialog.tsx`**: Note editing dialog
  - **`NotesTooltip.tsx`**: Note preview tooltip

### File Management
- **`src/components/FileUpload/`**
  - **`FileManager.tsx`**: File management interface
  - **`FileUploadZone.tsx`**: Drag-and-drop upload area
  - **`MergeOptionsDialog.tsx`**: File merge conflict resolution

### Version Control
- **`src/components/VersionControl/`**
  - **`VersionHistory.tsx`**: Version timeline display
  - **`DiffViewer.tsx`**: Version diff visualization
  - **`RestoreConfirmation.tsx`**: Version restore dialog

### Mobile Support
- **`src/components/Mobile/`**
  - **`MobileLayout.tsx`**: Mobile-optimized layout
  - **`MobileToolbar.tsx`**: Mobile toolbar
  - **`MobileZlfnGraph.tsx`**: Mobile graph component

### Accessibility
- **`src/components/Accessibility/AccessibilityProvider.tsx`**
  - **Features**: Accessibility context and utilities
  - **Dependencies**: Accessibility hooks

### Performance
- **`src/components/Performance/PerformanceOverlay.tsx`**
  - **Features**: Real-time performance display overlay
  - **Dependencies**: Performance monitor hook

---

## D3 Visualization Layer

### Core D3 Modules
- **`src/vis/`**
  - **`index.ts`**: Main vis exports
  - **`constants.ts`**: Visualization constants and configuration

### Rendering Layers
- **`src/vis/layers/`**
  - **`nodes.ts`** *(~118 lines)*: Node rendering with D3
  - **`edges.ts`**: Edge rendering with D3
  - **`labels.ts`**: Label positioning and rendering
  - **`zones.ts`**: Zone/region rendering for conflict detection

### Simulation & Forces
- **`src/vis/simulation/`**
  - **`forces.ts`**: Custom D3 force implementations
  - **`hooks/useSimulation.ts`**: D3 simulation management hook

### Facet System
- **`src/vis/facets/`**
  - **`icons.ts`**: Facet icon definitions and positioning
  - **`overlay.ts`**: Facet overlay management

### Utilities
- **`src/vis/utils/`**
  - **`format.ts`**: Data formatting utilities
  - **`graphMath.ts`**: Graph mathematical operations
  - **`relevance.ts`**: Facet relevance calculations

---

## Testing

### Service Tests
- **`src/tests/services/`**
  - **`batchOperations.test.ts`**: Batch operations testing
  - **`exportService.test.ts`**: Export service testing

### Component Tests
- **`src/tests/vis/layers/`**
  - **`zones.test.ts`**: Zone rendering tests

### Integration Tests
- **`src/components/Visualizations/SemanticTableau.test.tsx`**: STN integration tests

### Test Configuration
- **`src/tests/setup.ts`**: Test environment setup
- **`src/test/Phase1Verification.tsx`**: Phase 1 verification component

---

## File Size Analysis

### 🔴 Large Files (>1000 lines) - Refactor Candidates
1. **`ZlfnGraph.tsx`** (~4400 lines) - D3 graph with all features
2. **`SemanticTableau.tsx`** (~1800 lines) - STN with full tableau logic

### 🟡 Medium-Large Files (300-1000 lines) - Monitor
1. **`logic.ts`** (~485 lines) - Logic parser and transformations
2. **`inference.ts`** (~668 lines) - Inference rules and validation
3. **`exportService.ts`** (~377 lines) - Multi-format export
4. **`LogicVisualizer.tsx`** (~635 lines) - Main application shell
5. **`CommandBar.tsx`** (~350 lines) - Top toolbar
6. **`batchOperations.ts`** (~335 lines) - Batch operations
7. **`usePerformanceMonitor.ts`** (~323 lines) - Performance monitoring

### 🟢 Well-Sized Files (<300 lines) - Good
- Most other components and services are appropriately sized

---

## Duplication Status

### ✅ **RESOLVED** - Export/Import Logic
- **Previous Locations**: `LogicVisualizer.tsx`, `SemanticTableau.tsx`, `CompactTableauMenu.tsx`, `exportService.ts`, `io.ts`
- **Solution Implemented**: Enhanced `exportService.ts` with tableau-specific exports (LaTeX, PNG/SVG, proof steps)
- **Status**: Consolidated into single service with typed APIs

### ✅ **RESOLVED** - Keyboard Shortcuts  
- **Previous Locations**: `ZlfnGraph.tsx`, `LogicVisualizer.tsx`, `SemanticTableau.tsx`
- **Solution Implemented**: `useGlobalShortcuts` hook with context detection and pluggable bindings
- **Status**: LogicVisualizer migrated; ZlfnGraph refactored into modules

### ✅ **RESOLVED** - Local Storage Patterns
- **Previous Locations**: `LogicVisualizer.tsx`, `SemanticTableau.tsx`, `LibrarySidebar.tsx`, various components
- **Solution Implemented**: `services/storage.ts` with typed helpers and cross-tab synchronization
- **Status**: LibrarySidebar migrated; other components pending

### ✅ **RESOLVED** - Status/Legend Components
- **Previous Locations**: `SemanticTableau.tsx`, `VennDiagram.tsx`, `SymbolGuide.tsx`, `CompactTableauMenu.tsx`
- **Solution Implemented**: `StatusChip.tsx` and `Legend.tsx` components with multiple variants
- **Status**: All components migrated to use consolidated UI patterns

### ✅ **RESOLVED** - Large File Refactoring
- **Previous Issues**: `ZlfnGraph.tsx` (~4400 lines), `SemanticTableau.tsx` (~1800 lines)
- **Solution Implemented**: Modular architecture with focused responsibilities
- **ZlfnGraph Modules**: types, simulation, eventHandlers, rendering, utils
- **SemanticTableau Modules**: tableauLogic, treeRenderer, exportFunctions
- **Status**: Both large files successfully refactored into maintainable modules
- **Duplication**: Similar chip/badge rendering for status and legends
- **Solution**: `components/UI/StatusChip.tsx` and `components/UI/Legend.tsx`

### Dialog Management
- **Locations**: Enhanced dialogs, various modal components
- **Duplication**: Similar dialog state management patterns
- **Solution**: `useDialog` hook for consistent dialog orchestration

### Performance Monitoring
- **Locations**: Multiple components with FPS/memory tracking
- **Duplication**: Similar performance metric collection
- **Solution**: Already centralized in `usePerformanceMonitor` - ensure adoption

---

## Dependencies & Architecture

### External Dependencies
- **React**: Core framework with hooks
- **D3**: Visualization and data manipulation
- **MUI**: UI component library
- **TypeScript**: Type safety and development experience

### Internal Architecture Patterns
- **Context**: Shared state management
- **Hooks**: Reusable logic and side effects
- **Services**: Business logic and data operations
- **Components**: UI presentation and interaction
- **Layers**: D3 rendering abstraction

### Data Flow
1. **Context** provides global state
2. **Services** handle business logic and API calls
3. **Hooks** manage component-level state and effects
4. **Components** render UI and handle user interaction
5. **D3 Layers** handle low-level visualization rendering

---

*This CodeMap will be updated as refactoring progresses to maintain accurate feature-to-file mappings.*
