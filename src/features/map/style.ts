import type { StyleSpecification, LineLayerSpecification } from './maplibre'
export function palette() {
  const css = getComputedStyle(document.documentElement)
  return (name: string) => css.getPropertyValue(`--${name}`).trim()
}
export function createMapStyle(): StyleSpecification {
  const c = palette()
  // Polygon offsets are negative outside land and positive inside lakes: both fall into water.
  const waterLines = (source: string, direction: number): LineLayerSpecification[] =>
    [3, 6, 9, 12].map((offset, index) => ({
      id: `${source}-waterline-${index}`,
      type: 'line',
      source,
      paint: {
        'line-color': c('water-deep'),
        'line-width': 0.65,
        'line-offset': offset * direction,
        'line-opacity': 0.32 - index * 0.06,
      },
    }))
  return {
    version: 8,
    sources: Object.fromEntries(
      ['land', 'states', 'lakes', 'rivers'].map((name) => [name, { type: 'geojson', data: `/data/basemap/${name}.geojson` }]),
    ),
    layers: [
      { id: 'sea', type: 'background', paint: { 'background-color': c('water-light') } },
      { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': ['case', ['==', ['get', 'us'], true], c('land-us'), c('land')] } },
      {
        id: 'coast-wash',
        type: 'line',
        source: 'land',
        paint: { 'line-color': c('water-deep'), 'line-width': 7, 'line-blur': 5, 'line-opacity': 0.2 },
      },
      ...waterLines('land', -1),
      { id: 'coast', type: 'line', source: 'land', paint: { 'line-color': c('water-deep'), 'line-width': 1, 'line-opacity': 0.35 } },
      { id: 'lakes', type: 'fill', source: 'lakes', paint: { 'fill-color': c('water-light'), 'fill-outline-color': c('water') } },
      ...waterLines('lakes', 1),
      {
        id: 'rivers',
        type: 'line',
        source: 'rivers',
        paint: { 'line-color': c('water'), 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.4, 9, 1.4], 'line-opacity': 0.65 },
      },
      {
        id: 'states',
        type: 'line',
        source: 'states',
        paint: { 'line-color': c('line-strong'), 'line-width': 0.8, 'line-dasharray': [5, 2, 1, 2] },
      },
    ],
  }
}
