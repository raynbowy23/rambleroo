// Single entry point for maplibre-gl. MapLibre 6 does not locate its worker under Vite, so point it at a Vite-bundled copy (the `?worker&url` suffix bundles the worker's shared chunk with it).
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

maplibregl.setWorkerUrl(workerUrl)

export default maplibregl
