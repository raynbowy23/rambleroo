// Data-quality gate for the published display data and hand-written content. Runs under `npm test`.
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { inferThemes, pickScene, slugify, hashSeed } from './classify'
import { lookKey, visibleKey } from './looks'
import type { BywaySummary, BywayStory, Collection, StateChapter } from '../../src/lib/types'

import { stateSources } from '../states/sources'
import { stateFips } from '../states/fips'

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

describe('postcard looks', () => {
  it('gives every byway a distinct look', () => {
    expect(new Set(catalog.byways.map((b) => lookKey(b.look))).size).toBe(catalog.byways.length)
  })
  it('keeps the visible dimensions distinct within each region and scene family', () => {
    const groups = new Map<string, string[]>()
    for (const b of catalog.byways)
      groups.set(`${b.region}|${b.scene}`, [...(groups.get(`${b.region}|${b.scene}`) ?? []), visibleKey(b.look)])
    for (const [group, keys] of groups) expect(new Set(keys).size, group).toBe(keys.length)
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
  const chapterFiles = readdirSync(new URL('content/states/', root)).filter((file) => file.endsWith('.json'))
  it.each(chapterFiles)('chapter %s has valid members and HTTPS links', (file) => {
    const chapter = json<StateChapter>(`content/states/${file}`)
    expect(file).toBe(`${chapter.code}.json`)
    expect(stateFips[chapter.code]).toBeDefined()
    const ids = new Set<string>()
    const names = new Set<string>()
    for (const member of chapter.programs.flatMap((program) => program.members)) {
      const name = member.name.trim().toLowerCase()
      expect(names.has(name), `${file}: duplicate ${member.name}`).toBe(false)
      names.add(name)
      if (member.bywayId) {
        expect(byId.get(member.bywayId)?.states, member.bywayId).toContain(chapter.code)
        expect(ids.has(member.bywayId), `${file}: duplicate ${member.bywayId}`).toBe(false)
        ids.add(member.bywayId)
      } else expect(member.note).toBeTruthy()
      if (member.url !== undefined) expect(new URL(member.url).protocol).toBe('https:')
    }
    for (const source of chapter.sources) expect(new URL(source.url).protocol).toBe('https:')
  })
  it('state sources have HTTPS layers and unique IDs using their state FIPS code', () => {
    const states = new Set<string>()
    const ids = new Set<number>()
    for (const source of stateSources) {
      expect(states.has(source.state)).toBe(false)
      states.add(source.state)
      expect(stateFips[source.state], source.state).toBeDefined()
      expect(new URL(source.layer).protocol).toBe('https:')
      expect(source.nameField).toMatch(/^[A-Za-z_][A-Za-z0-9_]*$/)
      for (const byway of source.byways) {
        expect(Number.isInteger(byway.id)).toBe(true)
        expect(ids.has(byway.id), `duplicate ${byway.id}`).toBe(false)
        ids.add(byway.id)
        const legacy = source.state === 'WI' && [990001, 990002].includes(byway.id)
        if (legacy) expect(source.comment).toContain('legacy')
        else {
          expect(String(byway.id)).toMatch(new RegExp(`^99${stateFips[source.state]}[0-9]{2}$`))
          expect(byway.id % 100).toBeGreaterThan(0)
        }
      }
    }
  })
})

describe('photos', () => {
  const photos = json<import('../../src/lib/types').Photo[]>('content/photos.json')
  const allowed = /^(CC0|Public domain|CC BY(-SA)? [0-9.]+)$/i
  it.each(photos.map((p) => [p.file, p] as const))('%s is licensed, credited, present, and tied to a real story moment', (_, p) => {
    expect(allowed.test(p.license), p.license).toBe(true)
    expect(p.author).toBeTruthy()
    expect(p.alt.length).toBeGreaterThan(20)
    expect(p.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\//)
    expect(p.licenseUrl).toMatch(/^https?:\/\//)
    expect(existsSync(new URL(`public${p.file}`, root))).toBe(true)
    expect(byId.has(p.bywayId)).toBe(true)
    if (p.town) {
      const strip = json<{ towns: { name: string }[] }>(`content/strips/${p.bywayId}.json`)
      expect(strip.towns.map((t) => t.name)).toContain(p.town)
    }
    if (p.moment) {
      const story = json<BywayStory>(`content/stories/${p.bywayId}.json`)
      expect(story.moments.map((m) => m.title)).toContain(p.moment)
    }
  })
})

describe('photo credits', () => {
  it('never publish placeholder or run-together author text', () => {
    for (const p of json<import('../../src/lib/types').Photo[]>('content/photos.json')) {
      expect(p.author, p.file).not.toMatch(/unknown author.*unknown author|not provided/i)
      expect(p.author.length, p.file).toBeLessThanOrEqual(120)
    }
  })
})

describe('overrides', () => {
  // A scene that the illustrations don't know crashes every page that draws the road (a theme like "countryside" is not a scene).
  it('use only known scenes and themes', () => {
    const scenes = ['river', 'coast', 'mountain', 'forest', 'desert', 'town', 'prairie']
    const themes = ['water', 'coast', 'mountain', 'forest', 'desert', 'historic', 'countryside']
    const overrides = JSON.parse(readFileSync(new URL('content/overrides.json', root), 'utf8')) as Record<string, unknown>
    for (const [id, value] of Object.entries(overrides)) {
      if (id.startsWith('_') || typeof value !== 'object' || !value) continue
      const { scene, themes: own } = value as { scene?: string; themes?: string[] }
      if (scene) expect(scenes, `${id} scene`).toContain(scene)
      for (const theme of own ?? []) expect(themes, `${id} theme`).toContain(theme)
    }
  })
})

describe('street-level frames', () => {
  const road = json<import('../../src/lib/types').StreetView[]>('content/streetview.json')
  const moments = json<import('../../src/lib/types').StreetView[]>('content/streetview-moments.json')
  const rejects = json<{ moments: { bywayId: string; moment: string }[]; images: { id: string }[] }>('scripts/streetview/rejects.json')
  const ids = new Set(json<{ byways: BywaySummary[] }>('public/data/catalog.json').byways.map((b) => b.id))
  it('point at real roads, at most three per road, with no rejected frame', () => {
    const refused = new Set(rejects.images.map((r) => r.id))
    const perRoad = new Map<string, number>()
    for (const v of [...road, ...moments]) {
      expect(ids.has(v.bywayId), v.bywayId).toBe(true)
      expect(v.id, v.bywayId).toMatch(/^\d{1,24}$/)
      expect(refused.has(v.id), `${v.bywayId} ${v.id}`).toBe(false)
      expect(v.captured).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
    for (const v of road) perRoad.set(v.bywayId, (perRoad.get(v.bywayId) ?? 0) + 1)
    for (const [id, n] of perRoad) expect(n, id).toBeLessThanOrEqual(3)
  })
  it('only put moment frames on roadside and town moments that exist and were not turned down', () => {
    const stories = new Map(
      readdirSync(new URL('content/stories/', root))
        .filter((f) => f.endsWith('.json'))
        .map((f) => json<BywayStory>(`content/stories/${f}`))
        .map((s) => [s.id, s] as const),
    )
    const refused = new Set(rejects.moments.map((r) => `${r.bywayId}|${r.moment}`))
    for (const v of moments) {
      const m = stories.get(v.bywayId)?.moments.find((x) => x.title === v.moment)
      expect(m, `${v.bywayId} · ${v.moment}`).toBeDefined()
      expect(['roadside', 'town']).toContain(m!.kind)
      expect(refused.has(`${v.bywayId}|${v.moment}`)).toBe(false)
    }
  })
})
