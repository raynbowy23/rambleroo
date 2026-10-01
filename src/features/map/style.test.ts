import { expect, it, vi } from 'vitest'
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec'
import type { LayerSpecification, Map, SourceSpecification } from './maplibre'
import { createMapStyle } from './style'
import { basemapService } from './basemap'
import { addBywayLayers } from './layers'
vi.mock('./routeArt', () => ({ addRouteArt: vi.fn() }))

it.each(['pattern', 'dash'])('validates the basemap and %s routes with the shared vector basemap', (mode) => {
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
  expect(style.glyphs).toBe(basemapService.glyphs)
  window.history.replaceState(null, '', '/')
  vi.restoreAllMocks()
})

it('keeps the local geography beneath detail and bundles the serif font', () => {
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({ getPropertyValue: () => '#214a3b' } as unknown as CSSStyleDeclaration)
  const style = createMapStyle()
  expect(Object.keys(style.sources)).toEqual(expect.arrayContaining(['land', 'states', 'lakes', 'rivers', 'openfreemap']))
  const ground = style.layers.find((layer) => layer.id === 'detail-ground')!
  expect(ground.paint).toMatchObject({ 'background-opacity': 0 })
  expect(style.layers.indexOf(ground)).toBeGreaterThan(style.layers.findIndex((layer) => layer.id === 'lakes'))
  expect(style['font-faces']).toHaveProperty('Fraunces Regular')
  vi.restoreAllMocks()
})
