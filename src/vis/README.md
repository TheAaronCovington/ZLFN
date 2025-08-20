# Visualization Module (src/vis)

This module contains modular, reusable components for D3.js-based graph visualization. It was extracted from the monolithic `ZlfnGraph.tsx` component to improve maintainability, testability, and reusability.

## Structure

```
src/vis/
├── index.ts              # Main export file
├── README.md             # This file
├── constants.ts          # Shared constants and configuration
├── layers/               # Rendering layers
│   ├── zones.ts          # Zone rectangles and labels
│   ├── edges.ts          # Edge lines and rivers
│   ├── nodes.ts          # Node shapes and drag behavior
│   └── labels.ts         # Edge labels and collision avoidance
├── simulation/           # D3 simulation management
│   └── forces.ts         # Custom forces and simulation setup
├── hooks/                # React hooks
│   └── useSimulation.ts  # Simulation lifecycle management
├── facets/               # Interactive facet overlays
│   ├── icons.ts          # Facet icon rendering
│   └── overlay.ts        # Facet overlay management
└── utils/                # Utility functions
    ├── relevance.ts      # Facet relevance detection
    ├── graphMath.ts      # Mathematical utilities
    └── format.ts         # String and number formatting
```

## Key Benefits

1. **Modularity**: Each layer can be tested and modified independently
2. **Reusability**: Components can be used in other visualization contexts
3. **Type Safety**: Strong TypeScript interfaces for all components
4. **Performance**: Optimized rendering with proper D3 patterns
5. **Maintainability**: Smaller, focused files are easier to understand and modify

## Usage

### Basic Import
```typescript
import { renderZones, renderNodes, renderEdges } from '../vis'
```

### Layer-Specific Import
```typescript
import { renderZones } from '../vis/layers/zones'
import { useSimulation } from '../vis/hooks/useSimulation'
```

## Migration Notes

The original `ZlfnGraph.tsx` component has been partially refactored to use these modules:
- ✅ Zone rendering extracted to `layers/zones.ts`
- ✅ Modular components created for edges, nodes, labels, simulation
- 🔄 Main component still contains inline rendering (safe incremental migration)
- 📋 Future: Replace inline sections with modular calls

## Testing

Each module can be unit tested independently:
```bash
npm test -- src/vis/layers/zones.test.ts
npm test -- src/vis/simulation/forces.test.ts
```

## Performance Considerations

- All modules use efficient D3 data joins with proper enter/update/exit patterns
- Custom forces are optimized for large graphs (>100 nodes)
- Label collision avoidance uses bounded iterations to prevent performance issues
- Simulation parameters are configurable for different graph sizes
