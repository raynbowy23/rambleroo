import serifUrl from '@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2?url'
import italicUrl from '@fontsource-variable/fraunces/files/fraunces-latin-wght-italic.woff2?url'
import type { ExpressionSpecification, LayerSpecification, Map } from './maplibre'

// Keep service locations together for a future self-hosted tile and glyph deployment.
export const basemapService = {
  tiles: 'https://tiles.openfreemap.org/planet',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  attribution: '© OpenFreeMap © OpenStreetMap contributors',
} as const

export const detailFade: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 4.5, 0, 6, 1]
// MapLibre 6 can draw our bundled UI typeface locally, including when glyph requests are offline.
export const mapFontFaces = { 'Fraunces Regular': serifUrl, 'Fraunces Italic': italicUrl }
export const placeFont = ['Fraunces Regular']
const italicFont = ['Fraunces Italic']

export function detailLayers(c: (name: string) => string): LayerSpecification[] {
  const source = 'openfreemap'
  const name: ExpressionSpecification = ['coalesce', ['get', 'name:en'], ['get', 'name']]
  const labelPaint = { 'text-color': c('ink'), 'text-halo-color': c('paper'), 'text-halo-width': 1.5, 'text-opacity': detailFade }
  return [
    { id: 'detail-ground', type: 'background', minzoom: 4.5, paint: { 'background-color': c('land-us'), 'background-opacity': 0 } },
    {
      id: 'detail-landcover',
      type: 'fill',
      source,
      'source-layer': 'landcover',
      minzoom: 4.5,
      paint: {
        'fill-color': ['match', ['get', 'class'], 'wood', c('forest'), 'sand', c('sand'), c('sage')],
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 4.5, 0, 6, 0.22],
      },
    },
    {
      id: 'detail-landuse',
      type: 'fill',
      source,
      'source-layer': 'landuse',
      minzoom: 4.5,
      paint: {
        'fill-color': ['match', ['get', 'class'], ['residential', 'commercial', 'industrial'], c('paper'), c('sage')],
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 4.5, 0, 6, 0.35],
      },
    },
    {
      id: 'detail-park',
      type: 'fill',
      source,
      'source-layer': 'park',
      minzoom: 4.5,
      paint: { 'fill-color': c('forest'), 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 4.5, 0, 6, 0.16] },
    },
    {
      id: 'detail-water',
      type: 'fill',
      source,
      'source-layer': 'water',
      minzoom: 4.5,
      paint: { 'fill-color': c('water-light'), 'fill-opacity': detailFade },
    },
    {
      id: 'detail-waterway',
      type: 'line',
      source,
      'source-layer': 'waterway',
      minzoom: 6,
      paint: { 'line-color': c('water'), 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 14, 2], 'line-opacity': 0.8 },
    },
    {
      id: 'detail-roads',
      type: 'line',
      source,
      'source-layer': 'transportation',
      minzoom: 5,
      filter: [
        'in',
        ['get', 'class'],
        ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'track', 'path']],
      ],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['match', ['get', 'class'], ['motorway', 'trunk'], c('line-strong'), c('sage')],
        'line-opacity': detailFade,
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          ['match', ['get', 'class'], ['motorway', 'trunk'], 0.7, 0.2],
          12,
          ['match', ['get', 'class'], ['motorway', 'trunk'], 2.5, ['primary', 'secondary'], 1.6, 0.8],
          16,
          ['match', ['get', 'class'], ['motorway', 'trunk'], 5, 2.5],
        ],
      },
    },
    ...(['city', 'town', 'village'] as const).map((kind, i): LayerSpecification => ({
      id: `detail-${kind}`,
      type: 'symbol',
      source,
      'source-layer': 'place',
      minzoom: [5, 8, 11][i],
      filter: ['==', ['get', 'class'], kind],
      layout: {
        'text-field': name,
        'text-font': placeFont,
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 12 - i, 14, 18 - i * 2],
        'text-max-width': 8,
        'text-padding': 8,
      },
      paint: labelPaint,
    })),
    ...(['park', 'water_name'] as const).map((layer): LayerSpecification => ({
      id: `detail-${layer}-names`,
      type: 'symbol',
      source,
      'source-layer': layer,
      minzoom: layer === 'park' ? 10 : 8,
      layout: { 'text-field': name, 'text-font': italicFont, 'text-size': 12, 'text-max-width': 9, 'text-padding': 12 },
      paint: { ...labelPaint, 'text-color': c(layer === 'park' ? 'forest' : 'water-deep') },
    })),
  ]
}

// Keep the local geography visible until the visible vector tiles arrive; a failed request leaves that fallback intact.
export function bindBasemapFallback(map: Map) {
  let failed = false
  let detailed = false
  map.on('error', (event) => {
    if (!('sourceId' in event) || event.sourceId !== 'openfreemap') return
    failed = true
    detailed = false
    if (map.getLayer('detail-ground')) map.setPaintProperty('detail-ground', 'background-opacity', 0)
  })
  map.on('sourcedata', (event) => {
    if (failed || detailed || event.sourceId !== 'openfreemap' || !event.tile || !map.isSourceLoaded('openfreemap')) return
    detailed = true
    map.setPaintProperty('detail-ground', 'background-opacity', detailFade)
  })
}
