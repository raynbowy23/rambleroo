import { expect, it, vi } from 'vitest'
import type { Map } from './maplibre'
import { isTerrainError, setRelief, terrainSource } from './terrain'
vi.mock('./style', () => ({ palette: () => () => '#fbf5e6' }))
it('only keeps one DEM and shade while enabled and removes both on repeated toggles', () => {
  const sources = new Set<string>()
  const layers = new Set<string>()
  const map = {
    getSource: (id: string) => sources.has(id),
    getLayer: (id: string) => layers.has(id),
    addSource: vi.fn((id: string) => {
      expect(sources.has(id)).toBe(false)
      sources.add(id)
    }),
    addLayer: vi.fn(({ id }: { id: string }) => {
      expect(layers.has(id)).toBe(false)
      layers.add(id)
    }),
    removeLayer: (id: string) => layers.delete(id),
    removeSource: (id: string) => {
      expect(layers.size).toBe(0)
      sources.delete(id)
    },
    setTerrain: vi.fn(),
    setSky: vi.fn(),
  }
  setRelief(map as unknown as Map, false)
  expect(map.addSource).not.toHaveBeenCalled()
  for (let i = 0; i < 5; i++) {
    setRelief(map as unknown as Map, true, 9)
    setRelief(map as unknown as Map, true, 9)
    expect(sources.size).toBe(1)
    expect(layers.size).toBe(1)
    expect(map.setTerrain).toHaveBeenLastCalledWith({ source: terrainSource, exaggeration: 2 })
    setRelief(map as unknown as Map, false)
    expect(map.setTerrain).toHaveBeenLastCalledWith(null)
    expect(sources.size).toBe(0)
    expect(layers.size).toBe(0)
  }
  expect(map.addSource).toHaveBeenCalledTimes(5)
  expect(map.addSource.mock.calls[0][0]).toBe(terrainSource)
})
it('distinguishes terrain failures from unrelated map errors', () => {
  expect(isTerrainError({ sourceId: terrainSource })).toBe(true)
  expect(isTerrainError({ sourceId: 'byways' })).toBe(false)
  expect(isTerrainError(new Error('Other failure'))).toBe(false)
})
