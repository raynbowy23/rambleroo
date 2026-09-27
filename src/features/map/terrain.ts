import type { Map } from './maplibre'
import { palette } from './style'

export const terrainSource = 'raised-relief'
export const terrainAttribution =
  'Terrain: <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Mapzen Terrain Tiles on AWS Open Data (USGS, NOAA and others)</a>'
export function setRelief(map: Map, enabled: boolean, exaggeration = 1.6) {
  if (!enabled) {
    map.setTerrain(null)
    if (map.getLayer('relief-shade')) map.removeLayer('relief-shade')
    if (map.getSource(terrainSource)) map.removeSource(terrainSource)
    map.setSky({})
    return
  }
  const c = palette()
  if (!map.getSource(terrainSource))
    map.addSource(terrainSource, {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 15,
      encoding: 'terrarium',
      attribution: terrainAttribution,
    })
  if (!map.getLayer('relief-shade'))
    map.addLayer(
      {
        id: 'relief-shade',
        type: 'hillshade',
        source: terrainSource,
        paint: {
          'hillshade-exaggeration': 0.24,
          'hillshade-highlight-color': c('paper'),
          'hillshade-shadow-color': c('water-deep'),
          'hillshade-accent-color': c('terrain'),
        },
      },
      'states',
    )
  map.setTerrain({ source: terrainSource, exaggeration: Math.max(1.2, Math.min(2, exaggeration)) })
  map.setSky({
    'sky-color': c('paper'),
    'horizon-color': c('land-us'),
    'fog-color': c('paper'),
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.6,
    'fog-ground-blend': 0.3,
  })
}

export function isTerrainError(event: unknown) {
  return !!event && typeof event === 'object' && 'sourceId' in event && event.sourceId === terrainSource
}
