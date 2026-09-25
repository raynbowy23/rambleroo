import { beforeEach, describe, expect, it, vi } from 'vitest'
import { passportCounts, usePassport, visitedBywayIds } from './passport'
import { safeStorage } from './storage'
import type { BywaySummary } from './types'
beforeEach(() => {
  localStorage.clear()
  usePassport.setState({ saved: {}, visits: [], lastStampId: null })
})
const input = { bywayId: 'river', date: '2026-09-24', scope: 'part' as const, note: 'A good afternoon' }
describe('passport', () => {
  it('toggles saves and persists timestamps', () => {
    usePassport.getState().toggleSave('river')
    expect(usePassport.getState().isSaved('river')).toBe(true)
    expect(JSON.parse(localStorage.getItem('rambleroo.passport.v1')!).state.saved.river).toMatch(/^\d{4}-/)
    usePassport.getState().toggleSave('river')
    expect(usePassport.getState().isSaved('river')).toBe(false)
  })
  it('keeps repeat visits distinct and counts states once', () => {
    const a = usePassport.getState().addVisit(input)
    const b = usePassport.getState().addVisit(input)
    expect(a.id).not.toBe(b.id)
    expect(usePassport.getState().lastStampId).toBe(b.id)
    expect(visitedBywayIds(usePassport.getState()).size).toBe(1)
    expect(passportCounts(usePassport.getState(), [{ id: 'river', states: ['WI', 'IA'] } as BywaySummary])).toEqual({
      saved: 0,
      visits: 2,
      distinctVisited: 1,
      states: 2,
    })
  })
  it('edits and deletes only the chosen visit', () => {
    const a = usePassport.getState().addVisit(input)
    const b = usePassport.getState().addVisit(input)
    usePassport.getState().updateVisit(a.id, { note: 'Changed', scope: 'whole' })
    expect(usePassport.getState().visits[0].note).toBe('Changed')
    usePassport.getState().deleteVisit(b.id)
    expect(usePassport.getState().visits).toHaveLength(1)
    expect(usePassport.getState().lastStampId).toBeNull()
  })
  it('consumes animation and does not persist it', () => {
    usePassport.getState().addVisit(input)
    expect(JSON.parse(localStorage.getItem('rambleroo.passport.v1')!).state.lastStampId).toBeUndefined()
    usePassport.getState().clearLastStamp()
    expect(usePassport.getState().lastStampId).toBeNull()
  })
  it('survives blocked browser storage', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => usePassport.getState().toggleSave('river')).not.toThrow()
    expect(usePassport.getState().isSaved('river')).toBe(true)
    spy.mockRestore()
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(safeStorage.getItem('x')).toBeNull()
    read.mockRestore()
  })
})
