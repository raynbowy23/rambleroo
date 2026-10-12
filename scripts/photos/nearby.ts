// Finds geotagged Commons photographs taken close to a road's mapped line, for roads the name-based search in discover.ts could not illustrate.
// Nothing is published: it writes data/photos/nearby.json (up to 8 candidates per road) and a contact sheet; a human picks one per road,
// the pick is copied into data/photos/candidates.json as source "commons-search" with our own alt text, and fetch.ts publishes it.
// Usage: npx tsx scripts/photos/nearby.ts <contact sheet .html> [bywayId ...]   (default: every road with no photo in content/photos.json)
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const ROOT = new URL('../../', import.meta.url)
const UA = {
  'User-Agent':
    'Rambleroo/0.1 (scenic byway catalog; personal project; https://rambleroo.app; https://github.com/raynbowy23/rambleroo/issues) node-fetch',
}
const FREE = /^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+)/i
const NOT_A_VIEW =
  /(map|shield|sign|logo|marker|locator|route[_ ]?\d|\.svg$|seal|flag|diagram|plan|emblem|grave|tombstone|headstone|plaque|interior|selfie|portrait)/i
/** Radius of each Commons geosearch, and spacing of the search points along the line. */
const RADIUS_M = 800
const STEP_MI = 1.5
const PER_ROAD = 8

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function api(params: Record<string, string>) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ format: 'json', formatversion: '2', ...params })
  for (let i = 0; i < 6; i++) {
    await sleep(500)
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

const miles = (a: number[], b: number[]) => {
  const rad = Math.PI / 180
  const x = (b[0] - a[0]) * rad * Math.cos(((a[1] + b[1]) / 2) * rad)
  const y = (b[1] - a[1]) * rad
  return Math.sqrt(x * x + y * y) * 3958.8
}
/** Points every STEP_MI along each part of the line, ends included. */
function samples(lines: number[][][]) {
  const out: number[][] = []
  for (const line of lines) {
    let since = Infinity
    for (let i = 0; i < line.length; i++) {
      since += i ? miles(line[i - 1], line[i]) : 0
      if (since >= STEP_MI || i === line.length - 1) {
        out.push(line[i])
        since = 0
      }
    }
  }
  return out
}
const nearestMi = (p: number[], lines: number[][][]) => Math.min(...lines.flat().map((q) => miles(p, q)))

const strip = (s?: string) =>
  (s ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

interface Found {
  file: string
  width: number
  height: number
  thumb: string
  sourceUrl: string
  license: string
  licenseUrl: string
  author: string
  description: string
  at: number[]
  offMi: number
}

const [sheet, ...only] = process.argv.slice(2)
if (!sheet) throw new Error('usage: nearby.ts <contact sheet .html> [bywayId ...]')
const catalog = JSON.parse(await readFile(new URL('public/data/catalog.json', ROOT), 'utf8')).byways as {
  id: string
  name: string
  states: string[]
}[]
const photographed = new Set(
  (JSON.parse(await readFile(new URL('content/photos.json', ROOT), 'utf8')) as { bywayId: string }[]).map((p) => p.bywayId),
)
const lines = new Map<string, number[][][]>()
for (const f of JSON.parse(await readFile(new URL('public/data/byways.geojson', ROOT), 'utf8')).features) {
  const g = f.geometry
  lines.set(f.properties.id, [...(lines.get(f.properties.id) ?? []), ...(g.type === 'LineString' ? [g.coordinates] : g.coordinates)])
}

const roads = catalog.filter((b) => (only.length ? only.includes(b.id) : !photographed.has(b.id)))
const result: Record<string, Found[]> = {}
for (const b of roads) {
  const geom = lines.get(b.id) ?? []
  const titles = new Map<string, number[]>()
  for (const [lon, lat] of samples(geom)) {
    const d = await api({
      action: 'query',
      list: 'geosearch',
      gsnamespace: '6',
      gscoord: `${lat}|${lon}`,
      gsradius: String(RADIUS_M),
      gslimit: '50',
    })
    for (const g of d.query?.geosearch ?? []) if (!NOT_A_VIEW.test(g.title)) titles.set(g.title, [g.lon, g.lat])
  }
  const found: Found[] = []
  const all = [...titles.keys()]
  for (let i = 0; i < all.length; i += 50) {
    const d = await api({
      action: 'query',
      titles: all.slice(i, i + 50).join('|'),
      prop: 'imageinfo',
      iiprop: 'url|size|mime|extmetadata',
      iiurlwidth: '480',
    })
    for (const p of d.query?.pages ?? []) {
      const ii = p.imageinfo?.[0]
      if (!ii || ii.mime !== 'image/jpeg' || ii.width < 1200 || ii.width < ii.height) continue
      const m = ii.extmetadata ?? {}
      const license = strip(m.LicenseShortName?.value)
      if (!FREE.test(license)) continue
      const at = titles.get(p.title)!
      found.push({
        file: p.title,
        width: ii.width,
        height: ii.height,
        thumb: ii.thumburl,
        sourceUrl: ii.descriptionurl,
        license,
        licenseUrl: strip(m.LicenseUrl?.value) || ii.descriptionurl,
        author: strip(m.Artist?.value) || 'Unknown author',
        description: strip(m.ImageDescription?.value).slice(0, 240),
        at,
        offMi: Math.round(nearestMi(at, geom) * 100) / 100,
      })
    }
  }
  // Closest to the road first, then larger; spread the picks so one viewpoint does not fill the sheet.
  found.sort((a, b) => a.offMi - b.offMi || b.width - a.width)
  const picks: Found[] = []
  for (const f of found) {
    if (picks.length >= PER_ROAD) break
    if (picks.some((p) => miles(p.at, f.at) < 0.1)) continue
    picks.push(f)
  }
  result[b.id] = picks
  console.log(`${String(picks.length).padStart(2)} of ${String(found.length).padStart(3)}  ${b.name} (${b.states.join(', ')})`)
}

await mkdir(new URL('data/photos/', ROOT), { recursive: true })
await writeFile(new URL('data/photos/nearby.json', ROOT), JSON.stringify(result, null, 1))
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
const names = new Map(catalog.map((b) => [b.id, `${b.name} (${b.states.join(', ')})`]))
await writeFile(
  sheet,
  `<!doctype html><meta charset="utf-8"><title>Photo candidates</title>
<style>body{font:14px system-ui;margin:16px;background:#f6f1e7;color:#2b2620}h2{margin:28px 0 6px;font-size:16px}
.row{display:flex;flex-wrap:wrap;gap:10px}figure{margin:0;width:300px}img{width:300px;height:200px;object-fit:cover;display:block}
figcaption{font-size:12px;line-height:1.35}b{font-family:monospace}</style>
<h1>Photo candidates near the mapped line</h1><p>Pick one per road by its letter, or none. Distances are from the photo's recorded position to the line.</p>
${Object.entries(result)
  .map(
    ([id, fs]) =>
      `<h2>${esc(names.get(id) ?? id)} <small>${id}</small></h2><div class="row">${
        fs.length
          ? fs
              .map(
                (f, i) =>
                  `<figure><a href="${esc(f.sourceUrl)}" target="_blank"><img loading="lazy" src="${esc(f.thumb)}"></a><figcaption><b>${'abcdefgh'[i]}</b> ${f.offMi} mi off · ${esc(f.license)} · ${esc(f.author.slice(0, 40))}<br>${esc(f.file.slice(5, 90))}</figcaption></figure>`,
              )
              .join('')
          : '<p>No geotagged free photo within reach of the line.</p>'
      }</div>`,
  )
  .join('\n')}`,
)
console.log(`\n${Object.values(result).filter((f) => f.length).length} of ${roads.length} roads have candidates; sheet at ${sheet}`)
