import { describe, expect, it } from 'vitest'
import { buildSnapshot, createShareSlug, parseShareRequest } from './shares'

const passport = {
  version: 1,
  saved: { saved: '2026-10-04' },
  name: 'Secret name',
  email: 'secret@example.test',
  photos: ['private.jpg'],
  visits: [
    {
      id: 'private-id',
      bywayId: 'visited',
      date: '2026-10-03',
      createdAt: '2026-10-04',
      scope: 'part',
      note: 'Private note',
      photo: 'private.jpg',
    },
  ],
  savedStretches: [{ bywayId: 'stretch-only', stretchId: 'private-stretch', savedAt: '2026-10-04' }],
  postcards: [{ bywayId: 'card-only', milestoneId: 'private-card', keptAt: '2026-10-04' }],
}
describe('share snapshots', () => {
  it('allowlists passport fields and omits notes by default', () => {
    expect(buildSnapshot(parseShareRequest({ kind: 'passport', title: ' My roads ' }), passport)).toEqual({
      kind: 'passport',
      title: 'My roads',
      roads: ['saved', 'visited'],
      saved: ['saved'],
      visits: [{ bywayId: 'visited', date: '2026-10-03' }],
    })
  })
  it('includes only visit notes when opted in', () => {
    const snapshot = buildSnapshot(parseShareRequest({ kind: 'passport', includeNotes: true }), passport)
    expect(snapshot.visits).toEqual([{ bywayId: 'visited', date: '2026-10-03', note: 'Private note' }])
    expect(JSON.stringify(snapshot)).not.toMatch(/Secret name|secret@|private.jpg|private-id|private-stretch|private-card/)
  })
  it('preserves trip order without timestamps or personal fields', () => {
    expect(
      buildSnapshot(parseShareRequest({ kind: 'trip', includeNotes: true }), {
        version: 1,
        name: 'private',
        roads: [
          { bywayId: 'b', addedAt: '2026-10-04', note: 'private' },
          { bywayId: 'a', addedAt: '2026-10-03', photo: 'private' },
        ],
      }),
    ).toEqual({ kind: 'trip', roads: ['b', 'a'] })
  })
  it('rejects empty documents, invalid requests, and snapshots over 64 KB in UTF-8', () => {
    expect(() => buildSnapshot(parseShareRequest({ kind: 'trip' }), { version: 1, roads: [] })).toThrow(/Add a road/)
    expect(() => buildSnapshot(parseShareRequest({ kind: 'passport' }), { version: 1, saved: {}, visits: [] })).toThrow(/Add a road/)
    for (const value of [
      { kind: 'garage' },
      { kind: ['trip'] },
      { kind: 'trip', title: 2 },
      { kind: 'trip', title: 'a'.repeat(201) },
      { kind: 'passport', includeNotes: 'yes' },
    ])
      expect(() => parseShareRequest(value)).toThrow()
    expect(() =>
      buildSnapshot(parseShareRequest({ kind: 'passport', includeNotes: true }), {
        ...passport,
        visits: Array.from({ length: 50 }, (_, i) => ({ ...passport.visits[0], id: String(i), note: '旅'.repeat(500) })),
      }),
    ).toThrow(/64 KB/)
  })
  it('uses distinct random URL-safe slugs', () => {
    const slugs = Array.from({ length: 100 }, createShareSlug)
    expect(new Set(slugs).size).toBe(100)
    for (const slug of slugs) expect(slug).toMatch(/^[A-Za-z0-9_-]{18}$/)
  })
})
