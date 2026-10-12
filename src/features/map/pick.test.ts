import { expect, it } from 'vitest'
import { clickMargin, distanceTo, pickRoad, type Candidate } from './pick'

const line = (id: string, y: number): Candidate => ({
  id,
  parts: [
    [
      { x: 0, y },
      { x: 100, y },
    ],
  ],
})

it('measures the distance to a line segment and to a single point', () => {
  expect(distanceTo({ x: 50, y: 10 }, line('a', 0))).toBe(10)
  expect(distanceTo({ x: 130, y: 0 }, line('a', 0))).toBe(30)
  expect(distanceTo({ x: 3, y: 4 }, { id: 'stop', parts: [[{ x: 0, y: 0 }]] })).toBe(5)
})

it('counts a click beside a road within the margin, and nothing beyond it', () => {
  expect(pickRoad([line('a', 0)], { x: 50, y: 12 }, 16)).toBe('a')
  expect(pickRoad([line('a', 0)], { x: 50, y: 20 }, 16)).toBeNull()
  expect(pickRoad([line('a', 0)], { x: 50, y: 20 }, clickMargin(true))).toBe('a')
})

it('prefers the selected road inside the margin, otherwise the nearest', () => {
  const roads = [line('far', 0), line('near', 20)]
  expect(pickRoad(roads, { x: 50, y: 14 }, 16)).toBe('near')
  expect(pickRoad(roads, { x: 50, y: 14 }, 16, 'far')).toBe('far')
  expect(pickRoad(roads, { x: 50, y: 14 }, 16, 'elsewhere')).toBe('near')
})
