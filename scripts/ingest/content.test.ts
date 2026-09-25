// Data-quality gate for the published display data and hand-written content. Runs under `npm test`.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { inferThemes, pickScene, slugify, hashSeed } from './classify'
import type { BywaySummary, BywayStory, Collection } from '../../src/lib/types'

const root = new URL('../../', import.meta.url)
const json = <T>(rel: string): T => JSON.parse(readFileSync(new URL(rel, root), 'utf8'))

const catalog = json<{ meta: { bywayCount: number; storyCount: number }; byways: BywaySummary[] }>('public/data/catalog.json')
const lines = json<{ features: { properties: { id: string }; geometry: { type: string; coordinates: number[][][] } }[] }>(
  'public/data/byways.geojson',
)
const byId = new Map(catalog.byways.map((b) => [b.id, b]))

describe('classify', () => {
  it('slugifies names into stable url-safe ids', () => {
    expect(slugify("Crowley's Ridge Parkway")).toBe('crowley-s-ridge-parkway')
    expect(slugify('Trail Ridge Road/Beaver Meadow Road')).toBe('trail-ridge-road-beaver-meadow-road')
    expect(slugify('Scenic & Historic')).toBe('scenic-and-historic')
  })
  it('hashes deterministically', () => {
    expect(hashSeed('great-river-road-2279')).toBe(hashSeed('great-river-road-2279'))
    expect(hashSeed('a')).not.toBe(hashSeed('b'))
  })
  it('infers themes from names and falls back to countryside', () => {
    expect(inferThemes('Lake Superior Drive', [], ['MN'], false)).toContain('water')
    expect(inferThemes('Some Road', [], ['OH'], false)).toEqual(['countryside'])
    expect(pickScene(['water', 'coast'], 'x')).toBe('coast')
  })
})

describe('catalog', () => {
  it('has unique ids and matching line features', () => {
    expect(byId.size).toBe(catalog.byways.length)
    expect(catalog.meta.bywayCount).toBe(catalog.byways.length)
    expect(lines.features.map((f) => f.properties.id).sort()).toEqual([...byId.keys()].sort())
  })
  it('keeps geometry in WGS84 lng/lat order within US extents', () => {
    for (const b of catalog.byways) {
      const [w, s, e, n] = b.bbox
      expect(w).toBeGreaterThanOrEqual(-180)
      expect(e).toBeLessThanOrEqual(-60)
      expect(s).toBeGreaterThanOrEqual(17)
      expect(n).toBeLessThanOrEqual(72)
      expect(w).toBeLessThanOrEqual(e)
    }
  })
  it('never draws a line part with fewer than two points', () => {
    for (const f of lines.features) for (const part of f.geometry.coordinates) expect(part.length).toBeGreaterThanOrEqual(2)
  })
  it('assigns most multi-state mileage to a listed state', () => {
    const grr = byId.get('great-river-road-2279')!
    expect(grr.states).toContain('WI')
    expect(grr.stateMiles?.WI).toBeGreaterThan(200)
    expect(grr.stateMiles?.WI).toBeLessThan(300)
  })
})

describe('content', () => {
  const storyFiles = readdirSync(new URL('content/stories/', root)).filter((f) => f.endsWith('.json'))
  it.each(storyFiles)('story %s references a catalog byway and is honest about review', (file) => {
    const story = json<BywayStory>(`content/stories/${file}`)
    expect(file).toBe(`${story.id}.json`)
    expect(byId.has(story.id)).toBe(true)
    expect(byId.get(story.id)!.status).toBe(story.reviewed ? 'curated-story' : 'draft-story')
    expect(story.sources.length).toBeGreaterThan(0)
    for (const m of story.moments) if (m.at) expect(m.at[0]).toBeLessThan(-60)
  })
  it('collections only reference catalog byways', () => {
    for (const c of json<Collection[]>('content/collections.json'))
      for (const id of c.bywayIds) expect(byId.has(id), `${c.slug}: ${id}`).toBe(true)
  })
  it('state chapter members are either mapped byways in that state or explicitly pending', () => {
    const wi = json<{ code: string; programs: { members: { bywayId: string | null; note?: string }[] }[] }>('content/states/WI.json')
    for (const m of wi.programs.flatMap((p) => p.members)) {
      if (m.bywayId) expect(byId.get(m.bywayId)?.states).toContain(wi.code)
      else expect(m.note).toBeTruthy()
    }
  })
})
