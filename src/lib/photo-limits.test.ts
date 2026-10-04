import { describe, expect, it } from 'vitest'
import { fits, PHOTO_LIMITS, photoMonth } from './photo-limits'
describe('photo ceilings', () => {
  it('permits exact limits and rejects overflow and invalid reservations', () => {
    for (const limit of Object.values(PHOTO_LIMITS)) {
      expect(fits(limit - 1, 1, limit)).toBe(true)
      expect(fits(limit, 1, limit)).toBe(false)
      expect(fits(0, -1, limit)).toBe(false)
      expect(fits(0, NaN, limit)).toBe(false)
    }
  })
  it('rolls months and years at UTC midnight', () => {
    expect(photoMonth(new Date('2026-12-31T23:59:59Z'))).toEqual({ month: '2026-12', resetsAt: '2027-01-01T00:00:00.000Z' })
    expect(photoMonth(new Date('2027-01-01T00:00:00Z')).month).toBe('2027-01')
    expect(photoMonth(new Date('2028-02-29T23:00:00-02:00')).month).toBe('2028-03')
  })
})
