// Finds candidate photographs for byways without curated photos. Candidates are NOT published automatically:
// scripts/photos/review.ts builds contact sheets, a human marks rejects, and scripts/photos/fetch.ts downloads the accepted ones.
// Sources: (1) the lead image of the byway's English Wikipedia article, (2) the U.S. DOT America's Byways collection on Commons (NARA, public domain).
// Usage: npx tsx scripts/photos/discover.ts [limit]
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const ROOT = new URL('../../', import.meta.url)
const OUT = new URL('data/photos/candidates.json', ROOT)
const UA = {
  'User-Agent':
    'Rambleroo/0.1 (scenic byway catalog; personal project; https://rambleroo.app; https://github.com/raynbowy23/rambleroo/issues) node-fetch',
}
const FREE = /^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+)/i
const NOT_A_VIEW = /(map|shield|sign|logo|marker|locator|route[_ ]?\d|\.svg$|seal|flag|diagram|plan|emblem)/i
const STATE_NAMES: Record<string, string> = JSON.parse(await readFile(new URL('scripts/photos/states.json', ROOT), 'utf8'))

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function api(host: string, params: Record<string, string>) {
  const url = `https://${host}/w/api.php?` + new URLSearchParams({ format: 'json', formatversion: '2', ...params })
  for (let i = 0; i < 6; i++) {
    await sleep(700)
    const res = await fetch(url, { headers: UA })
    if (res.status === 429) {
      await sleep(15000 * (i + 1))
      continue
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    return res.json()
  }
  throw new Error('rate limited')
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(
      /\b(scenic|byway|byways|national|state|historic|highway|road|drive|route|trail|the|and|of|parkway|loop|all american|back country)\b/g,
      ' ',
    )
    .split(/\s+/)
    .filter(Boolean)
const similarity = (a: string, b: string) => {
  const A = new Set(norm(a))
  const B = new Set(norm(b))
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const t of A) if (B.has(t)) inter++
  return inter / Math.max(A.size, B.size)
}

async function fileInfo(title: string) {
  const d = await api('commons.wikimedia.org', {
    action: 'query',
    titles: title,
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '480',
  })
  const ii = d.query?.pages?.[0]?.imageinfo?.[0]
  if (!ii) return null
  const m = ii.extmetadata ?? {}
  const strip = (s?: string) =>
    (s ?? '')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .trim()
  return {
    file: title,
    width: ii.width as number,
    height: ii.height as number,
    thumb: ii.thumburl as string,
    sourceUrl: ii.descriptionurl as string,
    license: strip(m.LicenseShortName?.value),
    licenseUrl: strip(m.LicenseUrl?.value) || (ii.descriptionurl as string),
    author: strip(m.Artist?.value) || 'Unknown',
    description: strip(m.ImageDescription?.value).slice(0, 200),
  }
}

async function wikipediaLead(name: string, states: string[]) {
  const stateWords = states.map((s) => STATE_NAMES[s] ?? s).join(' ')
  const search = await api('en.wikipedia.org', { action: 'query', list: 'search', srsearch: `${name} ${stateWords}`, srlimit: '5' })
  for (const hit of search.query?.search ?? []) {
    const score = similarity(name, hit.title)
    if (score < 0.6) continue
    const page = await api('en.wikipedia.org', {
      action: 'query',
      titles: hit.title,
      prop: 'pageimages|categories',
      piprop: 'name',
      cllimit: '50',
      redirects: '1',
    })
    const p = page.query?.pages?.[0]
    const cats = (p?.categories ?? []).map((c: { title: string }) => c.title).join(' ')
    if (!/(byway|highway|road|route|trail|parkway|scenic|drive)/i.test(cats + ' ' + hit.title)) continue
    if (!p?.pageimage || NOT_A_VIEW.test(p.pageimage)) continue
    return { article: hit.title, score, file: `File:${p.pageimage}` }
  }
  return null
}

async function naraPhoto(name: string) {
  const d = await api('commons.wikimedia.org', {
    action: 'query',
    list: 'search',
    srsearch: `"${name}" NARA filetype:bitmap`,
    srnamespace: '6',
    srlimit: '5',
  })
  for (const hit of d.query?.search ?? []) {
    const lead = hit.title.replace(/^File:/, '').split(' - ')[0]
    if (hit.title.includes('NARA') && similarity(name, lead) >= 0.75 && !NOT_A_VIEW.test(hit.title))
      return { file: hit.title, score: similarity(name, lead) }
  }
  return null
}

const limit = Number(process.argv[2] ?? Infinity)
const catalog = JSON.parse(await readFile(new URL('public/data/catalog.json', ROOT), 'utf8')).byways as {
  id: string
  name: string
  states: string[]
}[]
const curated = new Set(
  (JSON.parse(await readFile(new URL('content/photos.json', ROOT), 'utf8')) as { bywayId: string }[]).map((p) => p.bywayId),
)
await mkdir(new URL('data/photos/', ROOT), { recursive: true })
const out: Record<string, unknown> = existsSync(OUT) ? JSON.parse(await readFile(OUT, 'utf8')) : {}
let n = 0
for (const b of catalog) {
  if (n >= limit) break
  if (curated.has(b.id) || b.id in out) continue
  n++
  let found: Record<string, unknown> | null = null
  try {
    const nara = await naraPhoto(b.name)
    if (nara) found = { source: 'nara', ...nara }
    if (!found) {
      const wp = await wikipediaLead(b.name, b.states)
      if (wp) found = { source: 'wikipedia-lead', ...wp }
    }
    if (found) {
      const info = await fileInfo(found.file as string)
      if (info && FREE.test(info.license) && info.width >= 900) found = { ...found, ...info }
      else found = null
    }
  } catch (err) {
    console.warn(`${b.id}: ${(err as Error).message}`)
    continue
  }
  out[b.id] = found
  console.log(`${found ? 'HIT ' : '    '}${b.name}${found ? `  ← ${found.source}: ${String(found.file).slice(5, 70)}` : ''}`)
  await writeFile(OUT, JSON.stringify(out, null, 1))
}
const hits = Object.values(out).filter(Boolean).length
console.log(`\n${hits} candidates for ${Object.keys(out).length} byways checked`)
