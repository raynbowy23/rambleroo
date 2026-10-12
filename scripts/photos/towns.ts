// Finds a photograph for each town on the strip maps (the places a drive passes, such as Medart and Ochlockonee Bay on the Big Bend
// Scenic Byway). First choice is the lead image of the town's Wikipedia article (the strip's `source`); when that is missing, a map, a
// seal or too small, a free geotagged Commons photo taken within NEAR_M of the town's point. Nothing is published: it writes
// data/photos/town-candidates.json keyed "<bywayId>#<town>", for review on a contact sheet before fetch-places.ts downloads them.
// Usage: npx tsx scripts/photos/towns.ts [bywayId ...]
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const ROOT = new URL('../../', import.meta.url)
const OUT = new URL('data/photos/town-candidates.json', ROOT)
const UA = {
  'User-Agent':
    'Rambleroo/0.1 (scenic byway catalog; personal project; https://rambleroo.app; https://github.com/raynbowy23/rambleroo/issues) node-fetch',
}
const FREE = /^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+)/i
const NOT_A_VIEW =
  /(map|shield|sign|logo|marker|locator|location|route[_ ]?\d|\.svg$|seal|flag|diagram|plan|emblem|census|county|grave|tombstone|headstone|plaque|interior|portrait)/i
const NEAR_M = 600

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
  /** Other nearby photos the reviewer may pick instead. */
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

const only = process.argv.slice(2)
const registry = JSON.parse(await readFile(new URL('content/photos.json', ROOT), 'utf8')) as { bywayId: string; town?: string }[]
const have = new Set(registry.filter((p) => p.town).map((p) => `${p.bywayId}#${p.town}`))
const rejected: Record<string, string> = existsSync(new URL('data/photos/rejected-towns.json', ROOT))
  ? JSON.parse(await readFile(new URL('data/photos/rejected-towns.json', ROOT), 'utf8'))
  : {}
interface Town {
  key: string
  name: string
  article?: string
  at: number[]
}
const towns: Town[] = []
const dir = new URL('public/data/strips/', ROOT)
for (const f of (await readdir(dir)).filter((f) => f.endsWith('.json') && f !== 'index.json')) {
  const s = JSON.parse(await readFile(new URL(f, dir), 'utf8'))
  if (only.length && !only.includes(s.bywayId)) continue
  for (const t of s.towns ?? []) {
    const key = `${s.bywayId}#${t.name}`
    if (have.has(key) || rejected[key]) continue
    const src = String(t.source ?? '')
    const article = src.includes('wikipedia.org/wiki/') ? decodeURIComponent(src.split('/wiki/')[1]).replace(/_/g, ' ') : undefined
    towns.push({ key, name: t.name, article, at: t.at })
  }
}
console.log(`${towns.length} towns without a photo`)

// 1. Lead images of the town articles, 50 articles per request (redirects followed).
const lead = new Map<string, string>()
const articles = [...new Set(towns.map((t) => t.article).filter(Boolean))] as string[]
for (let i = 0; i < articles.length; i += 50) {
  const d = await api('en.wikipedia.org', {
    action: 'query',
    titles: articles.slice(i, i + 50).join('|'),
    prop: 'pageimages',
    piprop: 'name',
    redirects: '1',
  })
  const back = new Map<string, string>()
  for (const r of [...(d.query?.normalized ?? []), ...(d.query?.redirects ?? [])]) back.set(r.to, back.get(r.from) ?? r.from)
  for (const p of d.query?.pages ?? []) {
    if (!p.pageimage || NOT_A_VIEW.test(p.pageimage)) continue
    let title = p.title
    while (back.has(title) && !articles.includes(title)) title = back.get(title)!
    lead.set(title, `File:${p.pageimage.replace(/_/g, ' ')}`)
  }
  if (i % 500 === 0) console.log(`  articles ${i}/${articles.length}`)
}
const leadInfo = await usable([...new Set(lead.values())])
console.log(`${leadInfo.size} usable lead images`)

const out: Record<string, Candidate> = existsSync(OUT) ? JSON.parse(await readFile(OUT, 'utf8')) : {}
const missing: Town[] = []
for (const t of towns) {
  const file = t.article ? lead.get(t.article) : undefined
  const info = file ? leadInfo.get(file) : undefined
  if (info) out[t.key] = { ...info, article: t.article }
  else missing.push(t)
}

// 2. Geotagged Commons photos close to the town's point, for towns whose article has no usable lead image.
const near = new Map<string, Candidate | null>()
for (const [n, t] of missing.entries()) {
  const at = `${t.at[1].toFixed(4)},${t.at[0].toFixed(4)}`
  if (!near.has(at)) {
    const d = await api('commons.wikimedia.org', {
      action: 'query',
      list: 'geosearch',
      gsnamespace: '6',
      gscoord: `${t.at[1]}|${t.at[0]}`,
      gsradius: String(NEAR_M),
      gslimit: '30',
    })
    const titles = (d.query?.geosearch ?? []).map((g: { title: string }) => g.title).filter((title: string) => !NOT_A_VIEW.test(title))
    const info = await usable(titles)
    // Up to three, largest first; the review step picks the one that shows the place, or none.
    const best = [...info.values()].sort((a, b) => b.width - a.width).slice(0, 3)
    near.set(
      at,
      best.length
        ? { ...best[0], source: 'commons-search', alternates: best.slice(1).map((c) => ({ ...c, source: 'commons-search' as const })) }
        : null,
    )
  }
  const found = near.get(at)
  if (found) out[t.key] = found
  if (n % 200 === 0) {
    console.log(`  nearby ${n}/${missing.length}`)
    await writeFile(OUT, JSON.stringify(out, null, 1))
  }
}
await mkdir(new URL('data/photos/', ROOT), { recursive: true })
await writeFile(OUT, JSON.stringify(out, null, 1))
const keys = Object.keys(out).filter((k) => towns.some((t) => t.key === k))
console.log(
  `\n${keys.length} of ${towns.length} towns have a candidate (${keys.filter((k) => out[k].source === 'wikipedia-lead').length} lead images)`,
)
