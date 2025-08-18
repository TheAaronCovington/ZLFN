# Xervean React Migration

This project migrates the Angular app to React (Vite + TS).

## Keyboard shortcuts
- g/a/b: switch views (Graph/AST/Both)
- f: fit graph
- c: center on selected node
- p: center on path
- s: save layout
- m: toggle simulation mode
- r: reset states
- h: toggle path highlight
- x: freeze/unfreeze layout
- l: toggle edge labels
- k: focus node search
- /: focus rule filter
- e: clear edge selection
- Ctrl+Click node: pin/unpin

## Accessibility
- Labels and controls use clear focus states and ARIA titles; tooltips provide additional context.
- Keyboard shortcuts cover primary graph operations; dialogs support Esc to close.
- Selection ring highlights the focused node; edge selection dims distractors.

## Scripts
- npm run dev
- npm run build
- npm run test
