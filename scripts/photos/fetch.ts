// Publishes reviewed photo candidates: downloads a 1600px image and a 480px thumbnail for each accepted candidate
// (Commons resizes on its side) into public/photos/<bywayId>/ and merges credited entries into content/photos.json.
// Candidates come from scripts/photos/discover.ts; anything listed in data/photos/rejected.json (with a reason) is skipped.
// Usage: npx tsx scripts/photos/fetch.ts
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { Photo } from '../../src/lib/types.ts'
import { splitPhotos } from './split.ts'

const ROOT = new URL('../../', import.meta.url)
const UA = {
  'User-Agent':
    'Rambleroo/0.1 (scenic byway catalog; personal project; https://rambleroo.app; https://github.com/raynbowy23/rambleroo/issues) node-fetch',
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Candidate {
  /** commons-search: picked by hand from a wider Commons search (state chapters); the description is our own alt text. */
  source: 'wikipedia-lead' | 'nara' | 'commons-search'
  file: string
  article?: string
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
const candidates = await json<Record<string, Candidate | null>>('data/photos/candidates.json', {})
const rejected = await json<Record<string, string>>('data/photos/rejected.json', {})
const registry = await json<Photo[]>('content/photos.json', [])
const catalog = (await json<{ byways: { id: string; name: string }[] }>('public/data/catalog.json', { byways: [] })).byways
const names = new Map(catalog.map((b) => [b.id, b.name]))

async function thumbUrl(file: string, width: number): Promise<string> {
  const url =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      titles: file,
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: String(width),
    })
  for (let i = 0; i < 6; i++) {
    await sleep(600)
    const res = await fetch(url, { headers: UA })
    if (res.status === 429) {
      await sleep(15000 * (i + 1))
      continue
    }
    const d = await res.json()
    return d.query.pages[0].imageinfo[0].thumburl as string
  }
  throw new Error(`rate limited: ${file}`)
}

async function download(url: string, dest: URL) {
  for (let i = 0; i < 6; i++) {
    await sleep(400)
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

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/^file:/, '')
    .replace(/\.[a-z]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)
    .replace(/^-|-$/g, '')
/** NARA descriptions open with archive boilerplate; their file titles ("Byway - Subject - NARA - id") name the subject cleanly. */
function altText(c: Candidate, name: string) {
  if (c.source === 'nara') {
    const subject = c.file.replace(/^File:/, '').split(' - ')[1]
    return subject ? `${name}: ${subject}.` : `A view along ${name}.`
  }
  const first = c.description.replace(/\s+/g, ' ').split(/(?<=[a-z]{2}\.)\s/)[0]
  return first && first.length > 12 ? `${name}: ${first.slice(0, 160)}` : `A view along ${name}.`
}

/** Commons renders a missing author as repeated placeholder text; NARA byway photos come from the U.S. DOT, so credit the agency and the archive instead. */
function creditFor(c: Candidate) {
  const author = c.author.replace(/\s+/g, ' ').trim()
  if (!author || /unknown author/i.test(author))
    return c.source === 'nara' ? 'U.S. Department of Transportation (National Archives)' : 'Unknown author'
  return author.slice(0, 120)
}

let added = 0
for (const [bywayId, c] of Object.entries(candidates)) {
  if (!c || rejected[bywayId] || registry.some((p) => p.bywayId === bywayId)) continue
  const dir = new URL(`public/photos/${bywayId}/`, ROOT)
  await mkdir(dir, { recursive: true })
  const base = slug(c.file)
  const full = Math.min(1600, c.width)
  const height = Math.round((c.height * full) / c.width)
  try {
    await download(await thumbUrl(c.file, full), new URL(`${base}.jpg`, dir))
    await download(await thumbUrl(c.file, 480), new URL(`${base}-480.jpg`, dir))
  } catch (err) {
    console.warn(`${bywayId}: ${(err as Error).message}`)
    continue
  }
  const name = names.get(bywayId) ?? bywayId
  registry.push({
    bywayId,
    file: `/photos/${bywayId}/${base}.jpg`,
    thumb: `/photos/${bywayId}/${base}-480.jpg`,
    width: full,
    height,
    title: c.file.replace(/^File:/, ''),
    // Descriptions from Commons vary in quality; the alt text states what we can vouch for.
    alt: altText(c, name),
    author: creditFor(c),
    license: c.license,
    licenseUrl: c.licenseUrl,
    sourceUrl: c.sourceUrl,
    source: c.source,
  })
  added++
  console.log(`+ ${name}`)
  await writeFile(new URL('content/photos.json', ROOT), JSON.stringify(registry, null, 2) + '\n')
}
console.log(`${added} photos published, ${registry.length} in registry`)
await splitPhotos()
