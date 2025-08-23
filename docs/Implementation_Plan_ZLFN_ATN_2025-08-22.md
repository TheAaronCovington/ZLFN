# ZLFN/ATN Implementation Plan (2025-08-22)

Status: Draft for review
Scope: Align app to revised ZLFN/ATN design; enable MongoDB persistence; add input form; enhance ATN UX; improve error handling and scalability.

## Assumptions and Repo Reality Check
- STN is fully removed; only ZLFN (graph) and ATN (argument tableau) remain.
- Current code already uses localStorage persistence for arguments; MongoDB backend exists but may not be fully wired.
- Server-side paths referenced by request include `backend/src/models/ZLFNObject.js` and `backend/src/routes/zlfn.js`.
- We will not touch unrelated modules; we’ll stage changes and keep tests green.

## High-Level Phases
1) Data Model + Normalizer updates
2) Persistence activation (MongoDB/Redis) + fallback
3) Input Form (MUI) for create/edit/import
4) ATN enhancements (UX/validation)
5) Tests and validation
6) Error handling and UX feedback
7) Scalability and performance

Each phase includes verification and safe commits.

---

## Phase 1 — Data Model + Normalizer
Goal: Extend node/core fields to support ATN and facets, and ensure import normalization sets defaults without breaking existing data.

Changes
- `src/types/zlfn.ts`
  - Extend `ZLFNNode` with optional `state: 'T'|'F'|'B'`, `weight: number`, and `facets` object (`vennRelevant`, `truthTableRelevant`, `timelineRelevant`, `counterRelevant`, `rebuttalRelevant`, `noteRelevant`).
  - Replace core `mode` with structured object `{ zlfMode?, atnMode?, zlfConfig?, atnConfig? }`.
- `src/services/argumentNormalizer.ts`
  - In `normalizeImportedJSON`, populate the new node fields with safe defaults.
  - Map `core.mode` into new shape with fallbacks, leaving existing fields backward-compatible.

Verification
- Typecheck and run unit tests.
- Import JSONs with/without new fields; confirm defaults set and no crashes.

---

## Phase 2 — Persistence Activation (MongoDB/Redis)
Goal: Enable MongoDB as primary storage with Redis locks/cache, while retaining file fallback when `NO_DB=true`.

Changes
- Server bootstrap (ensure): Express app connects to Mongo via `backend/src/config/database.js`; routes in `backend/src/routes/zlfn.js` expose CRUD for objects.
- `src/services/zlfnObjectManager.ts`
  - Keep the in-memory Map as a local cache and add fire-and-forget server sync (create, update, delete, updateMarkdown) guarded by `apiConfig.useRealBackend` (implemented).
  - On create/update, append to `versionHistory`, set `modified` timestamp; server sync mirrors updates when backend is enabled.
  - Optional file fallback when `NO_DB=true` can be added later if needed.
- `backend/src/models/ZLFNObject.js`
  - Ensure schema matches fields used by frontend (nodes, edges, notes, versionHistory, metadata).

Verification
- With Mongo running, create/update objects through the app; verify documents in DB.
- Toggle `NO_DB=true` and ensure JSON files emit to `./data`.

---

## Phase 3 — Input Form (MUI)
Goal: Provide a centralized UI to create/edit ZLFN objects, import JSON/Markdown, and preview ZLFN/ATN.

Changes
- `src/components/InputForm/ObjectForm.tsx` (new)
  - Tabs for General / Markdown / Arguments.
  - JSON and Markdown import handlers using existing services.
  - Live previews via `ZlfnGraph` and `ArgumentTableau` (lightweight props; no heavy recompute loops).
- `src/App.tsx`
  - Route `/create` to `ObjectForm`.

Verification
- Navigate to `/create`, import JSON/MD, submit, and confirm persistence.

---

## Phase 4 — ATN Enhancements
Goal: Improve ATN UX with tooltips, optional gradients, and scheme validation helpers.

Changes
- `src/components/Visualizations/ArgumentTableau/treeRenderer.ts`
  - Add link hover tooltips (non-blocking; guarded if library not present).
  - Click handlers surface edge data to parent.
- `src/components/Visualizations/ArgumentTableau/schemeCluster.ts`
  - Optional gradient backgrounds via `<defs>` linearGradient with safe IDs.
- `src/services/argumentNormalizer.ts`
  - Add helpers `detectAttack(node)` and `validateScheme(edge)`; exported, pure, and unit tested.

Verification
- Open ATN, hover links, confirm no console errors. Validate sample edges.

---

## Phase 5 — Tests and Validation
Goal: Keep coverage stable and ensure new flows behave reliably.

Changes
- `src/tests/services/batchOperations.test.ts`
  - Add Mongo scenario (guarded; skip if `NO_DB=true`).
- `src/tests/components/ObjectForm.test.tsx` (new)
  - Render form, fill fields, simulate submit with mocked manager;
  - Ensure error/success flows behave as expected.

Verification
- `npm test` green; CI passes.

---

## Phase 6 — Error Handling and UX Feedback
Goal: More actionable errors for API and UI.

Changes
- `src/services/zlfnAPI.ts` — enrich error messages and include hints for Mongo connectivity when applicable.
- `index.tsx` — wrap app in `ErrorBoundary` fallback.
- `ObjectForm.tsx` — Snackbar feedback on errors.

Verification
- Stop Mongo/Redis and confirm user-visible, useful errors without crashes.

---

## Phase 7 — Scalability & Performance
Goal: Handle 100–200+ nodes smoothly.

Changes
- Mongo indexes in `backend/src/models/ZLFNObject.js` for id and modified.
- Batch insert support in `zlfnObjectManager`.
- Optional Redis cache layer in `zlfnAPI.getObject` (TTL 1h).

Verification
- Import large arguments; measure load (<500ms server read with cache warm).

---

## Risks & Mitigations
- Schema drift between FE types and BE model: align `ZLFNObject` fields and add narrow adapters.
- Over-eager UI recomputation: memoize derived data and gate heavy work by active view.
- Tooling variability: guard optional libs (e.g., d3-tip) and feature-detect.

---

## Rollout & Backout
- Incremental commits; keep tests green.
- If persistence issues occur, flip `NO_DB=true` to use file fallback.

---

## Next Actions (upon approval)
1) Implement Phase 1 (types + normalizer), run tests.
2) Wire persistence (Phase 2), verify with DB.
3) Build ObjectForm and route (Phase 3).
4) ATN UX (Phase 4) behind safe guards.
5) Tests, error handling, performance steps.


