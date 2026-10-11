// Publishes reviewed photos of towns and story moments: for each candidate in data/photos/town-candidates.json (from towns.ts) and
// data/photos/moment-candidates.json (from moments.ts) that is not listed in data/photos/rejected-towns.json or rejected-moments.json,
// downloads a 1024 px image and a 480 px thumbnail from Commons into public/photos/<bywayId>/ and adds a credited entry to
// content/photos.json, with its `town` (shown on town signs and milestone postcards) and its `moment` (shown on the road page's story)
// as they apply. A town that is also a story moment gets both. 1024 px is enough for those places and keeps the repository small. A
// photo shared by two roads is stored once and both entries point at it.
// Usage: npx tsx scripts/photos/fetch-places.ts
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { Photo } from '../../src/lib/types.ts'
import { splitPhotos } from './split.ts'

const ROOT = new URL('../../', import.meta.url)
const UA = {
  'User-Agent':
    'Rambleroo/0.1 (scenic byway catalog; personal project; https://rambleroo.app; https://github.com/raynbowy23/rambleroo/issues) node-fetch',
}
const WIDTH = 1024
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Candidate {
  source: 'wikipedia-lead' | 'commons-search'
  file: string
  width: number
  height: number
  sourceUrl: string
  license: string
  licenseUrl: string
  author: string
  description: string
}
const json = async <T>(rel: string, fallback: T): Promise<T> =>
  existsSync(new URL(rel, ROOT)) ? JSON.parse(await readFile(new URL(rel, ROOT), 'utf8')) : fallback
const towns = await json<Record<string, Candidate>>('data/photos/town-candidates.json', {})
const moments = await json<Record<string, Candidate>>('data/photos/moment-candidates.json', {})
const rejected = {
  ...(await json<Record<string, string>>('data/photos/rejected-towns.json', {})),
  ...(await json<Record<string, string>>('data/photos/rejected-moments.json', {})),
}
// Story moment titles per road, so a town photo also serves the moment of the same name.
const momentTitles = new Map<string, Set<string>>()
for (const f of await readdir(new URL('content/stories/', ROOT)))
  if (f.endsWith('.json')) {
    const story = JSON.parse(await readFile(new URL(`content/stories/${f}`, ROOT), 'utf8'))
    momentTitles.set(story.id, new Set(story.moments.map((m: { title: string }) => m.title)))
  }
const registry = await json<Photo[]>('content/photos.json', [])

async function commons(params: Record<string, string>) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ format: 'json', formatversion: '2', ...params })
  for (let i = 0; i < 6; i++) {
    await sleep(300)
    const res = await fetch(url, { headers: UA })
    if (res.status === 429) {
      await sleep(15000 * (i + 1))
      continue
    }
    return res.json()
  }
  throw new Error('rate limited')
}
async function download(url: string, dest: URL) {
  for (let i = 0; i < 6; i++) {
    await sleep(250)
    const res = await fetch(url, { headers: UA })
    if (res.status === 429) {
      await sleep(15000 * (i + 1))
      continue
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    await writeFile(dest, Buffer.from(await res.arrayBuffer()))
    return
  }
  throw new Error(`rate limited: ${url}`)
}
const thumbUrl = async (file: string, width: number) =>
  (await commons({ action: 'query', titles: file, prop: 'imageinfo', iiprop: 'url', iiurlwidth: String(width) })).query.pages[0]
    .imageinfo[0].thumburl as string

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 50)
    .replace(/^-|-$/g, '')
/** The first sentence of the Commons description when it says something, else a plain line; the reviewer saw every picture. */
function altText(c: Candidate, name: string, isTown: boolean) {
  const first = c.description
    .replace(/\s+/g, ' ')
    .split(/(?<=[a-z]{2}\.)\s/)[0]
    .slice(0, 180)
  const said =
    first.length > 25 && !/^(own work|photo|image|picture|taken|uploaded|img|dsc)/i.test(first) && !/https?:|\.jpe?g/i.test(first)
  return said
    ? first.endsWith('.')
      ? first
      : first + '.'
    : isTown
      ? `A view of ${name}, a town along the drive.`
      : `A view of ${name}, a stop along the drive.`
}
const credit = (author: string) => {
  const a = author.replace(/\s+/g, ' ').trim()
  return !a || /unknown author/i.test(a) ? 'Unknown author' : a.slice(0, 120)
}

const stored = new Map<string, { file: string; thumb: string; width: number; height: number }>()
for (const p of registry) if (p.town || p.moment) stored.set(p.title, { file: p.file, thumb: p.thumb, width: p.width, height: p.height })
let added = 0
const used = new Set(registry.map((p) => p.file))
const entries = [
  ...Object.entries(towns).map(([key, c]) => {
    const [bywayId, town] = key.split('#')
    return { key, c, bywayId, name: town, town, moment: momentTitles.get(bywayId)?.has(town) ? town : undefined }
  }),
  ...Object.entries(moments).map(([key, c]) => {
    const [bywayId, moment] = [key.slice(0, key.indexOf('@')), key.slice(key.indexOf('@') + 1)]
    return { key, c, bywayId, name: moment, town: undefined, moment }
  }),
]
for (const { key, c, bywayId, name, town, moment } of entries) {
  if (rejected[key]) continue
  if (registry.some((p) => p.bywayId === bywayId && ((town && p.town === town) || (!town && p.moment === moment)))) continue
  const title = c.file.replace(/^File:/, '')
  let place = stored.get(title)
  if (!place) {
    const dir = new URL(`public/photos/${bywayId}/`, ROOT)
    await mkdir(dir, { recursive: true })
    // Two places whose names shorten to the same slug get numbered files rather than overwriting each other.
    let base = `${town ? 'town' : 'place'}-${slug(name)}`
    for (let n = 2; used.has(`/photos/${bywayId}/${base}.jpg`); n++) base = `${town ? 'town' : 'place'}-${slug(name)}-${n}`
    const width = Math.min(WIDTH, c.width)
    try {
      await download(await thumbUrl(c.file, width), new URL(`${base}.jpg`, dir))
      await download(await thumbUrl(c.file, 480), new URL(`${base}-480.jpg`, dir))
    } catch (err) {
      console.warn(`${key}: ${(err as Error).message}`)
      continue
    }
    place = {
      file: `/photos/${bywayId}/${base}.jpg`,
      thumb: `/photos/${bywayId}/${base}-480.jpg`,
      width,
      height: Math.round((c.height * width) / c.width),
    }
    stored.set(title, place)
    used.add(place.file)
  }
  registry.push({
    bywayId,
    ...(town ? { town } : {}),
    ...(moment ? { moment } : {}),
    ...place,
    title,
    alt: altText(c, name, Boolean(town)),
    author: credit(c.author),
    license: c.license,
    licenseUrl: c.licenseUrl,
    sourceUrl: c.sourceUrl,
    source: c.source,
  })
  added++
  if (added % 100 === 0) {
    console.log(`${added} photos`)
    await writeFile(new URL('content/photos.json', ROOT), JSON.stringify(registry, null, 2) + '\n')
  }
}
await writeFile(new URL('content/photos.json', ROOT), JSON.stringify(registry, null, 2) + '\n')
await splitPhotos()
console.log(`${added} town and place photos published, ${registry.length} in registry`)
