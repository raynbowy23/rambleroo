import { describe, expect, it } from 'vitest'
import { MAX_DOCUMENT_BYTES, mergeDocument, parseDocument, parsePut } from './account-data'
const date = '2026-10-04T00:00:00.000Z'
const passport = { version: 1 as const, saved: { a: date }, visits: [], savedStretches: [], postcards: [] }
const car = { model: 'coupe', body: '#ee7430', accent: 'none', accentColor: '#f5e6c8', roof: 'none', plate: 'RAMBLE' }
describe('account documents', () => {
  it('reuses passport validation and removes unknown fields', () => {
    expect(parseDocument('passport', { ...passport, evil: true })).toEqual(passport)
    expect(() => parseDocument('passport', { ...passport, saved: { a: 'yesterday' } })).toThrow()
    expect(() => parseDocument('trip', { version: 1, roads: [{ bywayId: '', addedAt: date }] })).toThrow()
  })
  it('validates base versions including new documents', () => {
    expect(parsePut('passport', { json: passport, baseUpdatedAt: null }).baseUpdatedAt).toBeNull()
    for (const baseUpdatedAt of [undefined, -1, 1.5, '1', Infinity])
      expect(() => parsePut('passport', { json: passport, baseUpdatedAt })).toThrow()
  })
  it('limits UTF-8 bytes, not character count', () => {
    expect(() => parseDocument('passport', { ...passport, extra: 'é'.repeat(MAX_DOCUMENT_BYTES / 2) })).toThrow(/256 KB/)
  })
  it('validates photo references and rejects malformed choices', () => {
    expect(parseDocument('garage', { version: 1, updatedAt: 2, car: { ...car, picture: 'private', usePicture: true } }).car).toEqual({
      ...car,
      usePicture: true,
    })
    expect(() => parseDocument('garage', { version: 1, updatedAt: 2, car: { ...car, model: 'spaceship' } })).toThrow()
    const card = { front: 'own', route: true, car: false, lettering: 'off', note: '' }
    expect(parseDocument('postcards', { version: 1, updatedAt: 2, cards: { a: { ...card, userPhotoId: 'private' } } }).cards.a).toEqual(
      card,
    )
    expect(() => parseDocument('postcards', { version: 1, updatedAt: 2, cards: { a: { ...card, note: 'a'.repeat(501) } } })).toThrow()
  })
  it('preserves valid photo references for both synced documents', () => {
    const id = '12345678-1234-4234-8234-123456789abc'
    expect(parseDocument('garage', { version: 1, updatedAt: 2, car: { ...car, picture: id, usePicture: true } }).car.picture).toBe(id)
    expect(
      parseDocument('postcards', {
        version: 1,
        updatedAt: 2,
        cards: { a: { front: 'own', route: true, car: false, lettering: 'off', note: '', userPhotoId: id } },
      }).cards.a.userPhotoId,
    ).toBe(id)
  })
  it('unions passport IDs and keeps local visit edits', () => {
    const visit = { id: 'v', bywayId: 'a', date: '2026-10-04', createdAt: date, scope: 'part' as const, note: 'local' }
    const stretch = { bywayId: 'a', stretchId: 's', savedAt: date }
    const merged = mergeDocument(
      'passport',
      { ...passport, visits: [visit], savedStretches: [stretch] },
      {
        ...passport,
        saved: { b: date },
        visits: [
          { ...visit, note: 'remote' },
          { ...visit, id: 'v2' },
        ],
        savedStretches: [stretch, { ...stretch, stretchId: 't' }],
      },
    )
    expect(Object.keys(merged.saved)).toEqual(['a', 'b'])
    expect(merged.visits.map((v) => v.id)).toEqual(['v', 'v2'])
    expect(merged.visits[0].note).toBe('local')
    expect(merged.savedStretches).toHaveLength(2)
  })
  it('keeps local trip order and appends server-only roads once', () => {
    const trip = (ids: string[]) => ({ version: 1 as const, roads: ids.map((bywayId) => ({ bywayId, addedAt: date })) })
    expect(mergeDocument('trip', trip(['b', 'a']), trip(['a', 'c', 'c'])).roads.map((r) => r.bywayId)).toEqual(['b', 'a', 'c'])
  })
  it('takes the newer whole garage or postcard document, with server winning ties', () => {
    const older = parseDocument('garage', { version: 1, updatedAt: 1, car })
    const newer = { ...older, updatedAt: 2 }
    expect(mergeDocument('garage', older, newer)).toBe(newer)
    expect(mergeDocument('garage', newer, older)).toBe(newer)
    const cards = { version: 1 as const, updatedAt: 1, cards: {} }
    expect(mergeDocument('postcards', cards, { ...cards, updatedAt: 2 }).updatedAt).toBe(2)
  })
})
