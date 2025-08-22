### Unified Import Fix Plan

#### Goals
- Ensure imported JSON populates all three views (ZLFN, STN, ATN) via the unified shared model.
- Remove duplicate import entry points; keep a single global import in the Logic Visualizer.
- Preserve consistent selection and eliminate MUI select out-of-range errors.

#### Current architecture
- Shared context: `LogicSharedContext` provides:
  - `unifiedData.selectedArgumentId`
  - `getZlfnGraphFor(id)` → ZLFN
  - `getAstFor(id)` → STN
  - `getAtnDataFor(id)` → ATN
- Import flow: Logic Visualizer dispatches `xv:add-imported-json` → `addImportedJSONArguments()` → `normalizeImportedJSON()` → adds arguments to shared state.

#### Root causes
- STN: Imported arguments often have trivial `expressions`, yielding trivial ASTs. Tableau appears empty.
- ATN: `getAtnDataFor()` is a stub and doesn’t map ZLFN graph to ATN structures.
- UX: Multiple import entry points (global + per-view) cause confusion and potential wiring divergence.

#### Changes to implement
1) Unify import entry
- Keep only global import in Logic Visualizer.
- Remove/rename per-view imports (if kept, label as local view-state imports only).

2) Improve STN data synthesis
- In `normalizeImportedJSON()` (preferred) synthesize a primary formula from dependencies:
  - Identify premises (no incoming edges) and conclusions (type `conclusion` or high in-degree).
  - For support edges: `(P1 ∧ P2 ∧ …) → C`.
  - For attack/undercut: introduce negations appropriately.
- Set `argument.expressions = [synthesizedFormula]` and optionally cache `argument.ast`.
- Fallback (optional): In `getAstFor()`, if expression is trivial and graph exists, synthesize on the fly and cache.

3) Implement real ZLFN → ATN mapping
- Add `zlfnToAtn(graph, argumentId)` and call from `getAtnDataFor()`:
  - Node mapping:
    - `conclusion` → ATN `core` (claim)
    - `premise` → `ground`
    - `term` → `warrant`
    - `backing`/`informal` → `backing`/`qualifier`
    - `fallacy`/counter nodes → `rebuttal`
  - Edge mapping:
    - `implication` → support
    - `counterexample` → attack/undercut
    - Map `rule` → `scheme`, `weight` → confidence/strength.
  - Populate `components`, `relationships`, `layoutMode` default.
  - Cache result to `argument.atn`.

4) Guard selector value
- Keep validation in `ArgumentSelector`: if current selection not in options, use empty and auto-select first available argument.

5) QA and docs
- Import a multi-premise JSON with at least one attack; verify:
  - ZLFN renders nodes/edges.
  - STN shows meaningful tableau from synthesized formula.
  - ATN shows claim/grounds/warrants/relationships.
- Ensure only one unified import is present.
- Build and fix any HMR warnings (move non-component exports out of context file if needed).
- Update docs and JSON suggestions.

#### Sequencing
- Phase A: Synthesize STN formula in `normalizeImportedJSON()`; optional fallback in `getAstFor()`.
- Phase B: Implement `zlfnToAtn` in `getAtnDataFor()`.
- Phase C: Remove per-view unified imports; relabel any remaining as local view-state.
- Phase D: QA + documentation.


