import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const manifest = JSON.parse(readFileSync(new URL('./public/site.webmanifest', import.meta.url), 'utf8'))

export default defineConfig({
  server: { proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        ...manifest,
        icons: [...manifest.icons, { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
      },
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-*.png'],
      workbox: {
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,woff,woff2,ttf,ico}'],
        globIgnores: ['data/**', 'photos/**', 'assets/car3d-*.js'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/data\//, /^\/photos\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://tiles.openfreemap.org',
            handler: 'CacheFirst',
            options: {
              cacheName: 'basemap-tiles-and-glyphs',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 256, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin &&
              (url.pathname === '/data/catalog.json' ||
                url.pathname === '/data/byways.geojson' ||
                url.pathname.startsWith('/data/basemap/')),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'road-data' },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/photos/'),
            handler: 'CacheFirst',
            options: { cacheName: 'road-photos', expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 } },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/data/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'opened-road-pages' },
          },
        ],
      },
    }),
  ],
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
