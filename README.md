# Xervean React Migration

## Routes
- `/` Home
- `/document/:filename` Document viewer (markdown)
- `/viz` Logic visualizer (Document + Expression + Graph/AST + extras)
- `/viz/zlfn`, `/viz/ast`, `/viz/venn`, `/viz/symbols` individual pages

## Expression syntax
Use formal symbols or ASCII:
- Negation: `¬` or `!` or `~`
- And: `∧` or `&`
- Or: `∨` or `|`
- Implies: `→` or `->` or `=>`
- Iff: `↔` or `<->` or `<=>`

Examples:
- `(A ∧ B) → C`
- `!(P | Q) & R`
- `X <-> (Y -> Z)`

You can embed an expression in docs using fenced code:
```expr
(A ∧ B) → C
```
This will sync the visualizer’s expression when the doc loads.

## Keyboard shortcuts (Graph)
- F: Fit to contents
- C: Center on selection
- P: Center on path (reachable nodes from selection)
- S: Save layout (persists per expression)
- G / A / B: Switch view to Graph / AST / Both
- Ctrl+F: Focus expression input

## Import/Export
- Export current `{ expression, ast, graph }` as JSON
- Import a JSON to set the expression

## Layout persistence
- Drag nodes to arrange; click “Save Layout” (or press S)
- Layout is saved per expression in localStorage

## Theming & Docs
- Dark neon theme with improved markdown readability (headings, code, tables)
- Logic highlighting for symbols/terms in markdown (skips code blocks)

## Dev
- Build: `npm run build`
- Test: `npm run test`
- Dev server: `npm run dev`
