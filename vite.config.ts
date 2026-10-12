import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { writePages } from './scripts/build/pages.ts'

const manifest = JSON.parse(readFileSync(new URL('./public/site.webmanifest', import.meta.url), 'utf8'))

export default defineConfig(({ mode }) => ({
  server: { proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } } },
  plugins: [
    react(),
    // A copy of index.html per public page with its own title and preview tags, plus sitemap.xml and robots.txt (scripts/build/pages.ts).
    // Written before VitePWA builds the service worker at closeBundle, so its precache sees the final index.html.
    {
      name: 'rambleroo-pages',
      apply: 'build',
      async writeBundle(options) {
        await writePages(options.dir!, loadEnv(mode, process.cwd(), 'VITE_').VITE_PHOTO_ORIGIN ?? 'https://photos.rambleroo.app')
      },
    },
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        ...manifest,
        icons: [...manifest.icons, { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
      },
      includeAssets: ['favicon.ico', 'favicon-*.png', 'apple-touch-icon.png', 'icon-*.png'],
      workbox: {
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,woff,woff2,ttf,ico}'],
        // The per-page copies of index.html (scripts/build/pages.ts) are for link previews and crawlers; the installed app opens every page from index.html.
        globIgnores: [
          'data/**',
          'photos/**',
          'assets/car3d-*.js',
          'byway/**',
          'state/**',
          'collections/**',
          'about.html',
          'collections.html',
          'privacy.html',
          'terms.html',
        ],
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
                url.pathname === '/data/byways-overview.geojson' ||
                url.pathname.startsWith('/data/basemap/')),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'road-data' },
          },
          {
            // The photo library (src/lib/photoOrigin.ts), or the local copy when VITE_PHOTO_ORIGIN is empty. Images are requested with
            // CORS, so only readable 200 responses are kept, never opaque ones.
            urlPattern: ({ url, sameOrigin }) =>
              url.origin === 'https://photos.rambleroo.app' || (sameOrigin && url.pathname.startsWith('/photos/')),
            handler: 'CacheFirst',
            options: {
              cacheName: 'road-photos',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
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
}))
