# Unified Shared Data Model + UX/UI & Functional Plan (Phased)

Last Updated: 2025-08-22

## Overview
This plan defines a shared data model used across both views (ZLFN, ATN), a unified argument selector present in the main toolbar, and a phased UX/UI + functionality roadmap. Switching views preserves the same active argument and data source (document, expression, or imported JSON). Each phase includes acceptance criteria and verification steps.

**Note**: Semantic Tableau Network (STN) removed as per revised design (December 22, 2024).

## Shared Data Model Design

### Data Shapes
```ts
// Canonical per-argument record
export type SharedArgument = {
  id: string
  title: string
  // Bundled markdown document
  markdown: { documentId: string; content: string }
  // Canonical expression(s) for the argument
  expressions: string[]
  // Lazy-derived representations (computed on demand)
  ast?: AstNodeRec
  zlfnGraph?: { nodes: ZlfnNode[]; edges: ZlfnEdge[] }
  atn?: ArgumentData
  // Optional cross-reference map (nodeId -> markdownRef)
  refs?: Record<string, string>
}

// Global model shared across all views
export type UnifiedData = {
  activeSource: 'document' | 'expression' | 'imported'
  arguments: SharedArgument[]
  selectedArgumentId: string | null
}
```

### Source Normalization
- Document → parse via `parseDocumentToGraph(documentId | content)`; produce `SharedArgument[]` with `markdown`, `expressions`, and lazy derivations.
- Expression → `parseExpressionToAst` → `astToZlfnGraph`; wrap as a `SharedArgument` entry.
- Imported JSON → convert into `SharedArgument[]` and hydrate lazily.

### Cross-View Synchronization
- One global dropdown (`ArgumentSelector`) in the main toolbar controls `selectedArgumentId` across ZLFN/ATN.
- View renderers read from the same `UnifiedData`:
  - ZLFN: `getZlfnGraphFor(selectedArgumentId)`
  - ATN: `getAtnDataFor(selectedArgumentId)`
- Persistence: `selectedArgumentId` and `activeSource` saved to localStorage; optional `?arg=<id>` URL param.

### JSON Import Normalization (ZLFN/ATN Compatibility)
To accept the generalized JSON structure and make it work across both views without schema drift, we apply a non-destructive normalization layer at import time (in the shared import pipeline before data reaches the views).

Field mappings and defaults:
- Dependencies (edges)
  - `sourceId` → `from`, `targetId` → `to`
  - `type: "support" | "attack"` →
    - ZLFN: `type: "implication" | "counterexample"`, `style: "solid" | "dashed"`
    - ATN: `relationshipType: "support" | "attack"` (passed through)
  - `rule`: title-case canonicalization (e.g., "modus ponens" → "Modus Ponens"); alias common names
  - `scheme`, `weight`, `priority`: passed through (validated bounds on `weight`)
- Nodes
  - `symbolic` → `symbol`; also set `label = name || symbol || id` for ZLFN text
  - `type: "generic"` → ZLFN `type: "term"` (valid ZLFN types remain unchanged if provided)
  - Root facet flags → consolidated object
    - `vennRelevant`, `timelineRelevant` → `facets.vennRelevant`, `facets.timelineRelevant`
    - Ensure `facets.truthTableRelevant` default `false`; preserve `counter/rebuttal` if present
  - Status
    - `status.closed` → `closed` (STN uses closed)
    - `decomposed` preserved (STN uses decomposed)
    - `closureIntent` preserved as a UI hint (no breakage if unused)
    - `status.attacked` → set ATN `attackedBy` if attacker known; preserve flag for styling otherwise
  - `markdownRef` passed through (ZLFN badges/tooltips supported)
- Zones
  - `range: { xMin, xMax }` → `xRange: [xMin, xMax]`
  - Add default `yRange` if absent (e.g., `[80, height-120]`) for ZLFN zone rendering
- Modes
  - Global `modes` includes booleans; map `propositional` → `classical`
  - `predicate`, `epistemic`, `deontic`, `temporal`, `informal`, `paraconsistent`, `fuzzy` passed through
- Core
  - `core.layoutMode`: map view intentions
    - ZLFN: `"network" → "force"`, `"hierarchical" → "hierarchical"`
    - ATN: `"tree" | "table"` passed through for layout selection
  - `core.mode: { zlfMode, stnMode, atnMode }` treated as an initial-view hint only; not required by renderers

Conflicts resolved with existing plan:
- This normalization concretizes the earlier "Source Normalization" note under Phase 0; it does not change internal types used by ZLFN/STN/ATN, only adapts imported JSON to them.
- `closureIntent` is preserved as an optional flag for STN logic; no conflict with current behavior.
- Title-casing rules and aliasing complements existing `validateRule` logic; no behavior is removed.

Acceptance Criteria
- Importing the generalized JSON produces a unified data set where:
  - The global argument dropdown lists the imported arguments.
  - ZLFN renders zoned graph with proper types, styles, and `markdownRef` indicators.
  - STN respects `decomposed`/`closed` flags and centers/zooms as specified.
  - ATN shows schemes and supports clustering; `relationshipType` is correct.

Verification Steps
1. Import a sample JSON using the generalized structure (with support/attack edges, zones with ranges, and facet/status fields).
2. Confirm the unified dropdown shows all arguments; pick one and switch between ZLFN/STN/ATN—the same argument remains active.
3. In ZLFN, verify zone positions (`xRange`), edge styles (support solid, attack dashed), and `markdownRef` badges.
4. In STN, verify `decomposed` nodes, `closed` highlighting, and stable center after auto expand/close.
5. In ATN, verify scheme clustering legend and that support/attack labeling is correct.

---

## Phase 0 — Shared Data Model & Unified Argument Selector

### Deliverables
- Extend `LogicSharedContext` with `unifiedData` and helpers:
  - `unifiedData: UnifiedData`
  - `setUnifiedData`, `setSelectedArgumentId`
  - `getAstFor(id)`, `getZlfnGraphFor(id)`, `getAtnDataFor(id)` (lazy, memoized)
- Normalization service to map document/expression/imported JSON → `SharedArgument[]`.
- Extract and generalize ATN’s argument selector into a reusable `ArgumentSelector` used by all views (in `CommandBar`).
- Wire each view to the shared model (remove per-view argument state).

### Acceptance Criteria
- Switching views preserves the same active argument and data source.
- The single dropdown controls the active argument across all views.
- Selecting a document populates the shared `arguments` list; dropdown reflects it.

### Verification Steps
1. Load a document → dropdown lists its arguments.
2. Select an argument → switch across ZLFN/STN/ATN; all show the same argument.
3. Toggle between document/expression sources; argument list updates accordingly.

---

## Phase 1 — Theme, Layout, and Toolbar Polish

### Deliverables
- Vibrant academic dark theme: refined palette, typography hierarchy, spacing, focus rings.
- Header improved; document dropdown remains removed.
- Toolbar declutter: remove duplicate magnifier; move performance/export/import/shortcuts to overflow; move collab/notes counters outside main window.
- Controls/Inspector on second-level menubar (not floating on canvas).
- Initial zoom/fit: auto-fit on load without overlap; consistent centering.
- Canvas area expanded (no overlap with toolbars) without altering graph geometry.

### Acceptance Criteria
- One-row primary toolbar + overflow; second-level menubar hosts Controls/Inspector.
- No clipped content, no icon overlap, no duplicate magnifier.
- Initial load centers and fits graph across datasets.

### Verification Steps
- Toggle menus; check at common breakpoints.
- Load small/medium graphs; validate auto-fit and center.
- Confirm counters sit outside main viewport and remain legible.

---

## Phase 2 — Document Viewer (On-Page Accordions, Academic Layout)

### Deliverables
- On-page accordions nesting only H1/H2/H3.
- Fix nested accordions rendering and syntax highlighting inside accordions.
- Expand content width to 70–90% responsive (with max width).
- Academic layout: readable headings, improved line-length, margins, linkable anchors.

### Acceptance Criteria
- H1/H2/H3 nesting works; code blocks highlight correctly inside accordions.
- Layout scales cleanly (desktop/tablet/mobile).

### Verification Steps
- Open multiple docs (e.g., TAG_Critique) and validate nesting, highlighting, width.
- Check anchors, copyable URLs, and smooth expand/collapse.

---

## Phase 3 — ZLFN Visual Clarity and Interaction

### Deliverables
- Node/edge polish: consistent sizes; higher-contrast labels; restrained glow.
- Zone styling: clear zone bands and readable labels.
- Minimap improvements: viewport frame clarity and click-to-center.
- Search: quick node jump, highlight, and keyboard navigation.
- Collision/stacking: tuned forces and spacing to avoid stacking.

### Acceptance Criteria
- No overlapping labels/icons; minimap recenter is reliable.
- Search jump/highlight consistent; keyboard nav predictable.

### Verification Steps
- Stress with dense demos; confirm spacing.
- Keyboard traverse nodes; verify highlight and viewport tracking.

---

## Phase 4 — STN Polish (Golden Path, Panel, Centering)

### Deliverables
- Golden path enhancement: thicker border, subtle glow/pulse.
- Stable tree centering for auto expand/auto close (no drift or freeze).
- Node-specific panel button docked top-left; D/X inside panel; remove duplicates.
- Correct z-index so panel isn’t obscured; tuned spacing and icon sizes.
- Canvas click deselects; X collapses subtree per spec.

### Acceptance Criteria
- Auto expand/close recenters correctly and preserves scale.
- Panel is per-node, D/X reliable, and no global leakage.

### Verification Steps
- Scripted flow: auto expand → auto close → manual D/X.
- Validate root golden state, path highlighting, and deselect on canvas.

---

## Phase 5 — ATN UI Refinements (Polish)

### Deliverables
- Facet dialogs (Venn, Truth, Timeline, Counter, Rebuttal) large and readable; visualization dominant.
- Scheme clustering visuals with clear legend; no occlusion.
- Strength/conflict overlays legible at multiple zoom levels.
- Keyboard Shortcuts dialog tidy, responsive, and categorized.

### Acceptance Criteria
- Dialogs prioritize visuals; legends don’t hide content.
- Shortcuts dialog lists categories cleanly without layout issues.

### Verification Steps
- Open each facet; check clarity, legend, scaling.
- Trigger conflicts; verify visual feedback.

---

## Phase 6 — Accessibility and Performance

### Deliverables
- WCAG AA contrast; aria-labels and tabIndex on icons; full keyboard traversal.
- Performance tuning for dense graphs; lazy-load non-critical UI.

### Acceptance Criteria
- Keyboard-only interaction usable end-to-end.
- Smooth FPS on medium graphs; no UI thread stalls.

### Verification Steps
- Keyboard walkthrough of major flows (dialogs, navigation, export).
- Profiling/trace on hot paths; confirm no regressions.

---

## Phase 7 — ZLFN Functional Addendum

### 7.1 Markdown → Graph Wiring (Document-driven ZLFN)
- Scope: Hook `parseDocumentToGraph` into `LogicVisualizer` on document selection (via `LibrarySidebar`); `useDocumentData` toggle selects document-driven vs AST-driven graphs; keep `markdownRef` indicators.
- Acceptance: Switching the toggle seamlessly swaps data source; reference indicators remain functional.
- Verification:
  1. Select doc → graph updates from parsed content.
  2. Toggle source off/on; verify switch.
  3. Hover/click reference indicators and confirm Inspector metadata.

### 7.2 Flow Rivers for Clustered Connections (Toggle)
- Scope: In `ZlfnGraph`, render bundled curved “rivers” by `edge.clusterKey` behind edges with `<linearGradient>`; add toolbar toggle and legend key.
- Acceptance: Rivers reduce clutter, don’t block interactions, scale on zoom; performant on medium graphs.
- Verification:
  1. Toggle on/off; verify rivers appear/disappear.
  2. Pan/zoom; gradients and labels scale without artifacts.

### 7.3 Bayesian Inference Mode (Optional)
- Scope: Add `bayesianMode` in context; extend `inference` with posterior computation (naïve independence assumption); map posterior to color/halo scale; toggle in Controls.
- Acceptance: Default deterministic behavior unchanged; enabling Bayesian updates styling and status instantly; reversible without reload.
- Verification:
  1. Toggle mode; confirm probability-driven styling.
  2. Interact in Simulation Mode; observe stable posterior updates.

---

## Phase 8 — QA, Cleanup, and Documentation

### Deliverables
- Remove debug logs; fix console warnings; ensure TypeScript clean.
- Re-check bundle analysis; prevent regressions.
- Update `docs/CodeMap.md` and this plan as features land.

### Acceptance Criteria
- Zero console errors; TypeScript and lints pass; bundles within targets.

### Verification Steps
- Build, lint, run scripted verifications per phase.

---

## Rollout & Flags
- All new features behind toggles: `useDocumentData`, `showRivers`, `bayesianMode`.
- No breaking changes to shortcuts, dialogs, or interactions.

## Risks & Mitigations
- Rivers on dense graphs → Toggle + render thresholds; cached paths.
- Document parsing errors → try/catch with user feedback; fallback to expression view.
- Bayesian assumptions → Mark as experimental and keep off by default.

---

## Quick Implementation Notes (Files)
- `src/context/LogicSharedContext.tsx` — unified model, selection, persistence.
- `src/components/Visualizer/ArgumentSelector.tsx` — new global selector.
- `src/components/Visualizer/CommandBar.tsx` — host global selector and toggles.
- `src/pages/LogicVisualizer.tsx` — document hook-in, routing of source/argument.
- `src/components/Visualizations/ZlfnGraph.tsx` — consume shared graph; flow rivers.
- `src/components/Visualizations/SemanticTableau.tsx` — consume shared AST.
- `src/components/Visualizations/ArgumentTableau/index.tsx` — consume shared ATN.
- `src/services/documentParser.ts`, `src/services/logic.ts`, `src/components/Visualizations/ArgumentTableau/types.ts` — normalization and conversions.
