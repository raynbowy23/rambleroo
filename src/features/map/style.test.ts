import { expect, it, vi } from 'vitest'
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec'
import type { LayerSpecification, Map, SourceSpecification } from './maplibre'
import { createMapStyle } from './style'
import { addBywayLayers } from './layers'
vi.mock('./routeArt', () => ({ addRouteArt: vi.fn() }))

it.each(['pattern', 'dash'])('validates the basemap and %s routes without a glyph service', (mode) => {
  window.history.replaceState(null, '', `/?mapStrokes=${mode}`)
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({ getPropertyValue: () => '#214a3b' } as unknown as CSSStyleDeclaration)
  const style = createMapStyle()
  const adapter = {
    addSource: (id: string, source: SourceSpecification) => {
      style.sources[id] = source
    },
    setPaintProperty: (id: string, key: string, value: unknown) => {
      const layer = style.layers.find((layer) => layer.id === id)!
      const paint = layer.paint as Record<string, unknown>
      if (value === undefined) delete paint[key]
      else paint[key] = value
    },
    addLayer: (layer: LayerSpecification) => {
      style.layers.push(layer)
    },
  } as unknown as Map
  addBywayLayers(adapter, { type: 'FeatureCollection', features: [] }, [])
  expect(validateStyleMin(style).map((e) => e.message)).toEqual([])
  expect(style.glyphs).toBeUndefined()
  window.history.replaceState(null, '', '/')
  vi.restoreAllMocks()
})
