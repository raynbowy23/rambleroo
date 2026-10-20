// Gathers candidate photos for each story moment that has none, for review on a contact sheet. A moment is mostly a landmark, so a
// photo has to show the landmark itself, not merely be taken nearby: every candidate names it (in its file name, description or Commons
// category), and a geotagged one must sit within reach of the landmark's own position (its Wikipedia article's coordinates, else the
// moment's point). Sources, best first:
//   1. the photo library (content/photos.json): a photo of this road, or of another road through the same place, that names it;
//   2. the lead image of the landmark's Wikipedia article (an article titled exactly as the moment needs no coordinates);
//   3. the landmark's own Commons category;
//   4. a Commons search for the landmark's name.
// Earlier rejections (data/photos/rejected-moments.json) do not stop a moment from being searched again: they rejected one picture.
// Nothing is published. It writes data/photos/landmarks/candidates.json keyed "<bywayId>@<moment title>", resuming where it stopped.
// Usage: npx tsx scripts/photos/landmarks.ts [bywayId ...]
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { Photo } from '../../src/lib/types.ts'

const ROOT = new URL('../../', import.meta.url)
const DIR = new URL('data/photos/landmarks/', ROOT)
const OUT = new URL('candidates.json', DIR)
const UA = {
  'User-Agent':
    'Rambleroo/0.1 (scenic byway catalog; personal project; https://rambleroo.app; https://github.com/raynbowy23/rambleroo/issues) node-fetch',
}
const FREE = /^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+)/i
const NOT_A_VIEW =
  /(map|shield|sign|logo|marker|locator|location|route[_ ]?\d|\.svg$|seal|flag|diagram|plan|emblem|census|grave|tombstone|headstone|plaque|interior|portrait)/i
/** Words too common to show that a picture is of this place. */
const GENERIC = new Set(
  'national state park river lake creek falls bridge historic museum county scenic overlook trail forest center centre highway road mountain mount island beach point bay harbor harbour church house hall site area monument memorial wildlife refuge valley canyon city town village north south east west upper lower lodge visitor springs spring fort the and of at on in old new'.split(
    ' ',
  ),
)
/** A large natural place is photographed from farther off than a building or a bridge. */
const WIDE =
  /\b(lake|lakes|canyon|park|forest|river|mountains?|wilderness|gorge|valley|bay|island|beach|range|reservoir|desert|dunes|prairie|preserve|bluffs?|gulf|sound|basin|recreation area|national)\b/i
const reachKm = (title: string, kind?: string) => (WIDE.test(title) ? 8 : kind === 'town' ? 5 : 2)
const PER_SOURCE = { library: 4, category: 5, search: 4 }
const MAX = 11

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function api(host: string, params: Record<string, string>) {
  const url = `https://${host}/w/api.php?` + new URLSearchParams({ format: 'json', formatversion: '2', ...params })
  for (let i = 0; i < 6; i++) {
    await sleep(300)
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
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
/** Lowercase words: "ChainOfRocksBridge_StLouisMO.jpg" reads "chain of rocks bridge st louis mo jpg". */
const norm = (s: string) =>
  s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
/** The name part of a moment or article title: "Breckenridge, Minnesota" and "Fort Snelling (Minnesota)" give their first part. */
const core = (title: string) => norm(title.split(',')[0].replace(/\(.*?\)/g, '')).replace(/^the /, '')
/** Whether a text names the landmark: its whole name, or every distinctive word of it. */
function namesIt(text: string, title: string) {
  const t = ` ${norm(text)} `,
    c = core(title)
  if (!c) return false
  if (t.includes(` ${c} `)) return true
  const words = c.split(' ').filter((w) => w.length >= 3 && !GENERIC.has(w))
  return words.length > 0 && words.every((w) => t.includes(` ${w} `))
}
const km = (a: number[], b: number[]) => {
  const rad = Math.PI / 180,
    dLat = (b[1] - a[1]) * rad,
    dLon = (b[0] - a[0]) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}
const inside = (p: number[], b: number[], pad = 0.3) => p[0] >= b[0] - pad && p[0] <= b[2] + pad && p[1] >= b[1] - pad && p[1] <= b[3] + pad

export interface Candidate {
  source: 'library' | 'wikipedia-lead' | 'commons-category' | 'commons-search'
  /** Commons "File:…" title, or for a library photo its title as stored. */
  file: string
  width: number
  height: number
  thumb: string
  sourceUrl: string
  license: string
  licenseUrl: string
  author: string
  description: string
  /** Kilometres from the landmark when the photo is geotagged and the landmark's position is known. */
  km?: number
  /** For a library photo: its file path and the road it is stored with. */
  libraryFile?: string
  libraryRoad?: string
}
export interface Landmark {
  bywayId: string
  moment: string
  kind?: string
  state: string
  at?: number[]
  /** The Wikipedia article taken to be the landmark's, and where it puts it. */
  article?: string
  landmarkAt?: number[]
  candidates: Candidate[]
}

const photos = JSON.parse(await readFile(new URL('content/photos.json', ROOT), 'utf8')) as Photo[]
const have = new Set(photos.filter((p) => p.moment).map((p) => `${p.bywayId}@${p.moment}`))
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

const only = process.argv.slice(2)
const todo: Omit<Landmark, 'candidates'>[] = []
for (const f of (await readdir(new URL('content/stories/', ROOT))).sort()) {
  if (!f.endsWith('.json')) continue
  const story = JSON.parse(await readFile(new URL(`content/stories/${f}`, ROOT), 'utf8'))
  const road = roads.get(story.id)
  if (!road || (only.length && !only.includes(story.id))) continue
  for (const m of story.moments ?? [])
    if (!have.has(`${story.id}@${m.title}`))
      todo.push({ bywayId: story.id, moment: m.title, kind: m.kind, at: m.at, state: stateNames.get(road.states[0]) ?? '' })
}
console.log(`${todo.length} story moments without a photo`)

/** Image facts for up to 50 Commons files, keeping free JPEGs at least 800 px wide that are not maps, signs or the like. */
async function commonsInfo(files: string[]) {
  const out = new Map<string, Candidate & { at?: number[]; text: string }>()
  const wanted = [...new Set(files)].filter((f) => !NOT_A_VIEW.test(f))
  for (let i = 0; i < wanted.length; i += 50) {
    const d = await api('commons.wikimedia.org', {
      action: 'query',
      titles: wanted.slice(i, i + 50).join('|'),
      prop: 'imageinfo|coordinates',
      iiprop: 'url|size|mime|extmetadata',
      iiurlwidth: '480',
    })
    for (const p of d.query?.pages ?? []) {
      const ii = p.imageinfo?.[0]
      if (!ii || ii.mime !== 'image/jpeg' || ii.width < 800) continue
      const m = ii.extmetadata ?? {}
      const license = strip(m.LicenseShortName?.value)
      if (!FREE.test(license)) continue
      const c = p.coordinates?.[0]
      const description = strip(m.ImageDescription?.value).slice(0, 300)
      out.set(p.title, {
        source: 'commons-search',
        file: p.title,
        width: ii.width,
        height: ii.height,
        thumb: ii.thumburl,
        sourceUrl: ii.descriptionurl,
        license,
        licenseUrl: strip(m.LicenseUrl?.value) || ii.descriptionurl,
        author: strip(m.Artist?.value) || 'Unknown author',
        description,
        at: c ? [c.lon, c.lat] : undefined,
        text: `${p.title} ${description} ${strip(m.ObjectName?.value)} ${strip(m.Categories?.value).replace(/\|/g, ' ')}`,
      })
    }
  }
  return out
}

const out: Record<string, Landmark> = existsSync(OUT) ? JSON.parse(await readFile(OUT, 'utf8')) : {}
await mkdir(DIR, { recursive: true })
let n = 0,
  found = 0
for (const place of todo) {
  const key = `${place.bywayId}@${place.moment}`
  if (out[key]) continue
  const road = roads.get(place.bywayId)!
  const name = core(place.moment)
  const reach = reachKm(place.moment, place.kind)

  // The landmark's Wikipedia article: its title names the moment, and its coordinates (when it has them) sit by the moment's point or
  // in the road's bounds. An article without coordinates counts only when its title is the moment's name exactly.
  // Searched with each of the road's states in turn (a road through four states names its landmark with one of them), then alone.
  type Page = { index: number; title: string; pageimage?: string; coordinates?: { lat: number; lon: number }[] }
  const isIt = (p: Page) => {
    const a = core(p.title)
    const exact = a === name
    const [short, long] = a.length < name.length ? [a, name] : [name, a]
    if (!exact && !(short.split(' ').length >= 2 && long.startsWith(short))) return false
    const c = p.coordinates?.[0]
    if (!c) return exact
    return place.at ? km(place.at, [c.lon, c.lat]) <= 15 : inside([c.lon, c.lat], road.bbox)
  }
  let article: Page | undefined
  for (const state of [...road.states.slice(0, 4).map((s) => stateNames.get(s) ?? ''), '']) {
    const w = await api('en.wikipedia.org', {
      action: 'query',
      generator: 'search',
      gsrsearch: `${place.moment.split(',')[0]} ${state}`.trim(),
      gsrlimit: '5',
      prop: 'pageimages|coordinates',
      piprop: 'name',
    })
    article = ((w.query?.pages ?? []) as Page[]).sort((a, b) => a.index - b.index).find(isIt)
    if (article) break
  }
  const ac = article?.coordinates?.[0]
  const landmarkAt = ac ? [ac.lon, ac.lat] : place.at

  /** A geotagged picture must sit by the landmark; without the landmark's position, inside the road's bounds. */
  const near = (at?: number[]) => (!at ? true : landmarkAt ? km(landmarkAt, at) <= reach : inside(at, road.bbox))
  const distance = (at?: number[]) => (at && landmarkAt ? Math.round(km(landmarkAt, at) * 100) / 100 : undefined)

  const candidates: Candidate[] = []
  const seen = new Set<string>()
  // At most two shots of one series ("Ame05321 02.jpg", "Ame05321 03.jpg"), so the sheet offers different views.
  const series = new Map<string, number>()
  const add = (c: Candidate) => {
    const id = c.file.replace(/^File:/, '')
    const run = norm(id.replace(/\.[a-z]+$/i, '')).replace(/[\s\d]+$/, '')
    if (seen.has(id) || candidates.length >= MAX || (series.get(run) ?? 0) >= 2) return false
    seen.add(id)
    series.set(run, (series.get(run) ?? 0) + 1)
    candidates.push(c)
    return true
  }

  // 1. The library: a photo that names the landmark, on this road (and not already another moment's) or on a road through the spot.
  const library = photos.filter((p) => {
    if (!namesIt(`${p.title} ${p.alt}`, place.moment)) return false
    if (p.bywayId === place.bywayId) return !p.moment
    const other = roads.get(p.bywayId)
    return other ? (landmarkAt ? inside(landmarkAt, other.bbox, 0.05) : other.states.some((s) => road.states.includes(s))) : false
  })
  for (const p of library.slice(0, PER_SOURCE.library))
    add({
      source: 'library',
      file: p.title,
      width: p.width,
      height: p.height,
      thumb: p.thumb ?? p.file,
      sourceUrl: p.sourceUrl,
      license: p.license,
      licenseUrl: p.licenseUrl,
      author: p.author,
      description: p.alt,
      libraryFile: p.file,
      libraryRoad: p.bywayId,
    })

  // 2. The article's lead image.
  if (article?.pageimage) {
    const lead = [...(await commonsInfo([`File:${article.pageimage.replace(/_/g, ' ')}`])).values()][0]
    if (lead && near(lead.at)) add({ ...lead, source: 'wikipedia-lead', km: distance(lead.at) })
  }

  // 3. The landmark's own Commons category: belonging to it names the landmark.
  for (const cat of [...new Set([article?.title, place.moment.split(',')[0]].filter(Boolean))]) {
    const c = await api('commons.wikimedia.org', {
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${cat}`,
      cmtype: 'file',
      cmlimit: '60',
    })
    const files = (c.query?.categorymembers ?? []).map((x: { title: string }) => x.title)
    if (!files.length) continue
    const info = [...(await commonsInfo(files)).values()]
      .filter((x) => near(x.at))
      // Pictures that name the landmark in their own words first, then the larger ones.
      .sort((a, b) => Number(namesIt(b.text, place.moment)) - Number(namesIt(a.text, place.moment)) || b.width - a.width)
    let taken = 0
    for (const x of info) if (taken < PER_SOURCE.category && add({ ...x, source: 'commons-category', km: distance(x.at) })) taken++
    break
  }

  // 4. A Commons search for the name. A hit has to name the landmark; one without a geotag also has to name the state, unless the
  // landmark's name is distinctive enough on its own (three or more distinctive words).
  const s = await api('commons.wikimedia.org', {
    action: 'query',
    list: 'search',
    srnamespace: '6',
    srsearch: `"${place.moment.split(',')[0].replace(/"/g, '')}"`,
    srlimit: '40',
  })
  const hits = (s.query?.search ?? []).map((x: { title: string }) => x.title)
  const distinctive = name.split(' ').filter((x) => x.length >= 3 && !GENERIC.has(x)).length >= 3
  const info = [...(await commonsInfo(hits)).values()]
    .filter((x) => namesIt(x.text, place.moment) && near(x.at) && (x.at || distinctive || norm(x.text).includes(norm(place.state))))
    .sort((a, b) => Number(Boolean(b.at)) - Number(Boolean(a.at)) || b.width - a.width)
  let taken = 0
  for (const x of info) if (taken < PER_SOURCE.search && add({ ...x, source: 'commons-search', km: distance(x.at) })) taken++

  // Keep only the fields the sheet and the apply step use.
  out[key] = {
    ...place,
    article: article?.title,
    landmarkAt,
    candidates: candidates.map(({ text: _t, at: _a, ...c }: Candidate & { text?: string; at?: number[] }) => c),
  }
  if (candidates.length) found++
  if (++n % 25 === 0) {
    console.log(`  ${n}/${todo.length}, ${found} with candidates`)
    await writeFile(OUT, JSON.stringify(out, null, 1))
  }
}
await writeFile(OUT, JSON.stringify(out, null, 1))
const done = todo.filter((p) => out[`${p.bywayId}@${p.moment}`])
console.log(`\n${done.filter((p) => out[`${p.bywayId}@${p.moment}`].candidates.length).length} of ${done.length} moments have candidates`)
