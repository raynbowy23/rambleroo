import type { Map, ExpressionSpecification } from './maplibre'
import type { FeatureCollection, MultiLineString } from 'geojson'
import type { BywaySummary } from '../../lib/types'
import { palette } from './style'
import { addRouteArt } from './routeArt'
import { glyphPaths, type Glyph } from './decor'
export type BywayGeometry = FeatureCollection<MultiLineString, { id: string; name: string; scene: string; story: boolean }>
let geometry: Promise<BywayGeometry> | undefined
export function loadBywayGeometry() {
  if (!geometry) {
    performance.mark('byways:fetch-start')
    geometry = fetch('/data/byways.geojson')
      .then(async (r) => {
        if (!r.ok) throw new Error('Route geometry unavailable')
        const data = (await r.json()) as BywayGeometry
        performance.mark('byways:fetch-end')
        performance.measure('byways:fetch', 'byways:fetch-start', 'byways:fetch-end')
        return data
      })
      .catch((error: unknown) => {
        geometry = undefined
        throw error
      })
  }
  return geometry
}
export function addBywayLayers(map: Map, data: BywayGeometry, byways: BywaySummary[]) {
  const c = palette()
  // Each road family in its own earth ink (all browns and umbers, so the map stays sepia), with the landscape motif closer in.
  const color: ExpressionSpecification = [
    'match',
    ['get', 'scene'],
    ['river', 'coast'],
    c('route-water'),
    'mountain',
    c('route-mountain'),
    'forest',
    c('route-forest'),
    'desert',
    c('route-desert'),
    'prairie',
    c('route-prairie'),
    c('route-town'),
  ]
  const motif: ExpressionSpecification = [
    'match',
    ['get', 'scene'],
    ['river', 'coast'],
    'route-water',
    'mountain',
    'route-mountain',
    'forest',
    'route-forest',
    'desert',
    'route-desert',
    'prairie',
    'route-prairie',
    'route-stitch',
  ]
  const motifWidth: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 4.5, 6, 6, 7.5, 8, 10, 11, 14, 14, 18]
  addRouteArt(map)
  const round = { 'line-cap': 'round', 'line-join': 'round' } as const
  map.addSource('byways', { type: 'geojson', data, promoteId: 'id', tolerance: 1, buffer: 32, maxzoom: 12 })
  map.addLayer({
    id: 'byway-casing',
    type: 'line',
    source: 'byways',
    layout: round,
    paint: {
      'line-color': c('paper'),
      'line-width': ['interpolate', ['linear'], ['zoom'], 2, 3.4, 5, 4.8, 8, 9, 11, 13, 14, 19],
      'line-opacity': 0.8,
    },
  })
  // National view: a hand-inked line (thin ink edge round the colour) so tiny roads still read crisply and never break into dashes.
  map.addLayer({
    id: 'byway-ink',
    type: 'line',
    source: 'byways',
    maxzoom: 6,
    layout: round,
    paint: {
      'line-color': c('ink'),
      'line-width': ['interpolate', ['linear'], ['zoom'], 2, 2.4, 5, 3.4],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0.3, 4.6, 0.3, 5.6, 0],
    },
  })
  map.addLayer({
    id: 'byway-lines',
    type: 'line',
    source: 'byways',
    layout: round,
    paint: {
      'line-color': color,
      'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1.6, 5, 2.4, 8, 3.6, 14, 5.2],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 4.6, 1, 5.6, 0],
    },
  })
  // From the state view in, at every zoom, each road wears its landscape motif (waves, zigzags, trees, stones, rail ties, grass) on an
  // unbroken line, like a pictorial map; the motif grows with the zoom.
  map.addLayer({
    id: 'byway-art',
    type: 'line',
    source: 'byways',
    minzoom: 4.5,
    layout: round,
    paint: {
      'line-pattern': motif,
      'line-width': motifWidth,
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 4.6, 0, 5.6, 1],
    },
  })
  // Each road's landmark: a small inked picture of its landscape at the road's middle, like the vignettes on an old pictorial map.
  // Symbol collision keeps the national view airy (national byways claim their spot first); more appear as you zoom in.
  const kinds: Record<string, Glyph> = {
    river: 'wave',
    coast: 'lighthouse',
    mountain: 'mountain',
    forest: 'pine',
    desert: 'mesa',
    prairie: 'windmill',
  }
  for (const glyph of new Set<Glyph>([...Object.values(kinds), 'church'])) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 80
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    ctx.scale(2, 2)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    const path = new Path2D(glyphPaths[glyph])
    ctx.fillStyle = c('paper')
    ctx.strokeStyle = c('paper')
    ctx.lineWidth = 5
    ctx.stroke(path)
    ctx.fill(path)
    ctx.fillStyle = c('land-us')
    ctx.strokeStyle = c('ink')
    ctx.lineWidth = 1.6
    ctx.fill(path)
    ctx.stroke(path)
    map.addImage(`mark-${glyph}`, ctx.getImageData(0, 0, 80, 80), { pixelRatio: 2 })
  }
  const national = new Set(byways.filter((b) => b.nationalScenicByway || b.allAmericanRoad).map((b) => b.id))
  map.addSource('byway-marks', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: byways.map((b) => ({
        type: 'Feature' as const,
        properties: { id: b.id, mark: `mark-${kinds[b.scene] ?? 'church'}`, rank: national.has(b.id) ? 0 : 1 },
        geometry: { type: 'Point' as const, coordinates: b.center },
      })),
    },
  })
  map.addLayer({
    id: 'byway-marks',
    type: 'symbol',
    source: 'byway-marks',
    minzoom: 3,
    layout: {
      'icon-image': ['get', 'mark'],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.42, 5, 0.6, 8, 0.85, 11, 1],
      'icon-padding': ['interpolate', ['linear'], ['zoom'], 3, 14, 6, 8, 9, 4],
      'symbol-sort-key': ['get', 'rank'],
      'icon-allow-overlap': false,
    },
    paint: { 'icon-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0, 3.4, 0.95] },
  })
  map.addLayer({
    id: 'byway-hover',
    type: 'line',
    source: 'byways',
    layout: round,
    paint: {
      'line-color': c('gold'),
      'line-width': ['interpolate', ['linear'], ['zoom'], 2, 5, 8, 14, 11, 19, 14, 26],
      'line-width-transition': { duration: 0 },
      'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.75, 0],
    },
  })
  map.addLayer({
    id: 'byway-hit',
    type: 'line',
    source: 'byways',
    // Just wider than the drawn line, so a click beside a road reaches open map (which flies back to the whole country).
    paint: { 'line-color': c('paper'), 'line-opacity': 0, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 7, 6, 9, 11, 14, 14, 20] },
  })
  map.addSource('story-points', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: byways
        .filter((b) => b.status !== 'listing')
        .map((b) => ({ type: 'Feature', properties: { id: b.id }, geometry: { type: 'Point', coordinates: b.center } })),
    },
  })
  map.addLayer({
    id: 'story-points',
    type: 'circle',
    source: 'story-points',
    minzoom: 4,
    paint: { 'circle-radius': 4, 'circle-color': c('signal'), 'circle-stroke-color': c('paper'), 'circle-stroke-width': 2 },
  })
  // Preserve the selected vertices so the pen and car share the same projected distances.
  map.addSource('selected', { type: 'geojson', lineMetrics: true, tolerance: 0, data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({
    id: 'selected-glow',
    type: 'line',
    source: 'selected',
    layout: round,
    paint: {
      'line-color': c('gold'),
      'line-width': ['interpolate', ['linear'], ['zoom'], 2, 15, 8, 24, 14, 40],
      'line-blur': 5,
      'line-opacity': 0.55,
    },
  })
  map.addLayer({
    id: 'selected-halo',
    type: 'line',
    source: 'selected',
    layout: round,
    paint: { 'line-color': c('paper'), 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 6, 8, 15, 14, 28] },
  })
  // The chosen road keeps its pictorial motif, a size up; the pen trace below draws over it and then lifts away (selection.ts).
  map.addLayer({
    id: 'selected-art',
    type: 'line',
    source: 'selected',
    layout: round,
    paint: {
      'line-pattern': motif,
      'line-width': ['interpolate', ['linear'], ['zoom'], 2, 5, 6, 11, 8, 14, 11, 19, 14, 26],
    },
  })
  map.addLayer({
    id: 'selected-line',
    type: 'line',
    source: 'selected',
    layout: round,
    paint: { 'line-color': c('ink'), 'line-width': 3, 'line-gradient': ['literal', 'rgba(0,0,0,0)'] },
  })
  for (const source of ['route-flags', 'route-moments', 'route-car']) {
    map.addSource(source, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({
      id: source,
      type: 'symbol',
      source,
      layout: {
        'icon-image': source === 'route-car' ? 'route-car' : ['get', 'icon'],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-anchor': source === 'route-flags' ? 'bottom-left' : 'center',
        'icon-rotate': source === 'route-car' ? ['get', 'bearing'] : 0,
        'icon-rotation-alignment': source === 'route-car' ? 'map' : 'viewport',
      },
    })
  }
}

export const filteredLayers = [
  'byway-casing',
  'byway-ink',
  'byway-lines',
  'byway-art',
  'byway-marks',
  'byway-hover',
  'byway-hit',
  'story-points',
]
