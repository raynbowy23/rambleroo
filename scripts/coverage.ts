// One row per road: what it has so far (story, photos, street frames, miniature, strip) and what it still needs.
// Usage: npx tsx scripts/coverage.ts   Writes docs/coverage.csv and prints the totals.
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { BywayStory, BywaySummary, Photo, StateChapter, StreetView } from '../src/lib/types'

const ROOT = new URL('../', import.meta.url)
const json = async <T>(rel: string): Promise<T> => JSON.parse(await readFile(new URL(rel, ROOT), 'utf8'))

const { byways } = await json<{ byways: BywaySummary[] }>('public/data/catalog.json')
const photos = await json<Photo[]>('content/photos.json')
const street = await json<StreetView[]>('content/streetview.json')
const momentFrames = await json<StreetView[]>('content/streetview-moments.json')
const stories = new Map<string, BywayStory>()
for (const f of (await readdir(new URL('content/stories/', ROOT))).filter((f) => f.endsWith('.json')))
  stories.set(f.replace(/\.json$/, ''), await json<BywayStory>(`content/stories/${f}`))
const dioramas = new Set(
  (await readdir(new URL('content/dioramas/', ROOT)))
    .filter((f) => f.endsWith('.json') && f !== 'schema.json')
    .map((f) => f.replace(/\.json$/, '')),
)
// Material a story writer would start from: the chapter blurb and the sourced facts kept for the road.
const facts = new Map<string, number>()
for (const f of (await readdir(new URL('content/states/', ROOT))).filter((f) => f.endsWith('.json'))) {
  const chapter = await json<StateChapter>(`content/states/${f}`)
  const sources = existsSync(new URL(`content/states/sources/${f}`, ROOT))
    ? await json<{ byways?: { name: string; facts?: unknown[] }[] }>(`content/states/sources/${f}`)
    : {}
  for (const program of chapter.programs)
    for (const m of program.members) {
      if (!m.bywayId) continue
      const n = sources.byways?.find((b) => b.name === m.name)?.facts?.length ?? 0
      facts.set(m.bywayId, (facts.get(m.bywayId) ?? 0) + n)
    }
}

const count = <T extends { bywayId: string }>(list: T[]) => {
  const map = new Map<string, number>()
  for (const x of list) map.set(x.bywayId, (map.get(x.bywayId) ?? 0) + 1)
  return map
}
const photoCount = count(photos),
  streetCount = count(street),
  momentCount = count(momentFrames)
const tier = (b: BywaySummary) =>
  b.nationalScenicByway || b.allAmericanRoad
    ? 'national'
    : /-98\d{4}$/.test(b.id)
      ? 'classic drive'
      : b.designations.some((d) => /state/i.test(d)) || /-99\d{4}$/.test(b.id)
        ? 'state'
        : 'other'

const header = [
  'id',
  'name',
  'states',
  'tier',
  'story',
  'source facts',
  'photos',
  'street frames',
  'moment frames',
  'miniature',
  'strip',
  'picture',
  'needs',
]
const rows = byways
  .slice()
  .sort((a, b) => a.states[0].localeCompare(b.states[0]) || a.name.localeCompare(b.name))
  .map((b) => {
    const story = stories.get(b.id)
    const p = photoCount.get(b.id) ?? 0,
      s = streetCount.get(b.id) ?? 0
    const strip = existsSync(new URL(`public/data/strips/${b.id}.json`, ROOT))
    const picture = p ? 'photo' : s ? 'street frame' : 'illustration only'
    const needs = [!story && 'story', !p && !s && 'picture', !dioramas.has(b.id) && 'miniature', !strip && 'strip'].filter(Boolean)
    return [
      b.id,
      b.name,
      b.states.join(' '),
      tier(b),
      story ? (story.reviewed ? 'reviewed' : 'draft') : 'none',
      facts.get(b.id) ?? 0,
      p,
      s,
      momentCount.get(b.id) ?? 0,
      dioramas.has(b.id) ? 'yes' : 'no',
      strip ? 'yes' : 'no',
      picture,
      needs.join(' + ') || 'complete',
    ]
  })
const cell = (v: unknown) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
await writeFile(new URL('docs/coverage.csv', ROOT), [header, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n')

const by = (i: number, v: string) => rows.filter((r) => r[i] === v).length
console.log(`${rows.length} roads`)
console.log(`story: ${by(4, 'reviewed')} reviewed, ${by(4, 'draft')} draft, ${by(4, 'none')} none`)
console.log(
  `picture: ${by(11, 'photo')} photo, ${by(11, 'street frame')} street frame only, ${by(11, 'illustration only')} illustration only`,
)
console.log(`miniature: ${by(9, 'yes')} · strip: ${by(10, 'yes')}`)
for (const t of ['national', 'state', 'classic drive', 'other'])
  console.log(
    `  ${t}: ${rows.filter((r) => r[3] === t).length} roads, ${rows.filter((r) => r[3] === t && r[4] === 'none').length} without a story`,
  )
