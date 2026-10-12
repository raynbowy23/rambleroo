// Supplemental sources for roads the USDOT 2022 layer lacks, written in the same property schema as
// data/raw/scenic_byways.geojson so build-catalog.ts and build-strip.ts treat them like any other byway:
//  1. data/raw/supplement-wisdot.geojson: Wisconsin byways missing federally, from WisDOT's official Scenic Byways layer.
//  2. data/raw/supplement-classics.geojson: famous drives that are not designated byways (content/classics.json), routed
//     through Wikipedia/Wikidata waypoints with OSRM on OpenStreetMap data. Each route must use the roads the drive is known
//     by (checked against OSRM step names), or the build fails rather than publish a shortcut.
// Usage: npx tsx scripts/ingest/build-supplements.ts [STATE ... | classics]   (no arguments = every state and the classic drives;
// arguments rebuild only those supplement files, e.g. when one agency's server is down)
import { stateSources, supplementFile } from '../states/sources.ts'
import { readFile, writeFile } from 'node:fs/promises'
import type { Feature, LineString, MultiLineString, Position } from 'geojson'

const ROOT = new URL('../../', import.meta.url)
const UA = {
  'User-Agent':
    'Rambleroo/0.1 (scenic byway catalog; personal project; https://rambleroo.app; https://github.com/raynbowy23/rambleroo/issues)',
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function getJson(url: string) {
  for (let i = 0; i < 8; i++) {
    await sleep(1200)
    try {
      const res = await fetch(url, { headers: UA })
      const text = await res.text()
      if (res.ok && text.startsWith('{')) return JSON.parse(text)
    } catch {
      // retry below
    }
    await sleep(Math.min(120000, 10000 * (i + 1)))
  }
  throw new Error(`unavailable: ${url}`)
}

const R = 3958.8
const rad = (d: number) => (d * Math.PI) / 180
const miles = (a: Position, b: Position) =>
  2 *
  R *
  Math.asin(
    Math.sqrt(Math.sin(rad(b[1] - a[1]) / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2),
  )
const lengthOf = (line: Position[]) => line.slice(1).reduce((s, p, i) => s + miles(line[i], p), 0)

type Props = {
  FID: number
  BYWAY_ID: number
  NAME: string
  STATE: string
  LENGTH: number
  NSB_DESIG: string
  USFS_DESIG: string
  DESIGNATS: string
  /** 'T' on agency lines that replace a mis-drawn national line with the same BYWAY_ID (build-catalog drops the national parts). */
  REPLACES?: 'T'
}

// The stretch of `lines` within `radius` miles (along the line) of the vertex nearest `center`.
function clipAround(lines: Position[][], center: Position, radius: number): Position[] {
  let best = { line: lines[0], index: 0, d: Infinity }
  for (const line of lines) line.forEach((p, index) => miles(p, center) < best.d && (best = { line, index, d: miles(p, center) }))
  const along = [0]
  for (let i = 1; i < best.line.length; i++) along.push(along[i - 1] + miles(best.line[i - 1], best.line[i]))
  const mid = along[best.index]
  return best.line.filter((_, i) => Math.abs(along[i] - mid) <= radius)
}
const feature = (
  fid: number,
  bywayId: number,
  name: string,
  state: string,
  designation: string,
  nsb: boolean,
  line: Position[],
): Feature<LineString, Props> => ({
  type: 'Feature',
  properties: {
    FID: fid,
    BYWAY_ID: bywayId,
    NAME: name,
    STATE: state,
    LENGTH: Math.round(lengthOf(line) * 1000) / 1000,
    NSB_DESIG: nsb ? 'T' : 'F',
    USFS_DESIG: 'F',
    DESIGNATS: designation,
  },
  geometry: { type: 'LineString', coordinates: line },
})

// State agency lines retain source order and the existing Wisconsin feature IDs and property schema.
let fid = 9_000_000
let stateFeatureCount = 0
const only = process.argv.slice(2)
const wanted = (key: string) => !only.length || only.includes(key)
for (const source of stateSources) {
  if (!wanted(source.state)) continue
  const features: Feature<LineString, Props>[] = []
  for (const b of source.byways) {
    let lines: Position[][]
    if (b.osm) {
      const d = await getJson(
        'https://overpass-api.de/api/interpreter?' +
          new URLSearchParams({ data: `[out:json][timeout:60];way(id:${b.osm.ways.join(',')});out geom;` }),
      )
      if (d.elements.length !== b.osm.ways.length)
        throw new Error(`${b.name}: expected ${b.osm.ways.length} OpenStreetMap ways, got ${d.elements.length}`)
      lines = d.elements.map((way: { geometry: { lon: number; lat: number }[] }) =>
        way.geometry.map((p) => [Math.round(p.lon * 1e5) / 1e5, Math.round(p.lat * 1e5) / 1e5]),
      )
    } else {
      const q = new URLSearchParams({
        where: `${b.where ?? `${source.nameField}='${(b.match ?? b.name).replaceAll("'", "''")}'`}${source.where ? ` AND ${source.where}` : ''}`,
        outFields: '*',
        outSR: '4326',
        f: 'geojson',
      })
      let d = await getJson(`${b.layer ?? source.layer}/query?${q}`)
      if (d.error) {
        // Older ArcGIS servers can't answer f=geojson; ask for Esri JSON and read its paths instead.
        q.set('f', 'json')
        d = await getJson(`${b.layer ?? source.layer}/query?${q}`)
        if (d.error) throw new Error(`${b.name}: ${b.layer ?? source.layer} query failed: ${JSON.stringify(d.error)}`)
        d = {
          features: d.features.map((f: { geometry?: { paths: Position[][] } }) => ({
            geometry: f.geometry?.paths ? { type: 'MultiLineString', coordinates: f.geometry.paths } : null,
          })),
        }
      }
      // Some agency layers hold rows with empty geometry; skip them.
      lines = d.features.flatMap((f: Feature<LineString | MultiLineString> | { geometry: null }) =>
        !f.geometry ? [] : f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates,
      )
    }
    if (b.clip) lines = [clipAround(lines, b.clip.center, b.clip.miles)]
    if (!lines.length) throw new Error(`${b.name}: no geometry`)
    for (const line of lines) {
      const f = feature(fid++, b.replaces ?? b.id, b.name, source.state, b.designation, b.nsb, line)
      if (b.replaces) f.properties.REPLACES = 'T'
      features.push(f)
    }
    const pieces = features.filter((f) => f.properties.BYWAY_ID === (b.replaces ?? b.id))
    const total = pieces.reduce((s, f) => s + f.properties.LENGTH, 0)
    console.log(`${source.agency} ${b.name}: ${Math.round(total)} mi in ${pieces.length} pieces`)
  }
  await writeFile(
    new URL(`data/raw/${supplementFile(source.state)}`, ROOT),
    JSON.stringify({ type: 'FeatureCollection', source: source.layer, retrievedAt: new Date().toISOString(), features }),
  )
  stateFeatureCount += features.length
}

// ---------- 2. Classic drives ----------
interface Classic {
  id: number
  name: string
  state: string
  waypoints?: string[]
  /** Road names (regex) the route must follow for most of its length. */
  mustUse?: string
  /** For roads OSRM can't route (gravel), take the ways with this exact OSM name inside [south, west, north, east]. */
  osm?: { name?: string; ref?: string; bbox: [number, number, number, number] }
}
const classics: Classic[] = JSON.parse(await readFile(new URL('content/classics.json', ROOT), 'utf8'))

async function coordinate(title: string): Promise<Position> {
  const d = await getJson(
    'https://en.wikipedia.org/w/api.php?' +
      new URLSearchParams({
        action: 'query',
        format: 'json',
        formatversion: '2',
        prop: 'coordinates|pageprops',
        redirects: '1',
        titles: title,
      }),
  )
  const page = d.query.pages[0]
  if (page.coordinates) return [page.coordinates[0].lon, page.coordinates[0].lat]
  const item = page.pageprops?.wikibase_item
  if (!item) throw new Error(`no coordinates for ${title}`)
  const claims = await getJson(
    'https://www.wikidata.org/w/api.php?' + new URLSearchParams({ action: 'wbgetclaims', format: 'json', property: 'P625', entity: item }),
  )
  const v = claims.claims?.P625?.[0]?.mainsnak?.datavalue?.value
  if (!v) throw new Error(`no coordinates for ${title}`)
  return [v.longitude, v.latitude]
}

const classicFeatures: Feature<LineString, Props>[] = []
// Classic drives get their own feature-ID block, so adding a state never renumbers them.
fid = 9_500_000
for (const c of wanted('classics') ? classics : []) {
  if (c.osm) {
    const [south, west, north, east] = c.osm.bbox
    const filter = c.osm.ref ? `["ref"="${c.osm.ref}"]` : `["name"="${c.osm.name}"]`
    const query = `[out:json][timeout:60];way${filter}(${south},${west},${north},${east});out geom;`
    const d = await getJson('https://overpass-api.de/api/interpreter?' + new URLSearchParams({ data: query }))
    let total = 0
    for (const way of d.elements) {
      const line: Position[] = way.geometry.map((p: { lon: number; lat: number }) => [
        Math.round(p.lon * 1e5) / 1e5,
        Math.round(p.lat * 1e5) / 1e5,
      ])
      total += lengthOf(line)
      classicFeatures.push(feature(fid++, c.id, c.name, c.state, 'Classic drive (not a designated scenic byway)', false, line))
    }
    console.log(`${c.name}: ${Math.round(total)} mi from ${d.elements.length} OpenStreetMap ways`)
    if (!d.elements.length) throw new Error(`${c.name}: no OpenStreetMap ways matching ${c.osm.ref ?? c.osm.name}`)
    continue
  }
  const points = []
  for (const w of c.waypoints ?? []) points.push(await coordinate(w))
  const coords = points.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(';')
  const d = await getJson(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`)
  if (d.code !== 'Ok') throw new Error(`${c.name}: OSRM ${d.code}`)
  const route = d.routes[0]
  // Share of distance on the named roads the drive is known for.
  const named = new RegExp(c.mustUse ?? '.', 'i')
  let onRoad = 0
  for (const leg of route.legs) for (const step of leg.steps) if (named.test(`${step.name} ${step.ref ?? ''}`)) onRoad += step.distance
  const share = onRoad / route.distance
  const line: Position[] = route.geometry.coordinates.map((p: Position) => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5])
  console.log(`${c.name}: ${Math.round(route.distance / 1609.344)} mi, ${Math.round(share * 100)}% on ${c.mustUse}`)
  if (share < 0.7)
    throw new Error(`${c.name}: only ${Math.round(share * 100)}% of the route uses ${c.mustUse}; refusing to publish a shortcut`)
  classicFeatures.push(feature(fid++, c.id, c.name, c.state, 'Classic drive (not a designated scenic byway)', false, line))
}
if (wanted('classics'))
  await writeFile(
    new URL('data/raw/supplement-classics.geojson', ROOT),
    JSON.stringify({
      type: 'FeatureCollection',
      source: 'OSRM routes on OpenStreetMap data (© OpenStreetMap contributors, ODbL)',
      retrievedAt: new Date().toISOString(),
      features: classicFeatures,
    }),
  )
console.log(`wrote ${stateFeatureCount} state agency and ${classicFeatures.length} classic features`)
