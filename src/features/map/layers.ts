import type { Map, ExpressionSpecification } from './maplibre'
import type { FeatureCollection, MultiLineString } from 'geojson'
import type { BywaySummary } from '../../lib/types'
import { palette } from './style'
import { addRouteArt } from './routeArt'
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
  addRouteArt(map)
  const round = { 'line-cap': 'round', 'line-join': 'round' } as const
  map.addSource('byways', { type: 'geojson', data, promoteId: 'id', tolerance: 1, buffer: 32, maxzoom: 12 })
  map.addLayer({
    id: 'byway-casing',
    type: 'line',
    source: 'byways',
    maxzoom: 8,
    layout: round,
    paint: {
      'line-color': c('paper'),
      'line-width': ['interpolate', ['linear'], ['zoom'], 2, 4.5, 5, 6.5, 8, 9],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.8, 8, 0],
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
      'line-width': ['interpolate', ['linear'], ['zoom'], 2, 3, 5, 4.4],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0.45, 4.6, 0.45, 5.6, 0],
    },
  })
  map.addLayer({
    id: 'byway-lines',
    type: 'line',
    source: 'byways',
    maxzoom: 8,
    layout: round,
    paint: {
      'line-color': color,
      'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1.8, 5, 2.8, 8, 4.2],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 4.6, 1, 5.6, 0],
    },
  })
  // Closer in, each road wears its landscape motif (waves, zigzags, trees, stones, rail ties, grass) on an unbroken line.
  map.addLayer({
    id: 'byway-art',
    type: 'line',
    source: 'byways',
    minzoom: 4.5,
    maxzoom: 8,
    layout: round,
    paint: {
      'line-pattern': [
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
      ],
      'line-width': ['interpolate', ['linear'], ['zoom'], 4.5, 7, 6, 9, 8, 12],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 4.6, 0, 5.6, 1, 7, 1, 8, 0],
    },
  })
  for (const [id, color, width] of [
    ['byway-road-outline', c('ink'), 8],
    ['byway-road-fill', c('terrain'), 5.5],
    ['byway-road-center', c('paper'), 1.1],
  ] as const) {
    map.addLayer({
      id,
      type: 'line',
      source: 'byways',
      minzoom: 7,
      layout: round,
      paint: {
        'line-color': color,
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, width * 0.65, 10, width, 14, width * 1.6],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0, 8, 1],
      },
    })
  }
  map.addLayer({
    id: 'byway-hover',
    type: 'line',
    source: 'byways',
    layout: round,
    paint: {
      'line-color': c('gold'),
      'line-width': 5,
      'line-width-transition': { duration: 0 },
      'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.75, 0],
    },
  })
  map.addLayer({
    id: 'byway-hit',
    type: 'line',
    source: 'byways',
    paint: { 'line-color': c('paper'), 'line-opacity': 0, 'line-width': 14 },
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
    paint: { 'line-color': c('gold'), 'line-width': 15, 'line-blur': 5, 'line-opacity': 0.55 },
  })
  map.addLayer({
    id: 'selected-halo',
    type: 'line',
    source: 'selected',
    layout: round,
    paint: { 'line-color': c('paper'), 'line-width': 6 },
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
  'byway-road-outline',
  'byway-road-fill',
  'byway-road-center',
  'byway-hover',
  'byway-hit',
  'story-points',
]
