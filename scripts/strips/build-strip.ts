// Builds a strip-map ("ribbon") dataset for one curated byway: the byway's source pieces chained into one ordered drive with
// cumulative miles, a side branch where the road forks, towns / story moments / photos placed at their true mile, and
// editorial stretches with drive times routed by OSRM once at build time.
// Honesty rules: pieces are joined only where their ends meet; any larger break is kept as a labelled gap, never bridged.
// Usage: npx tsx scripts/strips/build-strip.ts door-county-coastal-byway-81450
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import type { Position } from 'geojson'

const ROOT = new URL('../../', import.meta.url)
const UA = { 'User-Agent': 'Rambleroo/0.1 (scenic byway strip maps; personal project)' }
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
  towns: { name: string; wikipedia: string; branch?: string }[]
  stretches: { id: string; title: string; from: string; to: string; branch?: string; scene: string; line: string }[]
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
    const t = len2 ? Math.max(0, Math.min(1, (((p[0] - ax) * kx) * dx + (p[1] - ay) * dy) / len2)) : 0
    const q: Position = [ax + (bx - ax) * t, ay + (by - ay) * t]
    const off = miles(p, q)
    if (off < best.off) best = { mile: cum[i] + miles(line[i], q), off, at: q }
  }
  return best
}

// ---------- 1. collect source parts ----------
const raw = await json<{ features: { properties: { BYWAY_ID: number }; geometry: { type: string; coordinates: Position[] | Position[][] } }[] }>(
  'data/raw/scenic_byways.geojson',
)
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

// ---------- 2. chain pieces into paths ----------
/** Grow a path from `seed` at both ends, always attaching the longest unused piece whose end is within `tol` miles. */
function chain(seed: Position[], pool: Position[][], tol: number) {
  const path = [...seed]
  const gaps: { atMile: number; miles: number }[] = []
  const used = new Set<Position[]>([seed])
  for (let grew = true; grew; ) {
    grew = false
    for (const end of ['tail', 'head'] as const) {
      const tip = end === 'tail' ? path[path.length - 1] : path[0]
      let pick: { line: Position[]; d: number } | undefined
      for (const l of pool) {
        if (used.has(l)) continue
        for (const cand of [l, [...l].reverse()]) {
          const d = miles(tip, end === 'tail' ? cand[0] : cand[cand.length - 1])
          if (d <= tol && (!pick || lengthOf(cand) > lengthOf(pick.line))) pick = { line: cand, d }
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

const content = await json<StripContent>(`content/strips/${id}.json`)

// Town coordinates come from Wikipedia so placement is checkable, not typed from memory.
async function coords(titles: string[]) {
  const url =
    'https://en.wikipedia.org/w/api.php?' +
    new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'coordinates', titles: titles.join('|') })
  const d = await (await fetch(url, { headers: UA })).json()
  const out = new Map<string, Position>()
  for (const p of d.query.pages) if (p.coordinates) out.set(p.title, [p.coordinates[0].lon, p.coordinates[0].lat])
  return out
}
const townCoords = await coords(content.towns.map((t) => t.wikipedia))
for (const t of content.towns) if (!townCoords.has(t.wikipedia)) throw new Error(`no Wikipedia coordinates for ${t.wikipedia}`)

// The main drive must pass every non-branch town; the branch holds the rest. Try each long piece as the seed and keep the
// main path that covers the most main-route towns, then the longest.
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
const firstTown = project(path, cum, townCoords.get(mainTowns[0].wikipedia)!).mile
const lastTown = project(path, cum, townCoords.get(mainTowns[mainTowns.length - 1].wikipedia)!).mile
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
  if (join.off <= GAP_MI) branchOut = { path: bp, miles: lengthOf(bp), joinsAtMile: join.mile, name: 'tip' }
}

// ---------- 3. place things on the ribbon ----------
const catalog = (await json<{ byways: { id: string; name: string }[] }>('public/data/catalog.json')).byways
if (!catalog.some((b) => b.id === id)) throw new Error(`${id} not in catalog`)
const story = await json<{ moments: { title: string; kind: string; text: string; scene: string; motifs?: string[]; at?: Position }[] }>(
  `content/stories/${id}.json`,
).catch(() => ({ moments: [] }))
const photos = (await json<{ bywayId: string; moment?: string; file: string; thumb?: string; alt: string; author: string; license: string; licenseUrl: string; sourceUrl: string; width: number; height: number }[]>('content/photos.json')).filter(
  (p) => p.bywayId === id,
)

type Where = { on: 'main' | 'branch'; mile: number; offRouteMiles: number; at: Position }
/** `route` pins a place to one path ('main' | 'branch'); otherwise it goes to whichever is nearer. */
function place(p: Position, route?: 'main' | 'branch'): Where | undefined {
  const m = project(path, cum, p)
  const b = branchOut ? project(branchOut.path, cumOf(branchOut.path), p) : undefined
  const useBranch = b && (route ? route === 'branch' : b.off < m.off)
  const hit = useBranch ? { on: 'branch' as const, ...b! } : { on: 'main' as const, ...m }
  if (hit.off > PLACE_MI) return undefined
  return { on: hit.on, mile: round(hit.mile, 2), offRouteMiles: round(hit.off, 1), at: [round(p[0], 5), round(p[1], 5)] }
}
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d

const towns = content.towns.map((t) => {
  const where = place(townCoords.get(t.wikipedia)!, t.branch ? 'branch' : 'main')
  if (!where) throw new Error(`${t.name} is more than ${PLACE_MI} mi from the mapped road`)
  return { name: t.name, source: `https://en.wikipedia.org/wiki/${encodeURIComponent(t.wikipedia.replace(/ /g, '_'))}`, ...where }
})
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
async function osrm(points: Position[]) {
  // Waypoints sampled along the mapped stretch keep the router on the byway rather than a faster parallel road.
  const n = Math.min(10, points.length)
  const sample = Array.from({ length: n }, (_, i) => points[Math.round((i * (points.length - 1)) / (n - 1))])
  const url = `https://router.project-osrm.org/route/v1/driving/${sample.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(';')}?overview=false`
  for (let i = 0; i < 5; i++) {
    await sleep(1200)
    const res = await fetch(url, { headers: UA })
    if (res.ok) {
      const d = await res.json()
      if (d.code === 'Ok') return { minutes: Math.round(d.routes[0].duration / 60), routedMiles: round(d.routes[0].distance / 1609.344) }
    }
    await sleep(5000 * (i + 1))
  }
  throw new Error('OSRM unavailable')
}
const townAt = (name: string) => towns.find((t) => t.name === name) ?? (() => { throw new Error(`unknown town ${name}`) })()
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
  const routed = await osrm(line)
  stretches.push({ ...s, on: s.branch ? 'branch' : 'main', fromMile: round(fromMile, 2), toMile: round(toMile, 2), mappedMiles: round(Math.abs(toMile - fromMile)), ...routed })
  console.log(`${s.title}: ${round(Math.abs(toMile - fromMile))} mi mapped, ${routed.minutes} min routed`)
}

// ---------- 5. write ----------
const simplify = (line: Position[]) => line.map((p) => [round(p[0], 5), round(p[1], 5)])
const out = {
  bywayId: id,
  title: content.title,
  reviewed: content.reviewed,
  direction: content.direction,
  builtAt: new Date().toISOString(),
  sources: {
    geometry: 'USDOT Scenic_Byways_2022_06_24 (raw snapshot in data/raw)',
    towns: 'Wikipedia article coordinates',
    driveTimes: 'OSRM (router.project-osrm.org), OpenStreetMap data, computed at build time; excludes stops and traffic',
  },
  main: { path: simplify(path), cumMiles: cum.map((m) => round(m, 3)), miles: round(total), gaps: gaps.map((g) => ({ atMile: round(g.atMile, 2), miles: round(g.miles, 2) })) },
  branch: branchOut && { ...branchOut, path: simplify(branchOut.path), cumMiles: cumOf(branchOut.path).map((m) => round(m, 3)), miles: round(branchOut.miles), joinsAtMile: round(branchOut.joinsAtMile, 2) },
  towns,
  moments,
  stretches,
}
await mkdir(new URL('public/data/strips/', ROOT), { recursive: true })
await writeFile(new URL(`public/data/strips/${id}.json`, ROOT), JSON.stringify(out))
// Index of byways that have a strip map, so pages can offer "Unroll the road" without probing for files.
const indexUrl = new URL('public/data/strips/index.json', ROOT)
const index: string[] = await readFile(indexUrl, 'utf8').then((t) => JSON.parse(t)).catch(() => [])
await writeFile(indexUrl, JSON.stringify([...new Set([...index, id])].sort()))
console.log(`main drive ${round(total)} mi with ${gaps.length} gap(s); branch ${branchOut ? round(branchOut.miles) + ' mi from mile ' + round(branchOut.joinsAtMile) : 'none'}`)
for (const t of towns) console.log(`  ${t.on.padEnd(6)} mile ${String(t.mile).padStart(5)}  ${t.name}${t.offRouteMiles > 0.3 ? ` (${t.offRouteMiles} mi off the road)` : ''}`)
for (const m of moments) console.log(`  ${m!.on.padEnd(6)} mile ${String(m!.mile).padStart(5)}  ◆ ${m!.title}${m!.offRouteMiles > 0.3 ? ` (${m!.offRouteMiles} mi off the road)` : ''}${m!.photo ? ' [photo]' : ''}`)
