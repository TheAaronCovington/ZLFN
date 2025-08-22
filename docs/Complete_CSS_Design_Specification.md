# Complete CSS Design Specification
## Vibrant Academic Dark Theme - ZLFN Visualizer

**Version**: 1.0  
**Date**: 2024-12-22  
**Purpose**: Complete CSS overhaul specification for vibrant academic dark theme

---

## 🎨 Color Palette & Variables

### Core Theme Variables
```css
:root {
  /* Background Layers */
  --ai-bg-primary: #0a0a0f;        /* Deep space black - main background */
  --ai-bg-secondary: #141420;      /* Dark navy - secondary surfaces */
  --ai-bg-elevated: #1e1e2f;       /* Charcoal blue - elevated surfaces */
  --ai-bg-surface: #252540;        /* Slate purple - interactive surfaces */

  /* Accent Colors */
  --ai-cyan: #00e5ff;              /* Primary actions, links, focus */
  --ai-blue: #2196f3;              /* Logic elements, premises */
  --ai-green: #00ff88;             /* Success, valid states, conclusions */
  --ai-orange: #ff9500;            /* Warnings, attention, temporal */
  --ai-red: #ff3366;               /* Errors, conflicts, fallacies */
  --ai-purple: #bb86fc;            /* Secondary actions, Bayesian mode */
  --ai-gold: #ffd700;              /* Highlights, terms, special states */
  --ai-pink: #ff4081;              /* Accents, Rivers mode */

  /* Text Colors */
  --ai-text-primary: rgba(255, 255, 255, 0.95);
  --ai-text-secondary: rgba(255, 255, 255, 0.75);
  --ai-text-tertiary: rgba(255, 255, 255, 0.55);
  --ai-text-disabled: rgba(255, 255, 255, 0.35);

  /* Glow Effects */
  --ai-glow-cyan: 0 0 8px rgba(0, 229, 255, 0.3);
  --ai-glow-blue: 0 0 8px rgba(33, 150, 243, 0.3);
  --ai-glow-green: 0 0 8px rgba(0, 255, 136, 0.3);
  --ai-glow-orange: 0 0 8px rgba(255, 149, 0, 0.3);
  --ai-glow-red: 0 0 8px rgba(255, 51, 102, 0.3);
  --ai-glow-purple: 0 0 8px rgba(187, 134, 252, 0.3);
  --ai-glow-gold: 0 0 8px rgba(255, 215, 0, 0.3);

  /* Border Colors */
  --ai-border-primary: rgba(0, 229, 255, 0.4);
  --ai-border-secondary: rgba(255, 255, 255, 0.15);
  --ai-border-subtle: rgba(255, 255, 255, 0.08);

  /* Typography Scale */
  --ai-font-size-xs: 0.75rem;
  --ai-font-size-sm: 0.875rem;
  --ai-font-size-base: 1rem;
  --ai-font-size-lg: 1.125rem;
  --ai-font-size-xl: 1.25rem;
  --ai-font-size-2xl: 1.5rem;
  --ai-font-size-3xl: 1.875rem;

  /* Spacing Scale */
  --ai-space-xs: 0.25rem;
  --ai-space-sm: 0.5rem;
  --ai-space-md: 1rem;
  --ai-space-lg: 1.5rem;
  --ai-space-xl: 2rem;
  --ai-space-2xl: 3rem;

  /* Focus Ring */
  --ai-focus-ring: 0 0 0 2px var(--ai-cyan);

  /* Animations */
  --ai-transition-fast: 0.15s ease-out;
  --ai-transition-normal: 0.3s ease-out;
  --ai-transition-slow: 0.5s ease-out;
}
```

---

## 📁 File Structure & CSS Organization

### Global Styles
- **`src/styles/globals.css`** - Reset, base HTML elements, scrollbars
- **`src/styles/theme.css`** - CSS variables (above)
- **`src/styles/muiTheme.ts`** - Material-UI theme configuration

### Component-Specific Styles
- **`src/components/Layout/Layout.css`** - Header, navigation, main layout
- **`src/components/DocumentViewer/DocumentViewer.css`** - Document viewer styling
- **`src/components/Visualizations/Visualizations.css`** - All visualization components
- **`src/components/UI/Components.css`** - Reusable UI components

---

## 🏗️ Component Styling Specifications

### 1. Global Base Styles (`src/styles/globals.css`)

```css
/* Reset and base styles */
* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  font-family: "Inter", "Roboto", "Helvetica", "Arial", sans-serif;
  line-height: 1.6;
  font-weight: 400;
  background-color: var(--ai-bg-primary);
  color: var(--ai-text-primary);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#root {
  min-height: 100vh;
  width: 100%;
  margin: 0;
  padding: 0;
  background-color: var(--ai-bg-primary);
}

/* Links */
a {
  color: var(--ai-cyan);
  text-decoration: none;
  transition: var(--ai-transition-fast);
}

a:hover {
  color: var(--ai-green);
  text-shadow: var(--ai-glow-green);
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
  color: var(--ai-text-primary);
  font-weight: 600;
  margin: 0 0 var(--ai-space-md) 0;
}

h1 { font-size: var(--ai-font-size-3xl); }
h2 { font-size: var(--ai-font-size-2xl); }
h3 { font-size: var(--ai-font-size-xl); }

/* Custom Scrollbars */
::-webkit-scrollbar { 
  width: 12px; 
  height: 12px; 
}

::-webkit-scrollbar-track { 
  background: var(--ai-bg-secondary); 
  border-radius: 6px; 
}

::-webkit-scrollbar-thumb {
  background: linear-gradient(45deg, var(--ai-cyan), var(--ai-green));
  border-radius: 6px; 
  border: 2px solid var(--ai-bg-secondary);
}

::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(45deg, var(--ai-green), var(--ai-cyan));
}
```

### 2. Layout Components (`src/components/Layout/Layout.css`)

```css
/* Main Layout */
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--ai-bg-primary);
}

/* Header */
.header {
  background: linear-gradient(135deg, 
    var(--ai-bg-secondary) 0%, 
    var(--ai-bg-elevated) 30%,
    var(--ai-bg-surface) 70%,
    var(--ai-bg-secondary) 100%
  );
  border-bottom: 2px solid transparent;
  background-image: 
    linear-gradient(135deg, var(--ai-bg-secondary), var(--ai-bg-secondary)),
    linear-gradient(90deg, var(--ai-cyan), var(--ai-green), var(--ai-pink), var(--ai-purple), var(--ai-cyan));
  background-origin: border-box;
  background-clip: padding-box, border-box;
  box-shadow: 
    0 4px 20px rgba(0, 0, 0, 0.4),
    var(--ai-glow-cyan),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  position: relative;
  overflow: hidden;
}

.header::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, 
    transparent, 
    rgba(0, 229, 255, 0.1), 
    rgba(0, 255, 136, 0.1),
    transparent
  );
  animation: headerSweep 8s infinite linear;
  z-index: 1;
}

@keyframes headerSweep {
  0% { left: -100%; }
  100% { left: 100%; }
}

/* Navigation */
.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--ai-space-lg) var(--ai-space-xl);
  position: relative;
  z-index: 2;
}

/* Logo */
.logo {
  text-decoration: none;
  position: relative;
  transition: var(--ai-transition-normal);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.logo-text {
  font-size: 2.2rem;
  font-weight: 800;
  color: var(--ai-cyan);
  text-shadow: 
    0 0 10px rgba(0, 229, 255, 0.5),
    0 0 20px rgba(0, 229, 255, 0.3),
    0 0 40px rgba(0, 229, 255, 0.1);
  background: linear-gradient(135deg, var(--ai-cyan), var(--ai-green));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 0.5px;
  line-height: 1;
  transition: var(--ai-transition-normal);
}

.logo-subtitle {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--ai-text-secondary);
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin-top: -2px;
  margin-left: 2px;
  transition: var(--ai-transition-normal);
}

.logo::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--ai-cyan), var(--ai-green));
  transition: var(--ai-transition-normal);
  border-radius: 1px;
}

.logo:hover {
  transform: translateY(-1px);
}

.logo:hover .logo-text {
  text-shadow: 
    0 0 15px rgba(0, 229, 255, 0.8),
    0 0 30px rgba(0, 229, 255, 0.4),
    0 0 60px rgba(0, 229, 255, 0.2);
}

.logo:hover .logo-subtitle {
  color: var(--ai-green);
  text-shadow: var(--ai-glow-green);
}

.logo:hover::after {
  width: 100%;
}

/* Navigation Links */
.nav-links {
  display: flex;
  align-items: center;
  gap: var(--ai-space-sm);
}

.nav-link {
  color: var(--ai-text-primary);
  text-decoration: none;
  font-weight: 600;
  padding: var(--ai-space-sm) var(--ai-space-md);
  border-radius: 8px;
  transition: var(--ai-transition-normal);
  position: relative;
  overflow: hidden;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  font-size: var(--ai-font-size-sm);
  letter-spacing: 0.3px;
  display: flex;
  align-items: center;
  gap: var(--ai-space-xs);
}

.nav-link::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, 
    transparent, 
    rgba(0, 229, 255, 0.2), 
    transparent
  );
  transition: var(--ai-transition-slow);
  z-index: -1;
}

.nav-link:hover {
  color: var(--ai-cyan);
  background: rgba(0, 229, 255, 0.1);
  border: 1px solid var(--ai-border-primary);
  box-shadow: var(--ai-glow-cyan);
  transform: translateY(-1px);
  text-shadow: var(--ai-glow-cyan);
}

.nav-link:hover::before {
  left: 100%;
}

/* Main Content */
.main-content {
  flex: 1;
  padding: var(--ai-space-sm);
  max-width: 100%;
  margin: 0;
  width: 100%;
  background-color: var(--ai-bg-primary);
}

/* Bottom Navigation */
.bottom-navigation {
  background-color: var(--ai-bg-elevated) !important;
  border-top: 1px solid var(--ai-border-subtle);
}

/* Library Sidebar */
.library-sidebar {
  background-color: var(--ai-bg-elevated);
  border: 1px solid var(--ai-border-primary);
  box-shadow: var(--ai-glow-cyan);
}

/* Dock Bar */
.dock-bar {
  background-color: var(--ai-bg-surface);
  border: 1px solid var(--ai-border-secondary);
}

/* Footer */
.footer {
  background-color: var(--ai-bg-elevated);
  border-top: 2px solid var(--ai-border-primary);
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.3), var(--ai-glow-cyan);
  padding: var(--ai-space-sm) var(--ai-space-lg);
  color: var(--ai-text-secondary);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer .footer-link {
  color: var(--ai-text-secondary);
  text-decoration: none;
}

.footer .footer-link:hover {
  color: var(--ai-cyan);
  text-shadow: var(--ai-glow-cyan);
}

/* Library Sidebar (detailed) */
.library-sidebar {
  width: 320px;
  max-width: 40vw;
  min-width: 240px;
  background: var(--ai-bg-elevated);
  border-right: 1px solid var(--ai-border-secondary);
  box-shadow: 6px 0 24px rgba(0,0,0,0.35);
  display: flex;
  flex-direction: column;
}

.library-header {
  padding: var(--ai-space-md) var(--ai-space-lg);
  border-bottom: 1px solid var(--ai-border-subtle);
  background: linear-gradient(135deg, var(--ai-bg-surface), var(--ai-bg-elevated));
}

.library-title {
  margin: 0 0 var(--ai-space-sm) 0;
  color: var(--ai-cyan);
  font-weight: 600;
  letter-spacing: 0.3px;
}

.library-search .MuiOutlinedInput-root {
  background: rgba(255,255,255,0.04);
}
.library-search .MuiOutlinedInput-notchedOutline { border-color: var(--ai-border-secondary); }
.library-search:hover .MuiOutlinedInput-notchedOutline { border-color: var(--ai-border-primary); }
.library-search.Mui-focused .MuiOutlinedInput-notchedOutline { border-color: var(--ai-cyan); box-shadow: var(--ai-glow-cyan); }

.library-content {
  flex: 1;
  overflow: auto;
  padding: var(--ai-space-md);
}

.library-section {
  margin-bottom: var(--ai-space-lg);
}

.library-section-title {
  color: var(--ai-text-secondary);
  font-weight: 700;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  margin: 0 0 var(--ai-space-sm) 0;
}

.library-item {
  display: flex;
  align-items: center;
  gap: var(--ai-space-sm);
  padding: 8px 10px;
  border-radius: 8px;
  color: var(--ai-text-primary);
  transition: var(--ai-transition-fast);
  border: 1px solid transparent;
}
.library-item:hover {
  background: rgba(0, 229, 255, 0.06);
  border-color: var(--ai-border-primary);
  box-shadow: var(--ai-glow-cyan);
}
.library-item.active {
  background: rgba(0, 229, 255, 0.12);
  border-color: var(--ai-cyan);
}
.library-item .icon { color: var(--ai-cyan); }
.library-item .label { flex: 1; }
.library-item .meta { color: var(--ai-text-tertiary); font-size: 0.75rem; }

.library-resizer {
  width: 4px;
  cursor: col-resize;
  background: transparent;
}
.library-resizer:hover { background: rgba(0, 229, 255, 0.2); }

.library-collapsed { width: 56px; min-width: 56px; }
.library-collapsed .label, .library-collapsed .meta, .library-collapsed .library-search { display: none; }

/* Dock Bar (detailed) */
.dock-bar {
  display: flex;
  gap: 6px;
  padding: 6px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--ai-bg-elevated), var(--ai-bg-surface));
}

.dock-section { display: flex; gap: 6px; align-items: center; }
.dock-divider { width: 1px; height: 24px; background: var(--ai-border-subtle); }

.dock-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--ai-border-secondary);
  color: var(--ai-text-secondary);
  background: transparent;
  transition: var(--ai-transition-fast);
}
.dock-button:hover {
  color: var(--ai-cyan);
  border-color: var(--ai-cyan);
  background: rgba(0, 229, 255, 0.1);
  box-shadow: var(--ai-glow-cyan);
}
.dock-button.active {
  color: var(--ai-bg-primary);
  background: var(--ai-cyan);
  border-color: var(--ai-cyan);
}
.dock-button.disabled { opacity: 0.45; pointer-events: none; }
.dock-badge { font-size: 10px; border-radius: 10px; padding: 0 6px; background: var(--ai-orange); color: #000; }

.dock-bar.bottom { position: sticky; bottom: 8px; justify-content: center; }
.dock-bar.right { flex-direction: column; position: sticky; right: 8px; top: 72px; }

@media (max-width: 1024px) {
  .library-sidebar { width: 280px; }
}

@media (max-width: 768px) {
  .library-sidebar { position: fixed; z-index: 1200; height: 100vh; left: 0; top: 0; }
  .dock-bar.right { position: fixed; right: 8px; top: 64px; }
}
```

### 3. Visualizations (`src/components/Visualizations/Visualizations.css`)

```css
/* ZLFN Graph Container */
.zlfn-graph-container {
  width: 100%;
  height: 100%;
  background-color: var(--ai-bg-primary);
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}

/* SVG Styling */
.zlfn-svg {
  background-color: var(--ai-bg-primary);
  border-radius: 12px;
}

/* Zone Styling */
.zone-premises {
  fill: rgba(33, 150, 243, 0.1);
  stroke: var(--ai-blue);
  stroke-width: 2;
  stroke-dasharray: 5,5;
}

.zone-conclusions {
  fill: rgba(0, 255, 136, 0.1);
  stroke: var(--ai-green);
  stroke-width: 2;
  stroke-dasharray: 5,5;
}

.zone-terms {
  fill: rgba(255, 215, 0, 0.1);
  stroke: var(--ai-gold);
  stroke-width: 2;
  stroke-dasharray: 5,5;
}

.zone-informal {
  fill: rgba(187, 134, 252, 0.1);
  stroke: var(--ai-purple);
  stroke-width: 2;
  stroke-dasharray: 5,5;
}

.zone-temporal {
  fill: rgba(255, 149, 0, 0.1);
  stroke: var(--ai-orange);
  stroke-width: 2;
  stroke-dasharray: 5,5;
}

.zone-fallacies {
  fill: rgba(255, 51, 102, 0.1);
  stroke: var(--ai-red);
  stroke-width: 2;
  stroke-dasharray: 5,5;
}

/* Zone Labels */
.zone-label {
  fill: var(--ai-text-primary);
  font-size: 14px;
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: middle;
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
}

/* Node Styling */
.node-premise {
  fill: var(--ai-blue);
  stroke: var(--ai-cyan);
  stroke-width: 2;
  filter: drop-shadow(0 0 6px rgba(33, 150, 243, 0.4));
}

.node-conclusion {
  fill: var(--ai-green);
  stroke: var(--ai-cyan);
  stroke-width: 2;
  filter: drop-shadow(0 0 6px rgba(0, 255, 136, 0.4));
}

.node-term {
  fill: var(--ai-gold);
  stroke: var(--ai-orange);
  stroke-width: 2;
  filter: drop-shadow(0 0 6px rgba(255, 215, 0, 0.4));
}

.node-fallacy {
  fill: var(--ai-red);
  stroke: var(--ai-pink);
  stroke-width: 2;
  filter: drop-shadow(0 0 6px rgba(255, 51, 102, 0.4));
}

.node-core {
  fill: var(--ai-purple);
  stroke: var(--ai-cyan);
  stroke-width: 3;
  filter: drop-shadow(0 0 8px rgba(187, 134, 252, 0.5));
}

/* Node Text */
.node-text {
  fill: var(--ai-text-primary);
  font-size: 12px;
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: middle;
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
  pointer-events: none;
}

/* Node Hover States */
.node:hover {
  transform: scale(1.05);
  transition: var(--ai-transition-fast);
}

.node-premise:hover {
  filter: drop-shadow(0 0 12px rgba(33, 150, 243, 0.8));
}

.node-conclusion:hover {
  filter: drop-shadow(0 0 12px rgba(0, 255, 136, 0.8));
}

.node-term:hover {
  filter: drop-shadow(0 0 12px rgba(255, 215, 0, 0.8));
}

/* Edge Styling */
.edge-implication {
  stroke: var(--ai-cyan);
  stroke-width: 2;
  marker-end: url(#arrowhead-cyan);
}

.edge-counterexample {
  stroke: var(--ai-red);
  stroke-width: 2;
  stroke-dasharray: 8,4;
  marker-end: url(#arrowhead-red);
}

.edge-bidirectional {
  stroke: var(--ai-green);
  stroke-width: 2;
  marker-start: url(#arrowhead-green);
  marker-end: url(#arrowhead-green);
}

/* Edge Labels */
.edge-label {
  fill: var(--ai-text-secondary);
  font-size: 10px;
  font-weight: 500;
  text-anchor: middle;
  dominant-baseline: middle;
  background: var(--ai-bg-elevated);
  padding: 2px 4px;
  border-radius: 4px;
}

/* Facet Icons */
.facet-icon {
  cursor: pointer;
  transition: var(--ai-transition-fast);
}

.facet-icon:hover {
  transform: scale(1.2);
}

.facet-venn {
  fill: var(--ai-cyan);
  stroke: var(--ai-blue);
}

.facet-truth-table {
  fill: var(--ai-green);
  stroke: var(--ai-cyan);
}

.facet-timeline {
  fill: var(--ai-orange);
  stroke: var(--ai-gold);
}

.facet-counterarguments {
  fill: var(--ai-red);
  stroke: var(--ai-pink);
}

/* Flow Rivers */
.flow-rivers .river {
  stroke: var(--ai-pink);
  stroke-width: 3;
  fill: none;
  opacity: 0.7;
  filter: drop-shadow(0 0 4px rgba(255, 64, 129, 0.5));
}

/* Minimap */
.minimap {
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: 200px;
  height: 150px;
  background-color: var(--ai-bg-elevated);
  border: 2px solid var(--ai-border-primary);
  border-radius: 8px;
  box-shadow: var(--ai-glow-cyan);
}

.minimap-viewport {
  fill: none;
  stroke: var(--ai-cyan);
  stroke-width: 2;
  stroke-dasharray: 4,2;
}

/* Toolbar */
.zlfn-toolbar {
  display: flex;
  gap: var(--ai-space-sm);
  padding: var(--ai-space-sm);
  background-color: var(--ai-bg-elevated);
  border-radius: 8px;
  margin-bottom: var(--ai-space-sm);
}

.toolbar-button {
  padding: var(--ai-space-xs) var(--ai-space-sm);
  border: 1px solid var(--ai-border-secondary);
  border-radius: 6px;
  background-color: var(--ai-bg-surface);
  color: var(--ai-text-primary);
  font-size: var(--ai-font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: var(--ai-transition-fast);
}

.toolbar-button:hover {
  border-color: var(--ai-cyan);
  background-color: rgba(0, 229, 255, 0.1);
  box-shadow: var(--ai-glow-cyan);
}

.toolbar-button.active {
  background-color: var(--ai-cyan);
  color: var(--ai-bg-primary);
  border-color: var(--ai-cyan);
}

/* Rivers Button */
.rivers-button.active {
  background-color: var(--ai-pink);
  border-color: var(--ai-pink);
}

/* Bayesian Button */
.bayesian-button.active {
  background-color: var(--ai-purple);
  border-color: var(--ai-purple);
}

/* Semantic Tableau */
.semantic-tableau {
  background-color: var(--ai-bg-primary);
  color: var(--ai-text-primary);
}

.tableau-node {
  fill: var(--ai-bg-elevated);
  stroke: var(--ai-border-primary);
  stroke-width: 2;
}

.tableau-node.closed {
  fill: var(--ai-red);
  stroke: var(--ai-red);
}

.tableau-node.open {
  fill: var(--ai-green);
  stroke: var(--ai-green);
}

.tableau-text {
  fill: var(--ai-text-primary);
  font-size: 11px;
  font-weight: 500;
  text-anchor: middle;
}

/* Golden Path Highlighting */
.golden-path {
  stroke: var(--ai-gold);
  stroke-width: 4;
  filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.6));
}

/* Argument Tableau */
.argument-tableau {
  background-color: var(--ai-bg-primary);
}

.atn-node {
  fill: var(--ai-bg-elevated);
  stroke: var(--ai-border-primary);
  stroke-width: 2;
}

.atn-node.strong {
  stroke: var(--ai-green);
  stroke-width: 3;
}

.atn-node.weak {
  stroke: var(--ai-orange);
  stroke-width: 2;
}

.atn-node.conflict {
  stroke: var(--ai-red);
  stroke-width: 3;
  stroke-dasharray: 4,2;
}
```
### 3a. Semantic Tableau (STN) – Detailed Class Mapping

```css
/* Container and SVG */
.stn-container { background: var(--ai-bg-primary); }
.stn-svg { background: var(--ai-bg-primary); }

/* Links (rule-aware) */
.stn-link { stroke: rgba(255,255,255,0.35); stroke-width: 1.8; fill: none; }
.stn-link.alpha { stroke: var(--ai-blue); stroke-width: 2.2; }
.stn-link.beta { stroke: var(--ai-orange); stroke-dasharray: 6 4; }
.stn-link.implication { stroke: var(--ai-purple); stroke-dasharray: 10 3; }
.stn-link.double-negation { stroke: var(--ai-green); stroke-dasharray: 3 3; }
.stn-link.quantifier { stroke: #673ab7; stroke-dasharray: 8 2 2 2; }
.stn-link.biconditional { stroke: var(--ai-pink); }
.stn-link.golden-path { stroke: var(--ai-gold); stroke-width: 3; }

/* Nodes */
.stn-node { cursor: pointer; }
.stn-node.root .shape { fill: url(#nodeGradient); stroke: rgba(255,255,255,0.5); stroke-width: 2; }
.stn-node.open .shape { fill: rgba(76,175,80,0.35); stroke: rgba(255,255,255,0.45); }
.stn-node.closed .shape { fill: url(#closedGradient); stroke: var(--ai-red); }
.stn-node.selected .shape { stroke: #ffc107; stroke-width: 3; filter: url(#glow); }
.stn-node.in-path .shape { fill: rgba(255,193,7,0.3); stroke: rgba(255,193,7,0.7); stroke-width: 2; filter: url(#glow); }

/* Labels */
.stn-label { fill: rgba(255,255,255,0.85); font-size: 12px; font-weight: 600; text-anchor: middle; }
.stn-type { fill: rgba(255,255,255,0.45); font-size: 9px; text-anchor: middle; }
.stn-strength { fill: var(--ai-text-secondary); font-size: 10px; text-anchor: middle; }

/* Rule badges */
.stn-rule-badge { fill: var(--ai-bg-elevated); stroke: rgba(255,255,255,0.8); stroke-width: 1; }
.stn-rule-badge.alpha { fill: var(--ai-blue); }
.stn-rule-badge.beta { fill: var(--ai-orange); }
.stn-rule-badge.implication { fill: var(--ai-purple); }
.stn-rule-badge.biconditional { fill: var(--ai-pink); }
.stn-rule-badge.double-negation { fill: var(--ai-green); }
.stn-rule-badge.quantifier { fill: #673ab7; }
.stn-rule-badge text { fill: #fff; font-weight: 700; font-size: 10px; }

/* Node menu */
.stn-node-menu-trigger circle { fill: #40c4ff; stroke: #2aa4f4; }
.stn-node-menu-panel { display: none; }
.stn-node-menu-panel.visible { display: inline; }
.stn-node-menu-panel rect { fill: rgba(25,25,35,0.95); stroke: rgba(64,196,255,0.4); }
.stn-node-menu-panel .btn-decompose rect { fill: rgba(64,196,255,0.18); stroke: #40c4ff; }
.stn-node-menu-panel .btn-decompose text { fill: #40c4ff; }
.stn-node-menu-panel .btn-close rect { fill: rgba(255,82,82,0.18); stroke: #ff5252; }
.stn-node-menu-panel .btn-close text { fill: #ff8a80; }
```

Note: the current STN renderer sets most styles inline. During Phase 3 we will map these runtime styles to the classes above and add a wrapper class `stn-container` on the root.

### 3b. Argument Tableau Network (ATN) – Detailed Class Mapping

```css
/* Containers */
.atn-container { background: var(--ai-bg-primary); }
.atn-svg { background: var(--ai-bg-primary); }

/* Tree layout */
.tree-link { stroke: rgba(64,196,255,0.6); stroke-width: 2; fill: none; marker-end: url(#support-arrow); }
.tree-node .node-shape { stroke-width: 2; filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.3)); }
.tree-node .node-label { fill: #fff; font-size: 12px; font-weight: 600; }
.tree-node .strength-indicator { fill: var(--ai-text-secondary); font-size: 10px; }

/* Force-directed hierarchical layout */
.hierarchical-link.support { stroke: var(--ai-green); }
.hierarchical-link.attack { stroke: var(--ai-red); }
.hierarchical-link.undercut { stroke: var(--ai-orange); }
.hierarchical-link { stroke-width: 2; }
.hierarchical-node .node-shape { stroke-width: 2; filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.3)); }
.hierarchical-node .node-label { fill: #fff; font-size: 12px; font-weight: 600; }

/* Non-hierarchical edges (attacks/undercuts) */
.non-hierarchical-edge.attack { stroke: var(--ai-red); stroke-dasharray: 6 3; }
.non-hierarchical-edge.undercut { stroke: var(--ai-orange); stroke-dasharray: 4 2; }
.non-hierarchical-edge { fill: none; stroke-width: 2; }

/* Facets */
.atn-facet-icons { opacity: 0.95; }

/* Table layout */
.atn-table { width: 100%; background: var(--ai-bg-primary); color: var(--ai-text-primary); }
.atn-header-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr; gap: 1px; background: rgba(64,196,255,0.3); padding: 12px; position: sticky; top: 0; z-index: 10; border-bottom: 2px solid rgba(64,196,255,0.5); }
.atn-header-cell { background: var(--ai-bg-secondary); border-radius: 4px; font-weight: 600; text-align: center; padding: 8px; }
.atn-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr; gap: 1px; padding: 12px; border-bottom: 1px solid rgba(64,196,255,0.2); transition: background-color var(--ai-transition-fast); }
.atn-row:nth-child(odd) { background: var(--ai-bg-primary); }
.atn-row:nth-child(even) { background: rgba(64,196,255,0.05); }
.atn-row:hover { background: rgba(64,196,255,0.1); }
.atn-cell { padding: 8px; }
.atn-badge { display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; color: #fff; }
.atn-badge.type { text-transform: uppercase; }
.atn-badge.support { background: #4CAF50; }
.atn-badge.attack { background: #F44336; }
.atn-badge.undercut { background: #FF9800; }
.atn-scheme { display: inline-block; background: rgba(64,196,255,0.2); color: #40c4ff; padding: 2px 6px; border-radius: 8px; font-size: 10px; margin: 2px; }
.atn-summary { margin-top: 20px; padding: 16px; background: var(--ai-bg-secondary); border: 1px solid rgba(64,196,255,0.3); border-radius: 8px; }
.atn-summary h3 { margin: 0 0 12px 0; color: #40c4ff; font-size: 16px; }
.atn-summary-stat { display: flex; justify-content: space-between; margin: 4px 0; font-size: 12px; }
```

Mapping note: current ATN renderers use classes such as `tree-link`, `tree-node`, `hierarchical-link`, `hierarchical-node`, `non-hierarchical-edge`, `node-shape`, `node-label`. During Phase 3 we'll remove inline styles and rely on the classes above.

### 3c. VIS Engine Layers – Cross‑Graph Class Coverage

```css
/* Shared layer groupings */
.nodes .node { cursor: pointer; }
.nodes .node-label { fill: var(--ai-text-primary); font-size: 12px; font-weight: 600; pointer-events: none; text-anchor: middle; }
.links .link { stroke: var(--ai-cyan); stroke-width: 2; fill: none; }
.links .rivers .river { stroke: var(--ai-pink); stroke-width: 3; fill: none; opacity: 0.7; filter: drop-shadow(0 0 4px rgba(255, 64, 129, 0.5)); }
.zones .zone { fill-opacity: 0.1; stroke-width: 2; stroke-dasharray: 5 5; }
.zones .zone-label { fill: var(--ai-text-primary); font-weight: 600; text-anchor: middle; }
.facet-icons { opacity: 0.95; }
.facet-overlay { background: rgba(10,10,15,0.9); border: 1px solid var(--ai-border-primary); border-radius: 8px; }
.link-labels .label-bg { fill: var(--ai-bg-elevated); stroke: var(--ai-border-secondary); }
.link-labels .label-text { fill: var(--ai-text-secondary); font-size: 10px; font-weight: 500; }
```

### 4. Document Viewer (`src/components/DocumentViewer/DocumentViewer.css`)

```css
.document-viewer {
  max-width: 90%;
  margin: 0 auto;
  padding: var(--ai-space-xl);
  background-color: var(--ai-bg-primary);
  color: var(--ai-text-primary);
  line-height: 1.7;
}

.document-header {
  text-align: center;
  margin-bottom: var(--ai-space-2xl);
  padding-bottom: var(--ai-space-lg);
  border-bottom: 2px solid var(--ai-border-primary);
}

.document-title {
  font-size: var(--ai-font-size-3xl);
  font-weight: 700;
  color: var(--ai-cyan);
  text-shadow: var(--ai-glow-cyan);
  margin-bottom: var(--ai-space-md);
}

.document-subtitle {
  font-size: var(--ai-font-size-lg);
  color: var(--ai-text-secondary);
  font-weight: 400;
}

/* Accordion Styling */
.accordion {
  margin: var(--ai-space-lg) 0;
  border: 1px solid var(--ai-border-secondary);
  border-radius: 8px;
  background-color: var(--ai-bg-elevated);
  overflow: hidden;
}

.accordion-header {
  padding: var(--ai-space-md) var(--ai-space-lg);
  background: linear-gradient(135deg, var(--ai-bg-surface), var(--ai-bg-elevated));
  border-bottom: 1px solid var(--ai-border-subtle);
  cursor: pointer;
  transition: var(--ai-transition-fast);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.accordion-header:hover {
  background: linear-gradient(135deg, var(--ai-bg-elevated), var(--ai-bg-surface));
  box-shadow: inset 0 0 10px rgba(0, 229, 255, 0.1);
}

.accordion-title {
  font-size: var(--ai-font-size-lg);
  font-weight: 600;
  color: var(--ai-text-primary);
  margin: 0;
}

.accordion-icon {
  color: var(--ai-cyan);
  transition: var(--ai-transition-fast);
}

.accordion.expanded .accordion-icon {
  transform: rotate(180deg);
}

.accordion-content {
  padding: var(--ai-space-lg);
  background-color: var(--ai-bg-elevated);
}

/* Nested Accordions */
.accordion.level-1 {
  margin-left: 0;
}

.accordion.level-2 {
  margin-left: var(--ai-space-lg);
  border-left: 3px solid var(--ai-cyan);
}

.accordion.level-3 {
  margin-left: var(--ai-space-xl);
  border-left: 3px solid var(--ai-green);
}

/* Markdown Content */
.markdown-content h1,
.markdown-content h2,
.markdown-content h3 {
  color: var(--ai-cyan);
  text-shadow: var(--ai-glow-cyan);
}

.markdown-content h4,
.markdown-content h5,
.markdown-content h6 {
  color: var(--ai-green);
}

.markdown-content p {
  margin: var(--ai-space-md) 0;
  color: var(--ai-text-primary);
}

.markdown-content code {
  background-color: var(--ai-bg-surface);
  color: var(--ai-cyan);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.markdown-content pre {
  background-color: var(--ai-bg-surface);
  border: 1px solid var(--ai-border-secondary);
  border-radius: 8px;
  padding: var(--ai-space-md);
  overflow-x: auto;
  margin: var(--ai-space-md) 0;
}

.markdown-content pre code {
  background: none;
  padding: 0;
}

.markdown-content blockquote {
  border-left: 4px solid var(--ai-cyan);
  padding-left: var(--ai-space-md);
  margin: var(--ai-space-md) 0;
  color: var(--ai-text-secondary);
  font-style: italic;
}

.markdown-content ul,
.markdown-content ol {
  padding-left: var(--ai-space-lg);
  margin: var(--ai-space-md) 0;
}

.markdown-content li {
  margin: var(--ai-space-xs) 0;
  color: var(--ai-text-primary);
}

/* Logic Expressions */
.logic-expression {
  background-color: var(--ai-bg-surface);
  border: 2px solid var(--ai-cyan);
  border-radius: 8px;
  padding: var(--ai-space-md);
  margin: var(--ai-space-md) 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: var(--ai-font-size-lg);
  color: var(--ai-cyan);
  text-align: center;
  box-shadow: var(--ai-glow-cyan);
}

/* Argument Selector */
.argument-selector {
  margin: var(--ai-space-lg) 0;
  padding: var(--ai-space-md);
  background-color: var(--ai-bg-elevated);
  border: 1px solid var(--ai-border-primary);
  border-radius: 8px;
  box-shadow: var(--ai-glow-cyan);
}
```

### 5. UI Components (`src/components/UI/Components.css`)

```css
/* Command Bar */
.command-bar {
  background: linear-gradient(135deg, var(--ai-bg-elevated), var(--ai-bg-surface));
  border-bottom: 2px solid var(--ai-border-primary);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3), var(--ai-glow-cyan);
  backdrop-filter: blur(10px);
}

.command-bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ai-space-sm) var(--ai-space-lg);
  gap: var(--ai-space-md);
}

/* Search */
.search-container {
  flex: 1;
  max-width: 300px;
}

.search-input {
  background-color: var(--ai-bg-surface) !important;
  border-radius: 8px !important;
}

.search-input .MuiOutlinedInput-root {
  color: var(--ai-text-primary);
}

.search-input .MuiOutlinedInput-notchedOutline {
  border-color: var(--ai-border-secondary);
}

.search-input:hover .MuiOutlinedInput-notchedOutline {
  border-color: var(--ai-border-primary);
}

.search-input.Mui-focused .MuiOutlinedInput-notchedOutline {
  border-color: var(--ai-cyan);
  box-shadow: var(--ai-glow-cyan);
}

/* View Selector */
.view-selector {
  min-width: 140px;
}

.view-selector .MuiSelect-select {
  color: var(--ai-text-primary);
}

.view-selector .MuiOutlinedInput-notchedOutline {
  border-color: var(--ai-border-secondary);
}

.view-selector:hover .MuiOutlinedInput-notchedOutline {
  border-color: var(--ai-border-primary);
}

.view-selector.Mui-focused .MuiOutlinedInput-notchedOutline {
  border-color: var(--ai-cyan);
  box-shadow: var(--ai-glow-cyan);
}

/* Action Buttons */
.action-button {
  min-width: 40px;
  height: 40px;
  border-radius: 8px;
  transition: var(--ai-transition-fast);
}

.action-button.primary {
  background-color: var(--ai-cyan);
  color: var(--ai-bg-primary);
  border: 1px solid var(--ai-cyan);
}

.action-button.primary:hover {
  background-color: var(--ai-green);
  border-color: var(--ai-green);
  box-shadow: var(--ai-glow-green);
  transform: translateY(-1px);
}

.action-button.secondary {
  background-color: transparent;
  color: var(--ai-text-secondary);
  border: 1px solid var(--ai-border-secondary);
}

.action-button.secondary:hover {
  color: var(--ai-cyan);
  border-color: var(--ai-cyan);
  background-color: rgba(0, 229, 255, 0.1);
  box-shadow: var(--ai-glow-cyan);
}

/* Rivers Button */
.rivers-button {
  background-color: transparent;
  color: var(--ai-text-secondary);
  border: 1px solid var(--ai-border-secondary);
}

.rivers-button:hover {
  color: var(--ai-pink);
  border-color: var(--ai-pink);
  background-color: rgba(255, 64, 129, 0.1);
}

.rivers-button.active {
  background-color: var(--ai-pink);
  color: var(--ai-bg-primary);
  border-color: var(--ai-pink);
  box-shadow: 0 0 8px rgba(255, 64, 129, 0.4);
}

/* Bayesian Button */
.bayesian-button {
  background-color: transparent;
  color: var(--ai-text-secondary);
  border: 1px solid var(--ai-border-secondary);
}

.bayesian-button:hover {
  color: var(--ai-purple);
  border-color: var(--ai-purple);
  background-color: rgba(187, 134, 252, 0.1);
}

.bayesian-button.active {
  background-color: var(--ai-purple);
  color: var(--ai-bg-primary);
  border-color: var(--ai-purple);
  box-shadow: 0 0 8px rgba(187, 134, 252, 0.4);
}

/* Dialogs */
.enhanced-dialog {
  background-color: var(--ai-bg-elevated);
  border: 2px solid var(--ai-border-primary);
  border-radius: 12px;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.4),
    var(--ai-glow-cyan);
  backdrop-filter: blur(20px);
}

.dialog-header {
  padding: var(--ai-space-lg);
  border-bottom: 1px solid var(--ai-border-secondary);
  background: linear-gradient(135deg, var(--ai-bg-surface), var(--ai-bg-elevated));
}

.dialog-title {
  color: var(--ai-cyan);
  font-size: var(--ai-font-size-xl);
  font-weight: 600;
  text-shadow: var(--ai-glow-cyan);
}

.dialog-content {
  padding: var(--ai-space-lg);
  background-color: var(--ai-bg-elevated);
}

.dialog-actions {
  padding: var(--ai-space-md) var(--ai-space-lg);
  border-top: 1px solid var(--ai-border-secondary);
  background-color: var(--ai-bg-surface);
  display: flex;
  justify-content: flex-end;
  gap: var(--ai-space-sm);
}

/* Drawers (Controls & Inspector) */
.drawer-panel {
  background-color: var(--ai-bg-elevated);
  border-left: 1px solid var(--ai-border-secondary);
  box-shadow: -4px 0 20px rgba(0,0,0,0.3);
}

.drawer-header {
  padding: var(--ai-space-md);
  border-bottom: 1px solid var(--ai-border-subtle);
  background: linear-gradient(135deg, var(--ai-bg-surface), var(--ai-bg-elevated));
  color: var(--ai-text-primary);
}

.drawer-content {
  padding: var(--ai-space-md);
}

/* Status Bar */
.status-bar {
  padding: var(--ai-space-sm);
  border-top: 1px solid var(--ai-border-subtle);
  background-color: var(--ai-bg-secondary);
  color: var(--ai-text-secondary);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

/* File Upload */
.upload-zone { 
  padding: var(--ai-space-xl); 
  border: 2px dashed var(--ai-border-secondary); 
  border-radius: 12px; 
  background: rgba(255,255,255,0.05); 
  text-align: center; 
  transition: var(--ai-transition-normal);
}
.upload-zone.dragover { 
  border-color: var(--ai-cyan); 
  background: rgba(0,229,255,0.1); 
  box-shadow: var(--ai-glow-cyan);
}
.upload-accepted-chip { background: rgba(0,229,255,0.2); color: var(--ai-cyan); }
.upload-list { background: rgba(255,255,255,0.05); border-radius: 8px; }
.upload-item { border-bottom: 1px solid var(--ai-border-subtle); }
.upload-file-name { color: var(--ai-text-primary); }
.upload-file-meta { color: var(--ai-text-tertiary); }
.upload-progress { margin-top: var(--ai-space-sm); }

/* Notes */
.notes-dialog { background: var(--ai-bg-elevated); border: 1px solid var(--ai-border-primary); box-shadow: var(--ai-glow-cyan); }
.notes-dialog-header { color: var(--ai-cyan); }
.notes-tooltip { background: rgba(10,10,15,0.95); border: 1px solid var(--ai-border-primary); color: var(--ai-text-primary); box-shadow: var(--ai-glow-cyan); }

/* Markdown Reference */
.mdref-indicator { color: var(--ai-cyan); cursor: pointer; }
.mdref-indicator.active { color: var(--ai-green); text-shadow: var(--ai-glow-green); }
.mdref-selector { background: var(--ai-bg-elevated); border: 1px solid var(--ai-border-secondary); border-radius: 8px; }

/* Mobile Toolbar */
.mobile-toolbar { 
  position: sticky; top: 0; z-index: 1000; 
  background: var(--ai-bg-elevated); 
  border-bottom: 1px solid var(--ai-border-subtle); 
  backdrop-filter: blur(8px);
}
.mobile-toolbar .action { color: var(--ai-text-secondary); }
.mobile-toolbar .action:hover { color: var(--ai-cyan); background: rgba(0,229,255,0.1); }

/* Export Dialog */
.export-dialog { background: var(--ai-bg-elevated); border: 1px solid var(--ai-border-primary); box-shadow: var(--ai-glow-cyan); }
.export-section { border-top: 1px solid var(--ai-border-subtle); padding-top: var(--ai-space-md); margin-top: var(--ai-space-md); }
.export-option { border: 1px solid var(--ai-border-secondary); border-radius: 8px; padding: var(--ai-space-sm); transition: var(--ai-transition-fast); }
.export-option:hover { border-color: var(--ai-cyan); box-shadow: var(--ai-glow-cyan); }

/* Legend */
.legend { display: flex; gap: 8px; flex-wrap: wrap; }
.legend-item { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 8px; background: var(--ai-bg-surface); border: 1px solid var(--ai-border-subtle); }
.legend-color { width: 12px; height: 12px; border-radius: 50%; }
.legend-label { color: var(--ai-text-primary); font-size: 12px; }

/* Version Control (cards/timeline skins) */
.version-card { background: rgba(255,255,255,0.05); border: 1px solid var(--ai-border-primary); }
.version-card.latest { background: rgba(0,229,255,0.1); }
.version-badge { font-size: 10px; }

/* Status Chips */
.status-chip {
  border-radius: 6px;
  font-weight: 500;
  font-size: var(--ai-font-size-xs);
}

.status-chip.success {
  background-color: rgba(0, 255, 136, 0.2);
  color: var(--ai-green);
  border: 1px solid var(--ai-green);
}

.status-chip.warning {
  background-color: rgba(255, 149, 0, 0.2);
  color: var(--ai-orange);
  border: 1px solid var(--ai-orange);
}

.status-chip.error {
  background-color: rgba(255, 51, 102, 0.2);
  color: var(--ai-red);
  border: 1px solid var(--ai-red);
}

.status-chip.info {
  background-color: rgba(0, 229, 255, 0.2);
  color: var(--ai-cyan);
  border: 1px solid var(--ai-cyan);
}

/* Neon Cards */
.neon-card {
  background: linear-gradient(135deg, var(--ai-bg-elevated), var(--ai-bg-surface));
  border: 1px solid var(--ai-border-primary);
  border-radius: 12px;
  box-shadow: var(--ai-glow-cyan);
  transition: var(--ai-transition-normal);
  overflow: hidden;
  position: relative;
}

.neon-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, 
    transparent, 
    rgba(0, 229, 255, 0.1), 
    transparent
  );
  transition: var(--ai-transition-slow);
}

.neon-card:hover {
  transform: translateY(-2px);
  box-shadow: 
    var(--ai-glow-cyan),
    0 8px 25px rgba(0, 229, 255, 0.2);
}

.neon-card:hover::before {
  left: 100%;
}

/* Performance Overlay */
.performance-overlay {
  position: fixed;
  top: 20px;
  left: 20px;
  background-color: rgba(10, 10, 15, 0.9);
  border: 1px solid var(--ai-border-primary);
  border-radius: 8px;
  padding: var(--ai-space-sm);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: var(--ai-font-size-xs);
  color: var(--ai-green);
  backdrop-filter: blur(10px);
  z-index: 9999;
}

/* Loading States */
.loading-spinner {
  color: var(--ai-cyan);
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  background-color: var(--ai-bg-primary);
}

/* Responsive Design */
@media (max-width: 768px) {
  .command-bar-content {
    flex-direction: column;
    gap: var(--ai-space-sm);
    padding: var(--ai-space-sm);
  }
  
  .search-container {
    max-width: 100%;
  }
  
  .document-viewer {
    max-width: 95%;
    padding: var(--ai-space-md);
  }
  
  .navbar {
    flex-direction: column;
    gap: var(--ai-space-md);
    padding: var(--ai-space-md);
  }
  
  .nav-links {
    flex-wrap: wrap;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .logo-text {
    font-size: 1.5rem;
  }
  
  .nav-link {
    padding: var(--ai-space-xs) var(--ai-space-sm);
    font-size: var(--ai-font-size-xs);
  }
  
  .document-viewer {
    padding: var(--ai-space-sm);
  }
  
  .accordion.level-2 {
    margin-left: var(--ai-space-sm);
  }
  
  .accordion.level-3 {
    margin-left: var(--ai-space-md);
  }
}
```

---

## 📋 Implementation Checklist

### Files to Create/Replace:
1. **`src/styles/globals.css`** - Global reset and base styles
2. **`src/styles/theme.css`** - CSS variables (keep existing)
3. **`src/components/Layout/Layout.css`** - Replace existing
4. **`src/components/DocumentViewer/DocumentViewer.css`** - Replace existing  
5. **`src/components/Visualizations/Visualizations.css`** - New file
6. **`src/components/UI/Components.css`** - New file

### Files to Delete:
- **`src/index.css`** - Replace with import structure
- **`src/App.css`** - Replace with minimal version
- **`src/components/Visualizations/VennDiagram.css`** - Merge into Visualizations.css
- **`src/components/Home/Home.css`** - Merge into Components.css

Additionally:
- Integrate `src/styles/accessibility.css` with theme variables (replace hardcoded colors with `var(--ai-...)`).
- Add optional mobile refinements for `src/components/Mobile/*` within Components.css if needed (toolbar density, touch targets).

### Import Structure (`src/index.css`):
```css
/* Import order is critical */
@import './styles/theme.css';
@import './styles/globals.css';
@import './components/Layout/Layout.css';
@import './components/DocumentViewer/DocumentViewer.css';
@import './components/Visualizations/Visualizations.css';
@import './components/UI/Components.css';
```

---

## 🎯 Expected Visual Results

After implementation, the application should display:

1. **Deep space black background** (#0a0a0f) throughout
2. **Animated header** with gradient border and sweep effect
3. **Vibrant cyan logo** with glow effects and hover animations
4. **Color-coded navigation** with hover states and transitions
5. **Enhanced ZLFN graph** with glowing nodes and animated edges
6. **Styled zones** with proper colors and labels
7. **Rivers and Bayesian buttons** with distinct active states
8. **Professional dialogs** with backdrop blur and glow effects
9. **Responsive design** that works on all screen sizes
10. **Consistent theme** across all components

This specification provides complete control over every visual element in the application with no conflicts or inheritance issues.
