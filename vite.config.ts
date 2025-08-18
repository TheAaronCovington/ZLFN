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
          'vendor-d3': ['d3'],
          'vendor-markdown': ['react-markdown'],
          'vendor-katex': ['katex'],
          'vendor-mui': ['@mui/material', '@mui/icons-material']
        }
      }
    }
  }
})
