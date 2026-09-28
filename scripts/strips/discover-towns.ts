// Drafts a strip content file for a byway that has none yet: finds towns along the road with Wikipedia's geosearch and writes
// content/strips/<id>.json marked `generated: true`. build-strip.ts then orders the towns by mile and drafts stretches between
// them. Nothing here is editorial: the output says so in the UI until someone reviews it.
// Usage: npx tsx scripts/strips/discover-towns.ts <bywayId> [<bywayId> ...]
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { Position } from 'geojson'

const ROOT = new URL('../../', import.meta.url)
const UA = { 'User-Agent': 'Rambleroo/0.1 (scenic byway strip maps; personal project)' }
const NEAR_MI = 1.5 // a town must be this close to the mapped road
// Every 8 mi: any road point is ≤ 4 mi from a search centre, so towns ≤ 1.5 mi off the road are ≤ 5.5 mi away, inside the 10 km (6.2 mi) radius.
const SAMPLE_MI = 8
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const json = async <T>(rel: string): Promise<T> => JSON.parse(await readFile(new URL(rel, ROOT), 'utf8'))

const R = 3958.8
const rad = (d: number) => (d * Math.PI) / 180
function miles(a: Position, b: Position) {
  const h = Math.sin(rad(b[1] - a[1]) / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
/** Distance from a point to the nearest road vertex; vertices are dense enough (~0.1 mi) for a 1.5 mi test. */
const nearest = (p: Position, pts: Position[]) => pts.reduce((best, q) => Math.min(best, miles(p, q)), Infinity)

// Titles like "Tropic, Utah" are populated places; exclude counties, townships and non-place pages that share the pattern.
const NOT_A_TOWN =
  /^List of|\b(Purchase|Location|Grant|Gore|County|Township|Parish|Borough of|School|Park|Airport|Station|Church|Cemetery|House|Bridge|Dam|Mine|Mountain|Lake|River|Creek|Forest|Hospital|Historic District|Trail|Road|Highway)\b/i

async function api(params: Record<string, string>) {
  const url = 'https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ format: 'json', formatversion: '2', ...params })
  for (let i = 0; i < 6; i++) {
    await sleep(700)
    const res = await fetch(url, { headers: UA })
    if (res.ok) return res.json()
    await sleep(10000 * (i + 1))
  }
  throw new Error('Wikipedia unavailable')
}

const stateNames: Record<string, string> = await json('scripts/photos/states.json')
const catalog = (await json<{ byways: { id: string; name: string; states: string[] }[] }>('public/data/catalog.json')).byways
const raw = await json<{
  features: { properties: { BYWAY_ID: number }; geometry: { type: string; coordinates: Position[] | Position[][] } }[]
}>('data/raw/scenic_byways.geojson')

for (const id of process.argv.slice(2)) {
  const target = new URL(`content/strips/${id}.json`, ROOT)
  if (existsSync(target)) {
    console.log(`${id}: content exists, skipping`)
    continue
  }
  const byway = catalog.find((b) => b.id === id)
  if (!byway) throw new Error(`${id} not in catalog`)
  const suffixes = byway.states.map((s) => `, ${stateNames[s]}`)
  const sourceId = Number(id.split('-').at(-1))
  const pts = raw.features
    .filter((f) => f.properties.BYWAY_ID === sourceId)
    .flatMap((f) =>
      f.geometry.type === 'LineString' ? (f.geometry.coordinates as Position[]) : (f.geometry.coordinates as Position[][]).flat(),
    )
  // Sample search centres every ~SAMPLE_MI along the vertex list.
  const centres: Position[] = [pts[0]]
  for (const p of pts) if (miles(centres[centres.length - 1], p) >= SAMPLE_MI) centres.push(p)
  centres.push(pts[pts.length - 1])

  const found = new Map<string, Position>()
  for (const c of centres) {
    const d = await api({
      action: 'query',
      list: 'geosearch',
      gscoord: `${c[1]}|${c[0]}`,
      gsradius: '10000',
      gslimit: '50',
      gsnamespace: '0',
    })
    for (const hit of d.query?.geosearch ?? []) {
      const title: string = hit.title
      if (!suffixes.some((s) => title.endsWith(s)) || NOT_A_TOWN.test(title)) continue
      if (title.split(',').length !== 2) continue
      const at: Position = [hit.lon, hit.lat]
      if (nearest(at, pts) <= NEAR_MI) found.set(title, at)
    }
  }
  // "Lincoln (CDP)" and "Lincoln" are the same place for a traveller; keep one, preferring the plain title.
  const byName = new Map<string, string>()
  for (const title of [...found.keys()].sort((a, b) => a.length - b.length)) {
    const name = title.split(',')[0].replace(/\s*\((CDP|village|town|city)\)$/i, '')
    if (!byName.has(name)) byName.set(name, title)
  }
  const towns = [...byName].map(([name, wikipedia]) => ({ name, wikipedia }))
  await writeFile(
    target,
    JSON.stringify(
      {
        bywayId: id,
        reviewed: false,
        generated: true,
        title: byway.name,
        direction: '',
        towns,
        stretches: [],
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`${id}: ${towns.length} towns (${towns.map((t) => t.name).join(', ')})`)
}
