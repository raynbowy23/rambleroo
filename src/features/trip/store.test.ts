import { beforeEach, describe, expect, it } from 'vitest'
import { useTrip } from '../../lib/store'
import { tripTotals } from './totals'
import type { BywaySummary } from '../../lib/types'
import type { StripData } from '../strip/types'
import { parsePassport } from '../../lib/passport-transfer'
beforeEach(() => useTrip.setState({ roads: [] }))
describe('trip store', () => {
  it('adds, deduplicates, reorders and removes without changing timestamps', () => {
    const { add, move, remove } = useTrip.getState()
    add('a')
    add('b')
    add('a')
    const first = useTrip.getState().roads[0]
    expect(first.addedAt).toMatch(/^\d{4}-/)
    expect(useTrip.getState().roads).toHaveLength(2)
    move('a', -1)
    move('missing', 1)
    expect(useTrip.getState().roads[0]).toEqual(first)
    move('b', -1)
    expect(useTrip.getState().roads.map((r) => r.bywayId)).toEqual(['b', 'a'])
    move('a', 1)
    expect(useTrip.getState().roads[1]).toEqual(first)
    remove('b')
    expect(useTrip.getState().roads).toEqual([first])
  })
  it('persists a versioned data-only trip', () => {
    useTrip.getState().add('a')
    const saved = JSON.parse(localStorage.getItem('rambleroo.trip.v1')!)
    expect(saved.version).toBe(1)
    expect(Object.keys(saved.state)).toEqual(['roads'])
  })
  it('sums only known main-road times and counts missing or partial times', () => {
    const roads = ['a', 'b', 'c'].map((bywayId) => ({ bywayId, addedAt: '2026-10-01' }))
    const catalog = new Map(roads.map((r) => [r.bywayId, { mappedMiles: 10 } as BywaySummary]))
    const strip = (minutes: (number | null)[]) =>
      ({ stretches: [...minutes.map((minutes) => ({ on: 'main', minutes })), { on: 'branch', minutes: 99 }] }) as StripData
    expect(tripTotals(roads, catalog, { a: [strip([12, 18])], b: [strip([5, null])] })).toEqual({
      miles: 30,
      minutes: 35,
      missingTimes: 2,
      timedRoads: 2,
    })
    expect(tripTotals([], catalog, {})).toEqual({ miles: 0, minutes: 0, missingTimes: 0, timedRoads: 0 })
  })
  it('round trips a trip in passport backups and rejects malformed entries', () => {
    const trip = { version: 1, roads: [{ bywayId: 'a', addedAt: '2026-10-01' }] }
    expect(parsePassport({ version: 1, saved: {}, visits: [], trip }).trip).toEqual(trip)
    expect(() => parsePassport({ version: 1, saved: {}, visits: [], trip: { ...trip, roads: [{ bywayId: 'a' }] } })).toThrow(
      'Invalid trip road',
    )
  })
})
