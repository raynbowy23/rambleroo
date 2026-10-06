import { basemapService, detailLayers, mapFontFaces } from './basemap'
import type { StyleSpecification, LineLayerSpecification, LayerSpecification } from './maplibre'
import { terrainAttribution } from './terrain'
/** Map colours: a --map-<name> token wins over the UI token of the same name, so maps can stay colourful while the chrome stays olive. */
export function palette() {
  const css = getComputedStyle(document.documentElement)
  return (name: string) => css.getPropertyValue(`--map-${name}`).trim() || css.getPropertyValue(`--${name}`).trim()
}
/** `landscape: false` leaves out the painted terrain (the strip inset has its own season colours and 3D relief). */
export function createMapStyle({ landscape: painted = true }: { landscape?: boolean } = {}): StyleSpecification {
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
  // Painted landscape, like a frontier survey map: sage lowlands, straw plains, ochre uplands, grey-brown peaks with snow on top,
  // with brushed hill shading over it. Below sea level stays clear so the sea and the paper show through. It sits over the detail
  // ground and land-cover tints (which fill in from the state view in) and under water, roads and labels.
  const landscape: LayerSpecification[] = [
    {
      id: 'landscape-tint',
      type: 'color-relief',
      source: 'landscape',
      paint: {
        'color-relief-color': [
          'interpolate',
          ['linear'],
          ['elevation'],
          -1,
          'rgba(0, 0, 0, 0)',
          0,
          c('landscape-0'),
          300,
          c('landscape-300'),
          800,
          c('landscape-800'),
          1400,
          c('landscape-1400'),
          2200,
          c('landscape-2200'),
          3200,
          c('landscape-3200'),
          4200,
          c('landscape-4200'),
        ],
        'color-relief-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.78, 9, 0.55],
      },
    },
    {
      id: 'landscape-shade',
      type: 'hillshade',
      source: 'landscape',
      paint: {
        'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 7, 0.42, 11, 0.28],
        'hillshade-illumination-direction': 315,
        'hillshade-shadow-color': c('landscape-shadow'),
        'hillshade-highlight-color': c('paper'),
        'hillshade-accent-color': c('landscape-shadow'),
      },
    },
  ]
  const detail = detailLayers(c)
  const water = detail.findIndex((layer) => layer.id === 'detail-water')
  if (painted) detail.splice(water, 0, ...landscape)
  return {
    version: 8,
    glyphs: basemapService.glyphs,
    'font-faces': mapFontFaces,
    sources: {
      openfreemap: { type: 'vector', url: basemapService.tiles, attribution: basemapService.attribution },
      ...(painted && {
        // Elevation for the painted landscape (the same open Terrarium tiles the 3D view uses), kept coarse on purpose: soft, brushed relief.
        landscape: {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          tileSize: 256,
          maxzoom: 10,
          encoding: 'terrarium',
          attribution: terrainAttribution,
        },
      }),
      ...Object.fromEntries(
        ['land', 'states', 'lakes', 'rivers'].map((name) => [name, { type: 'geojson', data: `/data/basemap/${name}.geojson` }]),
      ),
    },
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
      ...detail,
      {
        id: 'states',
        type: 'line',
        source: 'states',
        paint: { 'line-color': c('line-strong'), 'line-width': 0.8 },
      },
    ],
  }
}
