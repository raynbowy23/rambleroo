import { expect, it } from 'vitest'
import { mergePassport, parsePassport } from './passport-transfer'
const visit = { id: 'visit', bywayId: 'road', date: '2026-01-01', createdAt: '2026-01-02T00:00:00Z', scope: 'part', note: '' }
it('merges saves by earliest date and visits by id, including duplicates in the import', () => {
  const incoming = parsePassport({ version: 1, saved: { road: '2025-01-01', other: '2026-01-01' }, visits: [visit, visit] })
  const result = mergePassport({ saved: { road: '2026-01-01' }, visits: [] }, incoming)
  expect(result.saved.road).toBe('2025-01-01')
  expect(result.savedAdded).toBe(1)
  expect(result.visitsAdded).toBe(1)
  expect(mergePassport(result, incoming).visitsAdded).toBe(0)
})
it('rejects unsupported versions and malformed visits', () => {
  expect(() => parsePassport({ version: 2, saved: {}, visits: [] })).toThrow()
  expect(() => parsePassport({ version: 1, saved: {}, visits: [{ ...visit, scope: 'maybe' }] })).toThrow()
})

it('rejects impossible calendar dates and preserves existing visits with matching ids', () => {
  expect(() => parsePassport({ version: 1, saved: {}, visits: [{ ...visit, date: '2026-02-31' }] })).toThrow()
  const current = parsePassport({ version: 1, saved: { road: '2025-01-01' }, visits: [visit] })
  const incoming = parsePassport({ version: 1, saved: { road: '2026-01-01' }, visits: [{ ...visit, note: 'duplicate' }] })
  const result = mergePassport(current, incoming)
  expect(result.saved.road).toBe('2025-01-01')
  expect(result.visits[0].note).toBe('')
  expect(result.savedAdded + result.visitsAdded).toBe(0)
})

it('imports old backups and merges saved stretches without duplicates', () => {
  expect(parsePassport({ version: 1, saved: {}, visits: [] }).savedStretches).toEqual([])
  const entry = { bywayId: 'road', stretchId: 'bay', savedAt: '2026-01-01' }
  const incoming = parsePassport({ version: 1, saved: {}, visits: [], savedStretches: [entry, entry] })
  const result = mergePassport({ saved: {}, visits: [] }, incoming)
  expect(result.savedStretches).toEqual([entry])
  expect(result.stretchesAdded).toBe(1)
  expect(mergePassport(result, incoming).stretchesAdded).toBe(0)
  expect(() => parsePassport({ version: 1, saved: {}, visits: [], savedStretches: [{ ...entry, savedAt: 'bad' }] })).toThrow()
})
