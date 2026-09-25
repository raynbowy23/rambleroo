import type { Map, ExpressionSpecification } from 'maplibre-gl'
import type { FeatureCollection, MultiLineString } from 'geojson'
import type { BywaySummary } from '../../lib/types'
import { palette } from './style'
export type BywayGeometry = FeatureCollection<MultiLineString, { id: string; name: string; scene: string; story: boolean }>
let geometry: Promise<BywayGeometry> | undefined
export function loadBywayGeometry() {
  return (geometry ??= fetch('/data/byways.geojson').then((r) => {
    if (!r.ok) throw new Error('Route geometry unavailable')
    return r.json() as Promise<BywayGeometry>
  }))
}
export function addBywayLayers(map: Map, data: BywayGeometry, byways: BywaySummary[]) {
  const c = palette()
  const color: ExpressionSpecification = [
    'match',
    ['get', 'scene'],
    'river',
    c('water-deep'),
    'coast',
    c('water-deep'),
    'mountain',
    c('forest-2'),
    'forest',
    c('forest-2'),
    'desert',
    c('rust-2'),
    c('rust'),
  ]
  const width: ExpressionSpecification = [
    'interpolate',
    ['linear'],
    ['zoom'],
    3,
    ['case', ['get', 'story'], 1.8, 1.2],
    10,
    ['case', ['get', 'story'], 5, 4],
  ]
  map.addSource('byways', { type: 'geojson', data, promoteId: 'id' })
  map.addLayer({
    id: 'byway-casing',
    type: 'line',
    source: 'byways',
    paint: { 'line-color': c('paper'), 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 3.2, 10, 7] },
  })
  map.addLayer({
    id: 'byway-lines',
    type: 'line',
    source: 'byways',
    paint: { 'line-color': ['case', ['boolean', ['feature-state', 'hover'], false], c('gold'), color], 'line-width': width },
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
    paint: { 'circle-radius': 4, 'circle-color': c('rust'), 'circle-stroke-color': c('paper'), 'circle-stroke-width': 2 },
  })
  map.addSource('selected', { type: 'geojson', lineMetrics: true, data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({
    id: 'selected-glow',
    type: 'line',
    source: 'selected',
    paint: { 'line-color': c('gold'), 'line-width': 13, 'line-blur': 1.5, 'line-opacity': 0.25 },
  })
  map.addLayer({ id: 'selected-halo', type: 'line', source: 'selected', paint: { 'line-color': c('paper'), 'line-width': 8 } })
  map.addLayer({ id: 'selected-line', type: 'line', source: 'selected', paint: { 'line-color': c('gold'), 'line-width': 3.5 } })
}
