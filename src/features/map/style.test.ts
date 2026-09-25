import { expect, it, vi } from 'vitest'
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec'
import type { LayerSpecification, Map, SourceSpecification } from 'maplibre-gl'
import { createAtlasStyle } from './style'
import { addBywayLayers } from './layers'
it('validates the basemap and route expressions without a glyph service', () => {
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({ getPropertyValue: () => '#214a3b' } as unknown as CSSStyleDeclaration)
  const style = createAtlasStyle()
  const adapter = {
    addSource: (id: string, source: SourceSpecification) => {
      style.sources[id] = source
    },
    addLayer: (layer: LayerSpecification) => {
      style.layers.push(layer)
    },
  } as unknown as Map
  addBywayLayers(adapter, { type: 'FeatureCollection', features: [] }, [])
  expect(validateStyleMin(style).map((e) => e.message)).toEqual([])
  expect(style.glyphs).toBeUndefined()
  vi.restoreAllMocks()
})
