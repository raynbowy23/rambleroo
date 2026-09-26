import { describe, expect, it } from 'vitest'
import { bearing, journeyPoint, longestPart, measurePart } from './routeJourney'

describe('route journey', () => {
  it('chooses the longest physical part rather than the most vertices', () => {
    expect(
      longestPart([
        [
          [0, 0],
          [0.1, 0],
          [0.2, 0],
        ],
        [
          [0, 0],
          [4, 0],
        ],
      ])?.coordinates,
    ).toEqual([
      [0, 0],
      [4, 0],
    ])
    expect(
      longestPart([
        [],
        [[1, 1]],
        [
          [1, 1],
          [1, 1],
        ],
      ]),
    ).toBeUndefined()
  })
  it('travels by projected distance and parks at the endpoint, ignoring duplicate vertices', () => {
    const part = measurePart([
      [0, 0],
      [0, 0],
      [1, 0],
      [4, 0],
      [4, 0],
    ])
    expect(journeyPoint(part, 0.5).coordinates[0]).toBeCloseTo(2)
    expect(journeyPoint(part, 1).coordinates[0]).toBeCloseTo(4)
    expect(journeyPoint(part, 1).bearing).toBeCloseTo(90)
    expect(journeyPoint(part, 0).bearing).toBeCloseTo(90)
  })
  it('uses compass bearings and crosses the dateline by the short path', () => {
    expect(bearing([0, 0], [0, 1])).toBe(0)
    expect(bearing([0, 0], [0, -1])).toBe(180)
    expect(bearing([0, 0], [-1, 0])).toBe(270)
    const midpoint = journeyPoint(
      measurePart([
        [179, 0],
        [-179, 0],
      ]),
      0.5,
    )
    expect(midpoint.coordinates[0]).toBeCloseTo(180)
    expect(midpoint.bearing).toBeCloseTo(90)
  })
})
