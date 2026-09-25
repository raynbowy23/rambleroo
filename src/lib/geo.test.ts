import { expect, it } from 'vitest'
import { greatCircleMiles } from './geo'
it('measures identical points, equatorial degrees, and the date line', () => {
  expect(greatCircleMiles([0, 0], [0, 0])).toBe(0)
  expect(greatCircleMiles([0, 0], [1, 0])).toBeCloseTo(69.0934, 3)
  expect(greatCircleMiles([179, 0], [-179, 0])).toBeCloseTo(138.1868, 3)
  expect(greatCircleMiles([0, 0], [180, 0])).toBeCloseTo(12436.8, 0)
})
