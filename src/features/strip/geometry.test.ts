import { describe, expect, it } from 'vitest'
import { buildRibbon, coordinateAtMile, googleMapsUrl, mappedIntervals, sideOfRoad, swayAtMile } from './geometry'
import type { StripPath } from './types'

const straight: StripPath = {
  path: [
    [-87, 44],
    [-87, 45],
    [-87, 46],
  ],
  cumMiles: [0, 10, 20],
  miles: 20,
}
describe('strip geometry', () => {
  it('interpolates coordinates by cumulative miles and clamps endpoints', () => {
    expect(coordinateAtMile(straight, 5)).toEqual([-87, 44.5])
    expect(coordinateAtMile(straight, 10)).toEqual([-87, 45])
    expect(coordinateAtMile(straight, -4)).toEqual(straight.path[0])
    expect(coordinateAtMile(straight, 99)).toEqual(straight.path[2])
    expect(coordinateAtMile({ path: [[1, 2]], cumMiles: [0], miles: 0 }, 8)).toEqual([1, 2])
  })
  it('handles repeated source distances without dividing by zero', () => {
    expect(
      coordinateAtMile(
        {
          path: [
            [0, 0],
            [0, 0],
            [0, 2],
          ],
          cumMiles: [0, 0, 2],
          miles: 2,
        },
        1,
      ),
    ).toEqual([0, 1])
  })
  it('keeps straight roads straight and responds to bearing changes with bounded sway', () => {
    for (let mile = 0; mile <= 20; mile += 0.25) expect(Math.abs(swayAtMile(straight, mile))).toBeLessThan(0.001)
    const turn: StripPath = {
      path: [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
      cumMiles: [0, 1, 2],
      miles: 2,
    }
    expect(swayAtMile(turn, 1)).toBeGreaterThan(5)
    expect(Math.abs(swayAtMile(turn, 1))).toBeLessThanOrEqual(13)
    expect(buildRibbon(straight).offset(5)).toBe(0)
  })
  it('uses local driving direction to find the actual side of the road', () => {
    expect(sideOfRoad(straight, 5, [-88, 44.5])).toBe('left')
    expect(sideOfRoad(straight, 5, [-86, 44.5])).toBe('right')
    const reverse = { ...straight, path: [...straight.path].reverse() }
    expect(sideOfRoad(reverse, 5, [-88, 45.5])).toBe('right')
  })
  it('encodes driving coordinates in latitude,longitude order with at most three waypoints', () => {
    const url = googleMapsUrl(straight, { fromMile: 0, toMile: 20 })
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe('https://www.google.com/maps/dir/')
    expect(parsed.searchParams.get('origin')).toBe('44.000000,-87.000000')
    expect(parsed.searchParams.get('destination')).toBe('46.000000,-87.000000')
    expect(parsed.searchParams.get('travelmode')).toBe('driving')
    expect(parsed.searchParams.get('api')).toBe('1')
    expect(parsed.searchParams.get('waypoints')?.split('|')).toEqual([
      '44.500000,-87.000000',
      '45.000000,-87.000000',
      '45.500000,-87.000000',
    ])
    expect(url).toContain('%2C')
    expect(url).toContain('%7C')
    expect(new URL(googleMapsUrl(straight, { fromMile: 5, toMile: 5 })).searchParams.has('waypoints')).toBe(false)
  })
  it('never bridges source gaps, including when a branch splits a gap', () => {
    const route = {
      ...straight,
      gaps: [
        { atMile: 5, miles: 2 },
        { atMile: 10, miles: 1 },
      ],
    }
    expect(mappedIntervals(route)).toEqual([
      [0, 5],
      [7, 10],
      [11, 20],
    ])
    expect(mappedIntervals(route, 6, 15)).toEqual([
      [7, 10],
      [11, 15],
    ])
    expect(mappedIntervals(route, 0, 6)).toEqual([[0, 5]])
  })
})

it('scales long roads and branches consistently and spaces mile posts', async () => {
  const { pixelsPerMile, milePostInterval } = await import('./geometry')
  expect(pixelsPerMile(469) * 469).toBeCloseTo(9000)
  expect(pixelsPerMile(123, true) * 123).toBeCloseTo(7000)
  expect(pixelsPerMile(49)).toBe(110)
  expect(pixelsPerMile(1000, true)).toBe(18)
  expect([110, 50, 18].map(milePostInterval)).toEqual([5, 10, 25])
  expect(buildRibbon(straight, pixelsPerMile(469)).path(0, 20)).toContain(`,${20 * pixelsPerMile(469)}`)
})
