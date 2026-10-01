import { expect, it } from 'vitest'
import { distanceToByway, distanceLabel, sortByDistance } from './distance'
const near = { bbox: [-85, 37, -84, 38] as [number, number, number, number], center: [-84.5, 37.5] as [number, number] }
const far = { bbox: [-90, 37, -89, 38] as [number, number, number, number], center: [-89.5, 37.5] as [number, number] }
it('sorts by nearest bounds, keeps ties stable and does not mutate input', () => {
  const input = [far, near, { ...near }]
  const result = sortByDistance(input, [-84, 37])
  expect(result).toEqual([near, input[2], far])
  expect(input[0]).toBe(far)
  expect(distanceToByway([-84, 37], near)).toBe(0)
  expect(distanceToByway([-84, 36], near)).toBeCloseTo(69.09, 1)
  expect(distanceLabel([-84, 36], near)).toBe('≈ 69 mi away, straight line')
})
it('uses center for bounds crossing the antimeridian', () => {
  expect(distanceToByway([179, 0], { bbox: [170, -1, -170, 1], center: [179, 0] })).toBe(0)
})
