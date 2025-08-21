import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.md'],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor libraries
          'vendor-d3': ['d3'],
          'vendor-markdown': ['react-markdown'],
          'vendor-katex': ['katex'],
          'vendor-mui': ['@mui/material', '@mui/icons-material'],
          
          // Application chunks
          'visualizations': [
            './src/components/Visualizations/ZlfnGraph.tsx',
            './src/components/Visualizations/SemanticTableau.tsx',
            './src/components/Visualizations/VennDiagram.tsx',
            './src/components/Visualizations/TruthTable.tsx'
          ],
          'services': [
            './src/services/logic.ts',
            './src/services/inference.ts',
            './src/services/exportService.ts'
          ]
        }
      }
    },
    // Increase chunk size warning limit to 1MB
    chunkSizeWarningLimit: 1000
  }
})
