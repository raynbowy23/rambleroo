import { describe, expect, it, vi } from 'vitest'
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec'
import type { BywaySummary, Region, SceneFamily } from '../../lib/types'
import type { LayerSpecification, Map } from '../map/maplibre'
import { createMapStyle } from '../map/style'
import { applySeasonStyle, climateFor, seasonalTerrain, seasonProfile, seasons, snowTint } from './seasonStyle'

const place = (
  region: Region,
  center: [number, number],
  scene: SceneFamily = 'coast',
): Pick<BywaySummary, 'region' | 'center' | 'scene'> => ({ region, center, scene })
const door = place('upper-midwest', [-87.2, 45])
const florida = place('florida', [-81.2, 29.5])
const sanJuan = place('rockies', [-107.8, 37.8], 'mountain')

describe('regional winter climates', () => {
  it.each([
    ['Door County', door, 180, 'snowy'],
    ['A1A', florida, 5, 'tropical'],
    ['Hawaii even at elevation', place('hawaii', [-155.5, 20]), 3500, 'tropical'],
    ['Big Sur', place('california', [-121.8, 36.3]), 150, 'mild'],
    ['Sierra', place('california', [-119, 38], 'mountain'), 2400, 'snowy'],
    ['San Juan', sanJuan, 3200, 'snowy'],
    ['PNW coast', place('pacific-northwest', [-124, 46]), 100, 'mild'],
    ['PNW interior', place('pacific-northwest', [-119, 46]), 300, 'snowy'],
    ['Cascades', place('pacific-northwest', [-122, 46]), 1200, 'snowy'],
    ['Appalachian lowland', place('appalachia', [-83, 35]), 300, 'mild'],
    ['Appalachian highland', place('appalachia', [-83, 35]), 1200, 'snowy'],
    ['Northern plains', place('great-plains', [-100, 45]), 500, 'snowy'],
    ['Southern plains', place('great-plains', [-100, 34]), 500, 'mild'],
    ['Low southwest', place('southwest', [-112, 33], 'desert'), 400, 'mild'],
    ['High southwest', place('southwest', [-112, 36], 'mountain'), 2200, 'snowy'],
    ['Ozarks', place('ozarks', [-93, 36]), 500, 'mild'],
    ['Deep south', place('deep-south', [-90, 32]), 100, 'mild'],
  ] as const)('%s → %s', (_, location, elevation, expected) => {
    expect(climateFor(location, elevation)).toBe(expected)
  })
  it('uses landscape as an initial estimate, then measured elevation', () => {
    const mountain = place('appalachia', [-83, 35], 'mountain')
    expect(climateFor(mountain)).toBe('snowy')
    expect(climateFor(mountain, 200)).toBe('mild')
  })
})

it('gives snowy roads a dark ribbon and white edge, with elevation snow', () => {
  const winter = seasonProfile('winter', door)
  expect(winter).toMatchObject({ land: '#f0f4f5', snowy: true, road: '#455566', edge: '#ffffff', weather: 'snow', snowline: 0 })
  expect(snowTint(seasonProfile('winter', sanJuan))).toContain('#f7faff')
  for (const season of ['spring', 'autumn'] as const) {
    expect(seasonProfile(season, sanJuan).snowline).toBe(3000)
    expect(seasonProfile(season, door).snowline).toBeNull()
  }
  expect(seasonProfile('summer', sanJuan).snowline).toBeNull()
})

it('keeps tropical seasons lush, snow-free and gently varied', () => {
  const profiles = seasons.map((season) => seasonProfile(season, florida, 4000))
  for (const profile of profiles)
    expect(profile).toMatchObject({ climate: 'tropical', snowy: false, snowline: null, weather: null, water: '#6ad8d2' })
  expect(new Set(profiles.map((profile) => profile.land)).size).toBe(4)
  expect(profiles[1].fog).toBeGreaterThan(profiles[3].fog)
  expect(seasonProfile('winter', place('california', [-122, 36]))).toMatchObject({ land: '#b9ba94', snowy: false, weather: null })
})

it('updates a valid style in place through all seasons and climates', () => {
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({ getPropertyValue: () => '#214a3b' } as unknown as CSSStyleDeclaration)
  try {
    const style = createMapStyle()
    style.sources.dem = { type: 'raster-dem', tiles: ['https://example.org/{z}/{x}/{y}.png'] }
    style.sources['raised-relief'] = style.sources.dem
    style.layers.push({ id: 'relief-shade', type: 'hillshade', source: 'dem', paint: {} })
    for (const id of ['road', 'road-edge']) style.layers.push({ id, type: 'line', source: 'rivers', paint: {} })
    const addLayer = vi.fn((layer: LayerSpecification) => {
      style.layers.push(layer)
    })
    const map = {
      getLayer: (id: string) => style.layers.find((layer) => layer.id === id),
      addLayer,
      setPaintProperty: (id: string, key: string, value: unknown) => {
        ;(style.layers.find((layer) => layer.id === id)!.paint as Record<string, unknown>)[key] = value
      },
      setSky: (sky: typeof style.sky) => {
        style.sky = sky
      },
    } as unknown as Map
    for (const location of [door, florida, sanJuan])
      for (const season of seasons) {
        const profile = seasonProfile(season, location)
        applySeasonStyle(map, profile, true)
        expect(validateStyleMin(style).map((error) => error.message)).toEqual([])
        expect(map.getLayer(seasonalTerrain)).toBeDefined()
      }
    expect(addLayer).toHaveBeenCalledTimes(1)
    applySeasonStyle(map, seasonProfile('winter', door), false)
    const land = style.layers.find((layer) => layer.id === 'land')!.paint as Record<string, unknown>
    expect((land['fill-color'] as string[])[3]).not.toBe('#f0f4f5')
  } finally {
    vi.restoreAllMocks()
  }
})
