import { describe, expect, it } from 'vitest'
import type { WaterPolygon } from './roadCountry'
import { onWater, propSpacing, sceneAt, splitStretches, waterCrossings } from './roadCountry'
import { circumference } from './roadGeometry'

const square: WaterPolygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ],
    [
      [0.5, 0.5],
      [1.5, 0.5],
      [1.5, 1.5],
      [0.5, 1.5],
      [0.5, 0.5],
    ],
  ],
}
describe('road country', () => {
  it('splits nearest-moment scenes into contiguous runs and falls back when data is absent', () => {
    const points = [0, 1, 2, 3, 4].map((lng) => ({ lng, lat: 0, x: lng, y: 0 }))
    const moments = [
      { title: 'Woods', at: [0, 0], scene: 'forest' as const },
      { title: 'Shore', at: [4, 0], scene: 'coast' as const },
    ]
    expect(splitStretches(points, moments, 'prairie')).toEqual([
      { start: 0, end: 2, scene: 'forest' },
      { start: 2, end: 4, scene: 'coast' },
    ])
    expect(splitStretches(points, [], 'prairie')).toEqual([{ start: 0, end: 4, scene: 'prairie' }])
    expect(sceneAt([0, 0], [{ title: 'No scene', at: [0, 0] }], 'desert')).toBe('desert')
    expect(splitStretches([], moments, 'town')).toEqual([])
  })
  it('keeps spacing at 48 screen pixels from zoom 10 to 15 across latitudes', () => {
    for (const lat of [0, 30, 60])
      for (let zoom = 10; zoom <= 15; zoom += 0.5) {
        const metresPerPixel = (circumference * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom)
        expect(propSpacing(zoom, lat) / metresPerPixel).toBeCloseTo(48)
        expect(propSpacing(zoom + 1, lat)).toBeCloseTo(propSpacing(zoom, lat) / 2)
      }
  })
  it('detects narrow crossings with dry endpoints and excludes islands', () => {
    expect(waterCrossings([-1, 1], [3, 1], [square])).toEqual([
      [0.25, 0.375],
      [0.625, 0.75],
    ])
    expect(waterCrossings([3, 1], [-1, 1], [square])).toEqual([
      [0.25, 0.375],
      [0.625, 0.75],
    ])
    expect(onWater([1, 1], [square])).toBe(false)
    expect(onWater([0.2, 1], [square])).toBe(true)
    expect(waterCrossings([-1, 3], [3, 3], [square])).toEqual([])
    expect(waterCrossings([0.7, 1], [1.3, 1], [square])).toEqual([])
    expect(waterCrossings([0.1, 0.1], [0.2, 0.2], [square])).toEqual([[0, 1]])
    expect(waterCrossings([-1, 1], [3, 1], [])).toEqual([])
    const multi: WaterPolygon = { type: 'MultiPolygon', coordinates: [square.coordinates as number[][][]] }
    expect(waterCrossings([-1, 1], [3, 1], [multi])).toEqual([
      [0.25, 0.375],
      [0.625, 0.75],
    ])
  })
})
