import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/maplibre-gl/')) return 'maplibre'
        },
      },
    },
  },
  // MapLibre 6 loads its worker as a sibling ES module by relative URL; pre-bundling moves the main module and breaks that path.
  optimizeDeps: { exclude: ['maplibre-gl'] },
})
