// Finds a photograph for each story moment that has none (for example Pipestone National Monument, Breckenridge and Noyes on the King of
// Trails). A moment that is also a town on the strip map is left to towns.ts, whose photo carries the moment too. For the rest, first
// choice is the lead image of the place's Wikipedia article, found by searching the moment's title with the road's state and accepted
// only when the article's title names the place and its coordinates sit by the moment (or inside the road's bounds); otherwise a free
// geotagged Commons photo within NEAR_M of the moment whose title or description names it. Nothing is published: it writes
// data/photos/moment-candidates.json keyed "<bywayId>@<moment title>", for review on a contact sheet before fetch-places.ts downloads them.
// Usage: npx tsx scripts/photos/moments.ts [bywayId ...]
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const ROOT = new URL('../../', import.meta.url)
const OUT = new URL('data/photos/moment-candidates.json', ROOT)
const UA = {
  'User-Agent':
    'Rambleroo/0.1 (scenic byway catalog; personal project; https://rambleroo.app; https://github.com/raynbowy23/rambleroo/issues) node-fetch',
}
const FREE = /^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+)/i
const NOT_A_VIEW =
  /(map|shield|sign|logo|marker|locator|location|route[_ ]?\d|\.svg$|seal|flag|diagram|plan|emblem|census|county|grave|tombstone|headstone|plaque|interior|portrait)/i
const NEAR_M = 800
/** How far an article's coordinates may sit from the moment's point. */
const NEAR_KM = 40
/** Words too common to show that a photo is of this place. */
const GENERIC = new Set(
  'national state park river lake creek falls bridge historic museum county scenic overlook trail forest center centre highway road mountain mount island beach point bay harbor harbour church house hall site area monument memorial wildlife refuge valley canyon city town village north south east west upper lower lodge visitor springs spring fort the and of at on in'.split(
    ' ',
  ),
)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function api(host: string, params: Record<string, string>) {
  const url = `https://${host}/w/api.php?` + new URLSearchParams({ format: 'json', formatversion: '2', ...params })
  for (let i = 0; i < 6; i++) {
    await sleep(400)
    // A dropped connection is retried like a rate limit.
    const res = await fetch(url, { headers: UA }).catch(() => null)
    if (!res) {
      await sleep(5000 * (i + 1))
      continue
    }
    if (res.status === 429) {
      await sleep(15000 * (i + 1))
      continue
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    return res.json()
  }
  throw new Error('rate limited')
}
const strip = (s?: string) =>
  (s ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const km = (a: number[], b: number[]) => {
  const rad = Math.PI / 180,
    dLat = (b[1] - a[1]) * rad,
    dLon = (b[0] - a[0]) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

interface Candidate {
  source: 'wikipedia-lead' | 'commons-search'
  article?: string
  file: string
  width: number
  height: number
  thumb: string
  sourceUrl: string
  license: string
  licenseUrl: string
  author: string
  description: string
  alternates?: Candidate[]
}

/** Image info for up to 50 files, keeping only free, landscape JPEGs at least 1000 px wide. */
async function usable(files: string[]) {
  const out = new Map<string, Candidate>()
  for (let i = 0; i < files.length; i += 50) {
    const d = await api('commons.wikimedia.org', {
      action: 'query',
      titles: files.slice(i, i + 50).join('|'),
      prop: 'imageinfo',
      iiprop: 'url|size|mime|extmetadata',
      iiurlwidth: '480',
    })
    for (const p of d.query?.pages ?? []) {
      const ii = p.imageinfo?.[0]
      if (!ii || ii.mime !== 'image/jpeg' || ii.width < 1000 || ii.width < ii.height * 1.05) continue
      const m = ii.extmetadata ?? {}
      const license = strip(m.LicenseShortName?.value)
      if (!FREE.test(license)) continue
      out.set(p.title, {
        source: 'wikipedia-lead',
        file: p.title,
        width: ii.width,
        height: ii.height,
        thumb: ii.thumburl,
        sourceUrl: ii.descriptionurl,
        license,
        licenseUrl: strip(m.LicenseUrl?.value) || ii.descriptionurl,
        author: strip(m.Artist?.value) || 'Unknown author',
        description: strip(m.ImageDescription?.value).slice(0, 240),
      })
    }
  }
  return out
}

/** Whether a Wikipedia article title names the moment: "Breckenridge, Minnesota" names "Breckenridge". */
function names(article: string, moment: string) {
  const a = norm(article.split(',')[0]),
    m = norm(moment.split(',')[0])
  if (!a || !m) return false
  if (a === m) return true
  // "Pipestone National Monument" for "Pipestone National Monument and quarries", or the other way round, when the shorter
  // one is at least two words long.
  const [short, long] = a.length < m.length ? [a, m] : [m, a]
  return short.split(' ').length >= 2 && long.startsWith(short)
}

const only = process.argv.slice(2)
const registry = JSON.parse(await readFile(new URL('content/photos.json', ROOT), 'utf8')) as { bywayId: string; moment?: string }[]
const have = new Set(registry.filter((p) => p.moment).map((p) => `${p.bywayId}@${p.moment}`))
const rejected: Record<string, string> = existsSync(new URL('data/photos/rejected-moments.json', ROOT))
  ? JSON.parse(await readFile(new URL('data/photos/rejected-moments.json', ROOT), 'utf8'))
  : {}
const catalog = JSON.parse(await readFile(new URL('public/data/catalog.json', ROOT), 'utf8')) as {
  byways: { id: string; states: string[]; bbox: number[] }[]
}
const roads = new Map(catalog.byways.map((b) => [b.id, b]))
const stateNames = new Map<string, string>()
for (const f of await readdir(new URL('content/states/', ROOT)))
  if (f.endsWith('.json')) {
    const s = JSON.parse(await readFile(new URL(`content/states/${f}`, ROOT), 'utf8'))
    stateNames.set(s.code, s.name)
  }

interface Place {
  key: string
  bywayId: string
  title: string
  at?: number[]
  bbox: number[]
  state: string
}
const places: Place[] = []
for (const f of await readdir(new URL('content/stories/', ROOT))) {
  if (!f.endsWith('.json')) continue
  const story = JSON.parse(await readFile(new URL(`content/stories/${f}`, ROOT), 'utf8'))
  const road = roads.get(story.id)
  if (!road || (only.length && !only.includes(story.id))) continue
  const stripFile = new URL(`public/data/strips/${story.id}.json`, ROOT)
  const towns = new Set(
    existsSync(stripFile) ? (JSON.parse(await readFile(stripFile, 'utf8')).towns ?? []).map((t: { name: string }) => t.name) : [],
  )
  for (const m of story.moments) {
    const key = `${story.id}@${m.title}`
    if (have.has(key) || rejected[key] || towns.has(m.title)) continue
    places.push({ key, bywayId: story.id, title: m.title, at: m.at, bbox: road.bbox, state: stateNames.get(road.states[0]) ?? '' })
  }
}
console.log(`${places.length} story moments without a photo (strip towns left to towns.ts)`)

const out: Record<string, Candidate> = existsSync(OUT) ? JSON.parse(await readFile(OUT, 'utf8')) : {}
const inside = (p: number[], b: number[], pad = 0.3) => p[0] >= b[0] - pad && p[0] <= b[2] + pad && p[1] >= b[1] - pad && p[1] <= b[3] + pad
let found = 0
for (const [n, place] of places.entries()) {
  if (out[place.key]) continue
  // 1. The Wikipedia article for the place, by search; its title must name the place and its coordinates must sit by it.
  const d = await api('en.wikipedia.org', {
    action: 'query',
    generator: 'search',
    gsrsearch: `${place.title} ${place.state}`,
    gsrlimit: '5',
    prop: 'pageimages|coordinates',
    piprop: 'name',
  })
  const pages = (
    (d.query?.pages ?? []) as { index: number; title: string; pageimage?: string; coordinates?: { lat: number; lon: number }[] }[]
  ).sort((a, b) => a.index - b.index)
  const page = pages.find((p) => {
    if (!names(p.title, place.title)) return false
    const c = p.coordinates?.[0]
    if (!c) return false
    return place.at ? km(place.at, [c.lon, c.lat]) <= NEAR_KM : inside([c.lon, c.lat], place.bbox)
  })
  if (page?.pageimage && !NOT_A_VIEW.test(page.pageimage)) {
    const file = `File:${page.pageimage.replace(/_/g, ' ')}`
    const info = (await usable([file])).get(file)
    if (info) {
      out[place.key] = { ...info, article: page.title }
      found++
    }
  }
  // 2. A geotagged Commons photo by the moment's point that names it.
  if (!out[place.key] && place.at) {
    const words = norm(place.title)
      .split(' ')
      .filter((w) => w.length >= 4 && !GENERIC.has(w))
    if (words.length) {
      const g = await api('commons.wikimedia.org', {
        action: 'query',
        list: 'geosearch',
        gsnamespace: '6',
        gscoord: `${place.at[1]}|${place.at[0]}`,
        gsradius: String(NEAR_M),
        gslimit: '40',
      })
      const titles = (g.query?.geosearch ?? []).map((x: { title: string }) => x.title).filter((t: string) => !NOT_A_VIEW.test(t))
      const info = [...(await usable(titles)).values()].filter((c) => {
        const text = norm(`${c.file} ${c.description}`)
        return words.some((w) => text.includes(w))
      })
      const best = info.sort((a, b) => b.width - a.width).slice(0, 3)
      if (best.length) {
        out[place.key] = {
          ...best[0],
          source: 'commons-search',
          alternates: best.slice(1).map((c) => ({ ...c, source: 'commons-search' as const })),
        }
        found++
      }
    }
  }
  if (n % 100 === 0) {
    console.log(`  ${n}/${places.length}, ${found} found`)
    await mkdir(new URL('data/photos/', ROOT), { recursive: true })
    await writeFile(OUT, JSON.stringify(out, null, 1))
  }
}
await mkdir(new URL('data/photos/', ROOT), { recursive: true })
await writeFile(OUT, JSON.stringify(out, null, 1))
const keys = places.filter((p) => out[p.key])
console.log(
  `\n${keys.length} of ${places.length} moments have a candidate (${keys.filter((p) => out[p.key].source === 'wikipedia-lead').length} lead images)`,
)
