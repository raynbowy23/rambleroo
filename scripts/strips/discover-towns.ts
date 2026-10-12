import { applyReplacements, supplementFiles } from '../states/sources.ts'
// Drafts a strip content file for a byway that has none yet: finds towns along the road with Wikipedia's geosearch and writes
// content/strips/<id>.json marked `generated: true`. build-strip.ts then orders the towns by mile and drafts stretches between
// them. Nothing here is editorial: the output says so in the UI until someone reviews it.
// Usage: npx tsx scripts/strips/discover-towns.ts <bywayId> [<bywayId> ...]
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { Position } from 'geojson'

const ROOT = new URL('../../', import.meta.url)
const UA = {
  'User-Agent':
    'Rambleroo/0.1 (scenic byway strip maps; personal project; https://rambleroo.app; https://github.com/raynbowy23/rambleroo/issues)',
}
const NEAR_MI = 1.5 // a town must be this close to the mapped road
// Every 8 mi: any road point is ≤ 4 mi from a search centre, so towns ≤ 1.5 mi off the road are ≤ 5.5 mi away, inside the 10 km (6.2 mi) radius.
const SAMPLE_MI = 8
// --wide (used when retrying dropped roads) widens the landmark search.
const WIDE = process.argv.includes('--wide')
const LANDMARK_NEAR_MI = WIDE ? 1.5 : 1
// Buildings and facilities that merely contain a landmark word ("Milner Pass Road Camp Mess Hall and House").
const NOT_A_LANDMARK =
  /\b(House|Hall|Club|Lodge|Station|Stations|Road|Highway|Byway|Historic District|Cabin|Entrance|Camp|Utility|Comfort|School|Church|Hotel|Inn|Store|Company|Mine|Resort|Airport|caldera)\b/i
// Natural and park features only; buildings, companies and people are excluded by requiring one of these words.
const LANDMARK =
  /\b(Pass|Summit|Peak|Mountain|Mount|Dome|Lake|Falls|Overlook|Viewpoint|Vista|Point|Meadows?|Grove|Canyon|Gorge|Gap|Bald|Knob|Ridge|Visitor Center|Springs|Butte|Arch|Glacier|Notch|Rock|Rocks|Mesa|Spire|Needles|Cliffs?|Bluffs?|Beach|Cove|Island|Bay|Harbor|Lighthouse|Dunes)\b/
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
  /^(List|Timeline|History) of|metropolitan area|micropolitan|National Weather Service|\b(Purchase|Location|Grant|Gore|County|Township|Parish|Borough of|School|Park|Airport|Station|Church|Cemetery|House|Bridge|Dam|Mine|Mountain|Lake|River|Creek|Forest|Hospital|Historic District|Trail|Road|Highway)\b/i

async function overpass(query: string) {
  for (let i = 0; i < 6; i++) {
    await sleep(1500)
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: UA,
        body: new URLSearchParams({ data: query }),
      })
      if (res.ok) return res.json()
    } catch {
      // retry below
    }
    await sleep(20000 * (i + 1))
  }
  throw new Error('Overpass unavailable')
}

async function api(params: Record<string, string>) {
  const url = 'https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ format: 'json', formatversion: '2', ...params })
  // Patient back-off (up to ~15 minutes in total): long roads make hundreds of requests, and throttling is temporary.
  for (let i = 0; i < 10; i++) {
    await sleep(700)
    try {
      const res = await fetch(url, { headers: UA })
      if (res.ok) return res.json()
    } catch {
      // network hiccup: back off like a throttle
    }
    await sleep(Math.min(120000, 15000 * (i + 1)))
  }
  throw new Error('Wikipedia unavailable')
}

const stateNames: Record<string, string> = await json('scripts/photos/states.json')
const catalog = (await json<{ byways: { id: string; name: string; states: string[] }[] }>('public/data/catalog.json')).byways
const raw = await json<{
  features: { properties: { BYWAY_ID: number; REPLACES?: string }; geometry: { type: string; coordinates: Position[] | Position[][] } }[]
}>('data/raw/scenic_byways.geojson')
// Supplemental sources (WisDOT byways, classic drives) share the schema.
for (const name of supplementFiles) {
  const extra = await json<typeof raw>(`data/raw/${name}`).catch(() => undefined)
  if (extra) raw.features.push(...extra.features)
}
raw.features = applyReplacements(raw.features)

for (const id of process.argv.slice(2).filter((arg) => !arg.startsWith('--'))) {
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
  // Park and wilderness roads (Trail Ridge, Tioga) pass few or no towns: fall back to named natural and park landmarks close to
  // the road, marked kind "landmark" so the ribbon shows them as landmarks, not towns.
  const landmarks = new Map<string, Position>()
  // Fewer than three towns: add landmarks so the drive has enough places to read as a journey.
  if (found.size < 3) {
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
        if (!LANDMARK.test(title) || NOT_A_LANDMARK.test(title) || /^(List|History|Timeline) of/.test(title)) continue
        const at: Position = [hit.lon, hit.lat]
        if (nearest(at, pts) <= LANDMARK_NEAR_MI) landmarks.set(title, at)
      }
    }
  }

  // "Lincoln (CDP)" and "Lincoln" are the same place for a traveller; keep one, preferring the plain title.
  const byName = new Map<string, string>()
  for (const title of [...found.keys()].sort((a, b) => a.length - b.length)) {
    const name = title.split(',')[0].replace(/\s*\((CDP|village|town|city|community)\)$/i, '')
    if (!byName.has(name)) byName.set(name, title)
  }
  const towns: { name: string; wikipedia: string; kind?: 'landmark'; weight?: number; osm?: string; at?: Position }[] = [...byName].map(
    ([name, wikipedia]) => ({ name, wikipedia }),
  )
  for (const title of landmarks.keys())
    towns.push({ name: title.replace(/\s*\(.*\)$/, '').split(',')[0], wikipedia: title, kind: 'landmark' })
  // Article length as a notability weight, so spacing keeps Tuolumne Meadows over an obscure dome nearby.
  const wiki = towns.filter((t) => t.wikipedia)
  for (let k = 0; k < wiki.length; k += 50) {
    const d = await api({
      action: 'query',
      prop: 'info',
      redirects: '1',
      titles: wiki
        .slice(k, k + 50)
        .map((t) => t.wikipedia)
        .join('|'),
    })
    const length = new Map<string, number>((d.query?.pages ?? []).map((p: { title: string; length?: number }) => [p.title, p.length ?? 0]))
    for (const t of wiki.slice(k, k + 50)) t.weight = length.get(t.wikipedia) ?? 0
  }
  // Short local roads often have fewer than two Wikipedia places: fall back to named OpenStreetMap place nodes (hamlets,
  // neighbourhoods) and viewpoints or peaks within a mile of the road, each linked to its OSM record so placement stays checkable.
  if (towns.length < 2) {
    const step = Math.max(1, Math.ceil(pts.length / 60))
    const line = pts
      .filter((_, i) => i % step === 0)
      .map((p) => `${p[1].toFixed(5)},${p[0].toFixed(5)}`)
      .join(',')
    const query = `[out:json][timeout:60];(node(around:1600,${line})[place~"^(city|town|village|hamlet|suburb|neighbourhood|quarter)$"][name];node(around:1600,${line})[~"^(tourism|natural)$"~"^(viewpoint|peak)$"][name];);out;`
    const d = await overpass(query)
    const have = new Set(towns.map((t) => t.name))
    for (const n of d.elements as { id: number; lat: number; lon: number; tags: Record<string, string> }[]) {
      const at: Position = [n.lon, n.lat]
      // Skip bare generic names ("Falls") and survey-style or lowercase labels ("3 post Creosote bush", "top lookout") that are not places a traveller would recognise.
      if (
        have.has(n.tags.name) ||
        nearest(at, pts) > 1 ||
        /^[\d\p{Ll}]/u.test(n.tags.name) ||
        (!/\s/.test(n.tags.name.trim()) && /^(Falls|Peak|Point|Hill|Overlook|Viewpoint|Summit|Junction|Corner)$/i.test(n.tags.name))
      )
        continue
      have.add(n.tags.name)
      const isPlace = !!n.tags.place
      const rank = { city: 5, town: 4, suburb: 3, village: 3, quarter: 2, neighbourhood: 1, hamlet: 1 }[n.tags.place] ?? 1
      towns.push({
        name: n.tags.name,
        wikipedia: '',
        osm: `node/${n.id}`,
        at,
        weight: rank * 1000,
        ...(isPlace ? {} : { kind: 'landmark' as const }),
      })
    }
  }
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
