import { describe, expect, it } from 'vitest'
import { circumference, projectRoad, ribbonFade, ribbonWidth, roadNormal, sampleRoad, simplifyRoad } from './roadGeometry'

const point = (x: number, y: number) => ({ x, y, lng: x / 100000, lat: y / 100000 })
describe('selected road ribbon', () => {
  it('keeps the country overview flat and fades in continuously from zoom 9 to 10.5', () => {
    expect([-1, 8, 9, 9.75, 10.5, 22].map(ribbonFade)).toEqual([0, 0, 0, 0.5, 1, 1])
  })
  it('matches the selected-art width in pixels across zooms and latitudes', () => {
    for (const lat of [0, 30, 60]) {
      for (const [zoom, pixels] of [
        [8, 14],
        [11, 19],
        [12, 19 + 7 / 3],
        [14, 26],
        [22, 26],
      ]) {
        const metresPerPixel = (circumference * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom)
        expect(ribbonWidth(zoom, lat) / metresPerPixel).toBeCloseTo(pixels)
      }
    }
  })
  it('preserves endpoints and significant bends while removing collinear vertices', () => {
    const points = [point(0, 0), point(50, 0), point(100, 0), point(100, 100)]
    expect(simplifyRoad(points)).toEqual([points[0], points[2], points[3]])
    expect(simplifyRoad([point(1, 1), point(1, 1), point(1, 1)])).toHaveLength(2)
  })
  it('keeps disconnected parts separate and samples straight roads for terrain', () => {
    const parts = sampleRoad([
      [point(0, 0), point(1000, 0)],
      [point(3000, 0), point(3100, 0)],
    ])
    expect(parts).toHaveLength(2)
    expect(parts[0]).toHaveLength(11)
    expect(parts[1][0].x).toBe(3000)
  })
  it('bounds a continent-length route and retains its endpoints', () => {
    const points = Array.from({ length: 100000 }, (_, i) => point(i * 100, Math.sin(i) * 3))
    const [sampled] = sampleRoad([points])
    expect(sampled.length).toBeLessThanOrEqual(12000)
    expect(sampled[0]).toEqual(points[0])
    expect(sampled.at(-1)).toEqual(points.at(-1))
  })
  it('bounds mitres at switchbacks and produces finite normals for duplicates', () => {
    const points = [point(0, 0), point(100, 0), point(0, 1), point(0, 1)]
    for (let i = 0; i < points.length; i++) {
      const n = roadNormal(points, i)
      expect(n.every(Number.isFinite)).toBe(true)
      expect(Math.hypot(...n)).toBeLessThanOrEqual(2.000001)
    }
    expect(roadNormal([point(0, 0), point(100, 0)], 0)).toEqual([-0, 1])
    expect(roadNormal([point(0, 0), point(100, 0)], 1)).toEqual([-0, 1])
  })
  it('unwraps the dateline and does not bridge disconnected parts', () => {
    const road = projectRoad([
      [
        [179.9, 45],
        [-179.9, 45],
      ],
      [
        [-179.8, 45],
        [-179.7, 45],
      ],
    ])
    expect(road.parts[0][0].x).toBeCloseTo(0)
    expect(road.parts[0][1].x).toBeGreaterThan(10000)
    expect(road.parts[0][1].x).toBeLessThan(20000)
    expect(road.parts).toHaveLength(2)
  })
})
