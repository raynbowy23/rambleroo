import { applyReplacements, supplementFiles } from '../states/sources.ts'
// Builds a strip-map ("ribbon") dataset for one curated byway: the byway's source pieces chained into one ordered drive with
// cumulative miles, a side branch where the road forks, towns / story moments / photos placed at their true mile, and
// editorial stretches with drive times routed by OSRM once at build time.
// Honesty rules: pieces are joined only where their ends meet; any larger break is kept as a labelled gap, never bridged.
// Usage: npx tsx scripts/strips/build-strip.ts door-county-coastal-byway-81450
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { repairStrip } from './repair.ts'
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson'
import { booleanPointInPolygon, point } from '@turf/turf'

const ROOT = new URL('../../', import.meta.url)
const UA = {
  'User-Agent':
    'Rambleroo/0.1 (scenic byway strip maps; personal project; https://rambleroo.app; https://github.com/raynbowy23/rambleroo/issues)',
}
const JOIN_MI = 0.08 // ends closer than this are the same point (digitising noise)
const GAP_MI = 1.2 // ends further apart than this are not treated as part of the same drive
const PLACE_MI = 4 // places further than this from the road are not placed on the ribbon (nearer ones show their distance)

const id = process.argv[2]
if (!id) throw new Error('usage: build-strip.ts <bywayId>')
const sourceId = Number(id.split('-').at(-1))
const json = async <T>(rel: string): Promise<T> => JSON.parse(await readFile(new URL(rel, ROOT), 'utf8'))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface StripContent {
  bywayId: string
  reviewed: boolean
  title: string
  direction: string
  /** `osm` + `at`: a place with no Wikipedia article, placed from its OpenStreetMap node instead. */
  towns: { name: string; wikipedia: string; branch?: string; kind?: 'town' | 'landmark'; weight?: number; osm?: string; at?: Position }[]
  stretches: { id: string; title: string; from: string; to: string; branch?: string; scene: string; line: string }[]
  /** Keep only source pieces whose midpoint lies in this state (for multi-state roads like the Great River Road). */
  clipToState?: string
  /** Drafted by discover-towns.ts: towns are unordered and stretches are drafted here, not written by an editor. */
  generated?: boolean
  /** Multi-part roads (Route 66): one strip per disconnected section, built with `--part <key>`. */
  parts?: {
    key: string
    label: string
    state: string
    startAt?: 'east'
    branchLabel?: string
    direction?: string
    stretches?: StripContent['stretches']
  }[]
}

// ---------- geometry helpers (miles, WGS84 lng/lat) ----------
const R = 3958.8
const rad = (d: number) => (d * Math.PI) / 180
function miles(a: Position, b: Position) {
  const dp = rad(b[1] - a[1])
  const dl = rad(b[0] - a[0])
  const h = Math.sin(dp / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dl / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
const lengthOf = (line: Position[]) => line.slice(1).reduce((s, p, i) => s + miles(line[i], p), 0)

/** Nearest point on a polyline: returns mile along it and the perpendicular distance (planar approximation per segment, fine at county scale). */
function project(line: Position[], cum: number[], p: Position) {
  let best = { mile: 0, off: Infinity, at: line[0] }
  const kx = Math.cos(rad(p[1]))
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = line[i]
    const [bx, by] = line[i + 1]
    const dx = (bx - ax) * kx
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 ? Math.max(0, Math.min(1, ((p[0] - ax) * kx * dx + (p[1] - ay) * dy) / len2)) : 0
    const q: Position = [ax + (bx - ax) * t, ay + (by - ay) * t]
    const off = miles(p, q)
    if (off < best.off) best = { mile: cum[i] + miles(line[i], q), off, at: q }
  }
  return best
}

// ---------- 1. collect source parts ----------
const raw = await json<{
  features: { properties: { BYWAY_ID: number; REPLACES?: string }; geometry: { type: string; coordinates: Position[] | Position[][] } }[]
}>('data/raw/scenic_byways.geojson')
// Supplemental sources (WisDOT byways, classic drives) share the schema.
for (const name of supplementFiles) {
  const extra = await json<typeof raw>(`data/raw/${name}`).catch(() => undefined)
  if (extra) raw.features.push(...extra.features)
}
raw.features = applyReplacements(raw.features)
let parts: Position[][] = raw.features
  .filter((f) => f.properties.BYWAY_ID === sourceId)
  .flatMap((f) => (f.geometry.type === 'LineString' ? [f.geometry.coordinates as Position[]] : (f.geometry.coordinates as Position[][])))
// Divided carriageways appear as a piece and its reverse; keep one of each.
const key = (l: Position[]) => l.map((c) => c.map((v) => v.toFixed(4)).join(',')).join(';')
const seen = new Set<string>()
parts = parts.filter((l) => {
  const k = key(l)
  const r = key([...l].reverse())
  if (seen.has(k) || seen.has(r)) return false
  seen.add(k)
  return true
})

const content = await json<StripContent>(`content/strips/${id}.json`)
// --part <key>: build one section of a multi-part road, clipped to its state, from towns in that state.
const partKey = process.argv.includes('--part') ? process.argv[process.argv.indexOf('--part') + 1] : undefined
const part = partKey ? content.parts?.find((p) => p.key === partKey) : undefined
if (partKey && !part) throw new Error(`${id} has no part "${partKey}"`)
if (part) {
  if (part.state) {
    const stateName = (JSON.parse(await readFile(new URL('scripts/photos/states.json', ROOT), 'utf8')) as Record<string, string>)[
      part.state
    ]
    content.clipToState = part.state
    content.towns = content.towns.filter((t) => t.wikipedia.endsWith(`, ${stateName}`))
  }
  content.stretches = part.stretches ?? []
  // A part without curated stretches is treated as generated: tolerant placement, spacing, drafted stretches.
  if (!part.stretches) content.generated = true
  content.direction = part.direction ?? ''
  if (part.label) content.title = `${content.title} · ${part.label}`
}
if (content.clipToState) {
  const states = await json<{ features: { properties: { postal: string }; geometry: Polygon | MultiPolygon }[] }>(
    'public/data/basemap/states.geojson',
  )
  const shape = states.features.find((f) => f.properties.postal === content.clipToState)
  if (!shape) throw new Error(`no basemap outline for ${content.clipToState}`)
  const before = parts.length
  parts = parts.filter((l) => booleanPointInPolygon(point(l[Math.floor(l.length / 2)]), shape as Feature<Polygon | MultiPolygon>))
  console.log(`clipped to ${content.clipToState}: ${parts.length} of ${before} pieces`)
}

// ---------- 2. chain pieces into paths ----------
/** Grow a path from `seed` at both ends, attaching the longest unused piece that touches the tip (within JOIN_MI), or failing
 *  that the longest whose end is within `tol` miles. Roads cut into many short edges stay continuous instead of jumping. */
function chain(seed: Position[], pool: Position[][], tol: number) {
  const path = [...seed]
  const gaps: { atMile: number; miles: number }[] = []
  const used = new Set<Position[]>([seed])
  for (let grew = true; grew;) {
    grew = false
    for (const end of ['tail', 'head'] as const) {
      const tip = end === 'tail' ? path[path.length - 1] : path[0]
      let pick: { line: Position[]; d: number } | undefined
      for (const l of pool) {
        if (used.has(l)) continue
        for (const cand of [l, [...l].reverse()]) {
          const d = miles(tip, end === 'tail' ? cand[0] : cand[cand.length - 1])
          const touches = d <= JOIN_MI
          const better = !pick || (touches && pick.d > JOIN_MI) || ((touches || pick.d > JOIN_MI) && lengthOf(cand) > lengthOf(pick.line))
          if (d <= tol && better) pick = { line: cand, d }
        }
      }
      if (!pick) continue
      used.add(pool.find((l) => l === pick!.line || key(l) === key([...pick!.line].reverse()) || key(l) === key(pick!.line))!)
      if (end === 'tail') {
        if (pick.d > JOIN_MI) gaps.push({ atMile: lengthOf(path), miles: pick.d })
        path.push(...pick.line.slice(pick.d > JOIN_MI ? 0 : 1))
      } else {
        const shift = lengthOf(pick.line) + (pick.d > JOIN_MI ? pick.d : 0)
        gaps.forEach((g) => (g.atMile += shift))
        if (pick.d > JOIN_MI) gaps.unshift({ atMile: lengthOf(pick.line), miles: pick.d })
        path.unshift(...pick.line.slice(0, pick.d > JOIN_MI ? undefined : -1))
      }
      grew = true
    }
  }
  return { path, gaps, used }
}

// Town coordinates come from Wikipedia so placement is checkable, not typed from memory.
async function coords(titles: string[]) {
  // The API accepts at most 50 titles per request.
  const out = new Map<string, Position>()
  for (let k = 0; k < titles.length; k += 50) {
    const url =
      'https://en.wikipedia.org/w/api.php?' +
      new URLSearchParams({
        action: 'query',
        format: 'json',
        formatversion: '2',
        prop: 'coordinates',
        colimit: 'max',
        redirects: '1',
        titles: titles.slice(k, k + 50).join('|'),
      })
    const d = await politeJson(url)
    // Map redirected titles back to the title the content file asked for.
    const asked = new Map<string, string>((d.query.redirects ?? []).map((r: { from: string; to: string }) => [r.to, r.from]))
    for (const p of d.query.pages) if (p.coordinates) out.set(asked.get(p.title) ?? p.title, [p.coordinates[0].lon, p.coordinates[0].lat])
  }
  // Some articles (Ketchikan, Alaska) expose no coordinates through the API; fall back to the linked Wikidata item's P625.
  for (const title of titles.filter((t) => !out.has(t))) {
    const props = await politeJson(
      'https://en.wikipedia.org/w/api.php?' +
        new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'pageprops', redirects: '1', titles: title }),
    )
    const item = props.query?.pages?.[0]?.pageprops?.wikibase_item
    if (!item) continue
    const claims = await politeJson(
      'https://www.wikidata.org/w/api.php?' +
        new URLSearchParams({ action: 'wbgetclaims', format: 'json', property: 'P625', entity: item }),
    )
    const value = claims.claims?.P625?.[0]?.mainsnak?.datavalue?.value
    if (value) out.set(title, [value.longitude, value.latitude])
  }
  return out
}
const townCoords = await coords(content.towns.filter((t) => !t.osm).map((t) => t.wikipedia))
for (const t of content.towns) if (t.osm && t.at) townCoords.set((t.wikipedia ||= t.osm), t.at)
// Hand-written content must resolve every town; generated content just drops towns Wikipedia can't place.
if (content.generated) content.towns = content.towns.filter((t) => townCoords.has(t.wikipedia))
for (const t of content.towns) if (!townCoords.has(t.wikipedia)) throw new Error(`no Wikipedia coordinates for ${t.wikipedia}`)

// The main drive must pass every non-branch town; the branch holds the rest. Try each long piece as the seed and keep the
// main path that covers the most main-route towns, then the longest.
// Piece parts: split the road into its connected sections, longest first, and keep only the chosen section's pieces.
if (part?.piece) {
  const sections: ReturnType<typeof chain>[] = []
  let remaining = [...parts]
  while (remaining.length) {
    const seed = [...remaining].sort((a, b) => lengthOf(b) - lengthOf(a))[0]
    const section = chain(seed, remaining, GAP_MI)
    sections.push(section)
    remaining = remaining.filter((l) => !section.used.has(l))
  }
  sections.sort((a, b) => lengthOf(b.path) - lengthOf(a.path))
  const chosen = sections[part.piece - 1]
  if (!chosen) throw new Error(`${id} has only ${sections.length} section(s)`)
  parts = parts.filter((l) => chosen.used.has(l))
}
const mainTowns = content.towns.filter((t) => !t.branch)
const longest = [...parts].sort((a, b) => lengthOf(b) - lengthOf(a))
let best: ReturnType<typeof chain> | undefined
let bestScore = -1
for (const seed of longest.slice(0, 4)) {
  for (const tol of [JOIN_MI, 0.5, GAP_MI]) {
    const c = chain(seed, parts, tol)
    const cum = c.path.map((_, i) => lengthOf(c.path.slice(0, i + 1)))
    const covered = mainTowns.filter((t) => project(c.path, cum, townCoords.get(t.wikipedia)!).off < 1).length
    const score = covered * 1000 + lengthOf(c.path)
    if (score > bestScore) [best, bestScore] = [c, score]
  }
}
const main = best!
// Branch: the longest chain built from pieces not in the main path, attached where it meets the main path.
const leftovers = parts.filter((l) => !main.used.has(l))
const branchSeed = [...leftovers].sort((a, b) => lengthOf(b) - lengthOf(a))[0]
const branch = branchSeed ? chain(branchSeed, leftovers, JOIN_MI) : undefined

// Orient the main drive to start at the end named in the content (first main town nearest the start).
const cumOf = (line: Position[]) => {
  const out = [0]
  for (let i = 1; i < line.length; i++) out.push(out[i - 1] + miles(line[i - 1], line[i]))
  return out
}
let path = main.path
let cum = cumOf(path)
// Generated content lists towns in no particular order, so orient by geography instead: start at the western (or, for mostly
// north–south roads, the northern) end.
const [firstTown, lastTown] = content.generated
  ? (() => {
      const [a, b] = [path[0], path[path.length - 1]]
      const eastWest = Math.abs(a[0] - b[0]) >= Math.abs(a[1] - b[1])
      const forward = eastWest ? a[0] <= b[0] : a[1] >= b[1]
      // A part can ask to start at its eastern end (Route 66 runs Chicago → Pacific, so its western parts go east to west).
      const flip = part?.startAt === 'east' && eastWest
      return forward !== flip ? [0, 1] : [1, 0]
    })()
  : [
      project(path, cum, townCoords.get(mainTowns[0].wikipedia)!).mile,
      project(path, cum, townCoords.get(mainTowns[mainTowns.length - 1].wikipedia)!).mile,
    ]
let gaps = main.gaps
if (firstTown > lastTown) {
  const total = cum[cum.length - 1]
  path = [...path].reverse()
  cum = cumOf(path)
  gaps = gaps.map((g) => ({ atMile: total - g.atMile - g.miles, miles: g.miles })).reverse()
}
const total = cum[cum.length - 1]

let branchOut: { path: Position[]; miles: number; joinsAtMile: number; name: string } | undefined
if (branch) {
  let bp = branch.path
  // Start the branch at the end that touches the main drive.
  const s = project(path, cum, bp[0])
  const e = project(path, cum, bp[bp.length - 1])
  if (e.off < s.off) bp = [...bp].reverse()
  const join = project(path, cum, bp[0])
  if (join.off <= GAP_MI)
    branchOut = {
      path: bp,
      miles: lengthOf(bp),
      joinsAtMile: join.mile,
      name: 'tip',
      ...(part?.branchLabel ? { label: part.branchLabel } : {}),
    }
}

// ---------- 3. place things on the ribbon ----------
const catalog = (await json<{ byways: { id: string; name: string; scene: string }[] }>('public/data/catalog.json')).byways
const sceneOf = catalog.find((b) => b.id === id)?.scene ?? 'prairie'
// Sea routes (Alaska's Marine Highway) are byways but not drives: no road routing, and the UI draws them as water.
const ferry = /Marine Highway|Ferry/i.test(catalog.find((b) => b.id === id)?.name ?? '')
if (!catalog.some((b) => b.id === id)) throw new Error(`${id} not in catalog`)
const story = await json<{ moments: { title: string; kind: string; text: string; scene: string; motifs?: string[]; at?: Position }[] }>(
  `content/stories/${id}.json`,
).catch(() => ({ moments: [] }))
const photos = (
  await json<
    {
      bywayId: string
      moment?: string
      file: string
      thumb?: string
      alt: string
      author: string
      license: string
      licenseUrl: string
      sourceUrl: string
      width: number
      height: number
    }[]
  >('content/photos.json')
).filter((p) => p.bywayId === id)

type Where = { on: 'main' | 'branch'; mile: number; offRouteMiles: number; at: Position }
/** `route` pins a place to one path ('main' | 'branch'); otherwise it goes to whichever is nearer. */
function place(p: Position, route?: 'main' | 'branch'): Where | undefined {
  const m = project(path, cum, p)
  const b = branchOut ? project(branchOut.path, cumOf(branchOut.path), p) : undefined
  const useBranch = b && (route ? route === 'branch' : b.off < m.off)
  const hit = useBranch ? { on: 'branch' as const, ...b! } : { on: 'main' as const, ...m }
  // Ferry terminals often sit miles from the town centre (Juneau's is at Auke Bay), so ports may be placed from further away.
  if (hit.off > (ferry ? 20 : PLACE_MI)) return undefined
  return { on: hit.on, mile: round(hit.mile, 2), offRouteMiles: round(hit.off, 1), at: [round(p[0], 5), round(p[1], 5)] }
}
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d
const slugifyTitle = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const placed = content.towns.map((t) => {
  const where = content.generated ? place(townCoords.get(t.wikipedia)!) : place(townCoords.get(t.wikipedia)!, t.branch ? 'branch' : 'main')
  if (!where) {
    if (content.generated) return undefined
    throw new Error(`${t.name} is more than ${PLACE_MI} mi from the mapped road`)
  }
  return {
    name: t.name,
    ...(t.kind ? { kind: t.kind } : {}),
    source: t.osm
      ? `https://www.openstreetmap.org/${t.osm}`
      : `https://en.wikipedia.org/wiki/${encodeURIComponent(t.wikipedia.replace(/ /g, '_'))}`,
    ...where,
  }
})
let towns = placed.filter((t): t is NonNullable<typeof t> => !!t)
if (content.generated) {
  // Drive order, and at most one town every few miles so the ribbon doesn't crowd.
  towns.sort((a, b) => (a.on === b.on ? a.mile - b.mile : a.on === 'main' ? -1 : 1))
  const minGap = Math.max(3, (cum[cum.length - 1] || 0) / 16)
  // Space against the last town kept (comparing to the previous candidate dropped almost every town on dense roads).
  // Pick the most notable places first (Wikipedia article length, when discovery recorded it), keeping them minGap apart,
  // then restore drive order. Without weights this is the same as taking places in mile order.
  const weight = new Map(content.towns.map((t) => [t.name, t.weight ?? 0]))
  const byNotability = [...towns].sort((a, b) => (weight.get(b.name) ?? 0) - (weight.get(a.name) ?? 0) || a.mile - b.mile)
  const spaced: typeof towns = []
  for (const t of byNotability) if (spaced.every((k) => k.on !== t.on || Math.abs(k.mile - t.mile) >= minGap)) spaced.push(t)
  towns = spaced.sort((a, b) => (a.on === b.on ? a.mile - b.mile : a.on === 'main' ? -1 : 1))
  if (!content.direction && towns.length >= 2)
    content.direction = `Follows the mapped byway from ${towns[0].name} to ${towns.filter((t) => t.on === 'main').at(-1)!.name}.`
  if (!content.stretches.length) content.stretches = draftStretches(towns.filter((t) => t.on === 'main'))
}

/** Drafts 2–5 stretches between consecutive towns, each roughly a quarter of the drive; titles only, no invented descriptions. */
function draftStretches(main: { name: string; mile: number }[]): StripContent['stretches'] {
  if (main.length < 2) return []
  const total = main[main.length - 1].mile - main[0].mile
  // Long roads get up to eight stretches of roughly a sixth of the drive; others two to five of 12–45 miles.
  const long = total > 300
  const target = long ? total / 7 : Math.min(45, Math.max(12, total / 4))
  const out: StripContent['stretches'] = []
  let start = 0
  for (let i = 1; i < main.length && out.length < (long ? 8 : 5); i++) {
    if (main[i].mile - main[start].mile >= target || i === main.length - 1) {
      const [a, b] = [main[start], main[i]]
      out.push({
        id: slugifyTitle(`${a.name}-${b.name}`),
        title: `${a.name} to ${b.name}`,
        from: a.name,
        to: b.name,
        scene: sceneOf,
        line: ferry ? `Sailing between ${a.name} and ${b.name}.` : `The byway between ${a.name} and ${b.name}.`,
      })
      start = i
    }
  }
  return out
}
const moments = story.moments
  .filter((m) => m.at)
  .map((m) => {
    const where = place(m.at!)
    const photo = photos.find((p) => p.moment === m.title)
    return where ? { title: m.title, kind: m.kind, text: m.text, scene: m.scene, motifs: m.motifs ?? [], photo, ...where } : undefined
  })
  .filter(Boolean)

// ---------- 4. stretches with routed drive times ----------
function slice(line: Position[], lineCum: number[], from: number, to: number) {
  const [a, b] = from < to ? [from, to] : [to, from]
  const out = line.filter((_, i) => lineCum[i] >= a && lineCum[i] <= b)
  return from < to ? out : out.reverse()
}
/**
 * Drive time for a stretch from OSRM routing (OpenStreetMap data), accepted only when the route verifiably follows the byway:
 * its distance must be within 10% of the mapped miles and its average speed 20–65 mph. Tries the plain start→end route first, then 1–3 intermediate waypoints
 * on the byway. If nothing passes, returns null and the UI shows distance only. (OSRM's /match service was tried and rejected:
 * on mountain roads the public server matched partial traces at a flat 9.3 mph.)
 */
async function osrm(points: Position[]): Promise<{ minutes: number | null; routedMiles: number | null }> {
  // A stretch between two places at almost the same mile has no line to route; it shows distance only.
  if (points.length < 2) return { minutes: null, routedMiles: null }
  const mapped = lengthOf(points)
  const at = (f: number) => points[Math.round(f * (points.length - 1))]
  for (const waypoints of [0, 1, 3]) {
    const sample = [0, ...Array.from({ length: waypoints }, (_, i) => (i + 1) / (waypoints + 1)), 1].map(at)
    const url = `https://router.project-osrm.org/route/v1/driving/${sample.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(';')}?overview=false&continue_straight=true`
    // A routing outage on one stretch shouldn't sink the whole road: that stretch shows distance only.
    let d
    try {
      d = await politeJson(url)
    } catch {
      console.warn('  routing server unavailable; publishing distance only')
      return { minutes: null, routedMiles: null }
    }
    if (d?.code !== 'Ok') continue
    const miles = d.routes[0].distance / 1609.344
    const mph = miles / (d.routes[0].duration / 3600)
    // Distance alone can't catch a same-length detour onto a jeep road (San Juan Skyway matched at ~12 mph), so the average
    // speed must also be plausible for a paved scenic road.
    if (Math.abs(miles - mapped) / mapped <= 0.1 && mph >= 20 && mph <= 65)
      return { minutes: Math.round(d.routes[0].duration / 60), routedMiles: round(miles) }
  }
  console.warn(`  no plausible route (within 10% of ${round(mapped)} mi at 20–65 mph); publishing distance only`)
  return { minutes: null, routedMiles: null }
}

/** One request every 1.5 s, backing off on throttling (the public server answers 429 or an HTML "too many requests" page). */
async function politeJson(url: string) {
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(1500)
    try {
      const res = await fetch(url, { headers: UA })
      const text = await res.text()
      if (res.ok && text.startsWith('{')) return JSON.parse(text)
    } catch {
      // network hiccup: fall through to back-off
    }
    await sleep(10000 * (attempt + 1))
  }
  throw new Error('OSRM unavailable after retries')
}

const townAt = (name: string) =>
  towns.find((t) => t.name === name) ??
  (() => {
    throw new Error(`unknown town ${name}`)
  })()
const stretches = []
for (const s of content.stretches) {
  const a = townAt(s.from)
  const b = townAt(s.to)
  let line: Position[]
  let fromMile: number
  let toMile: number
  if (s.branch) {
    // Branch stretches start where the branch leaves the main drive (the "from" town sits on the main drive).
    const bc = cumOf(branchOut!.path)
    line = slice(branchOut!.path, bc, 0, b.mile)
    fromMile = 0
    toMile = b.mile
  } else {
    line = slice(path, cum, a.mile, b.mile)
    fromMile = a.mile
    toMile = b.mile
  }
  let routed = ferry ? { minutes: null, routedMiles: null } : await osrm(line)
  // Also check against the miles the page shows (the sliced line can drop endpoints on very short stretches).
  const shown = Math.abs(toMile - fromMile)
  if (routed.routedMiles !== null && Math.abs(routed.routedMiles - shown) / shown > 0.1) routed = { minutes: null, routedMiles: null }
  stretches.push({
    ...s,
    on: s.branch ? 'branch' : 'main',
    fromMile: round(fromMile, 2),
    toMile: round(toMile, 2),
    mappedMiles: round(Math.abs(toMile - fromMile)),
    ...routed,
  })
  console.log(`${s.title}: ${round(Math.abs(toMile - fromMile))} mi mapped, ${routed.minutes} min routed`)
}

// ---------- 5. write ----------
const simplify = (line: Position[]) => line.map((p) => [round(p[0], 5), round(p[1], 5)])
const out = {
  bywayId: id,
  title: content.title,
  reviewed: content.reviewed,
  generated: content.generated ?? false,
  mode: ferry ? 'ferry' : 'drive',
  direction: content.direction,
  builtAt: new Date().toISOString(),
  sources: {
    geometry: 'USDOT Scenic_Byways_2022_06_24 (raw snapshot in data/raw)',
    towns: content.towns.some((t) => t.osm)
      ? 'Wikipedia article coordinates; OpenStreetMap place nodes where no article exists'
      : 'Wikipedia article coordinates',
    driveTimes: 'OSRM (router.project-osrm.org), OpenStreetMap data, computed at build time; excludes stops and traffic',
  },
  main: {
    path: simplify(path),
    cumMiles: cum.map((m) => round(m, 3)),
    miles: round(total),
    gaps: gaps.map((g) => ({ atMile: round(g.atMile, 2), miles: round(g.miles, 2) })),
  },
  branch: branchOut && {
    ...branchOut,
    path: simplify(branchOut.path),
    cumMiles: cumOf(branchOut.path).map((m) => round(m, 3)),
    miles: round(branchOut.miles),
    joinsAtMile: round(branchOut.joinsAtMile, 2),
  },
  towns,
  moments,
  stretches,
}
// Drop source spikes and route connectors across gaps (repair.ts) so the car neither doubles back nor crosses water.
const repair = await repairStrip(out as unknown as Parameters<typeof repairStrip>[0])
Object.assign(out, { repaired: true })
console.log(`repair: ${repair.removed} spike point(s) removed, ${repair.connectors} gap connector(s)`)
await mkdir(new URL('public/data/strips/', ROOT), { recursive: true })
const outFile = part ? `${id}.${part.key}.json` : `${id}.json`
await writeFile(
  new URL(`public/data/strips/${outFile}`, ROOT),
  JSON.stringify(part ? { ...out, part: { key: part.key, label: part.label } } : out),
)
if (part) {
  console.log(`part ${part.key}: ${round(total)} mi, ${towns.length} places`)
  process.exit(0)
}
// Index of byways that have a strip map, so pages can offer "Unroll the road" without probing for files.
const indexUrl = new URL('public/data/strips/index.json', ROOT)
const index: string[] = await readFile(indexUrl, 'utf8')
  .then((t) => JSON.parse(t))
  .catch(() => [])
await writeFile(indexUrl, JSON.stringify([...new Set([...index, id])].sort()))
console.log(
  `main drive ${round(total)} mi with ${gaps.length} gap(s); branch ${branchOut ? round(branchOut.miles) + ' mi from mile ' + round(branchOut.joinsAtMile) : 'none'}`,
)
for (const t of towns)
  console.log(
    `  ${t.on.padEnd(6)} mile ${String(t.mile).padStart(5)}  ${t.name}${t.offRouteMiles > 0.3 ? ` (${t.offRouteMiles} mi off the road)` : ''}`,
  )
for (const m of moments)
  console.log(
    `  ${m!.on.padEnd(6)} mile ${String(m!.mile).padStart(5)}  ◆ ${m!.title}${m!.offRouteMiles > 0.3 ? ` (${m!.offRouteMiles} mi off the road)` : ''}${m!.photo ? ' [photo]' : ''}`,
  )
