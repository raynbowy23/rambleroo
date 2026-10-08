// Picks a few Mapillary street-level frames along each byway for the "From the road" strip.
// Only image ids and credit are stored; the Worker fetches the picture itself at request time, since Mapillary image URLs expire.
// A frame qualifies when it is a flat (not 360°) photo taken on the mapped line and looking along the road. The best one per stretch of road wins.
// Usage: npx tsx scripts/streetview/discover.ts [byway-id ...]   (no ids = every byway; existing picks are kept unless --refresh)
// Needs MAPILLARY_TOKEN in the environment or in .dev.vars.
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { StreetView } from '../../src/lib/types'

const ROOT = new URL('../../', import.meta.url)
const OUT = new URL('content/streetview.json', ROOT)
const PER_ROAD = 3
const SAMPLES = 12 // points tried per road, spread evenly
const HALF = 0.006 // degrees; Mapillary's search fails on large or dense boxes
const ON_ROAD_M = 25
const ALONG_DEG = 35

async function token() {
  if (process.env.MAPILLARY_TOKEN) return process.env.MAPILLARY_TOKEN
  const vars = existsSync(new URL('.dev.vars', ROOT)) ? await readFile(new URL('.dev.vars', ROOT), 'utf8') : ''
  const t = vars.match(/^MAPILLARY_TOKEN=\s*"?([^"\n]+)"?/m)?.[1]
  if (!t) throw new Error('MAPILLARY_TOKEN is not set (environment or .dev.vars)')
  return t.trim()
}
const TOKEN = await token()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Image {
  id: string
  captured_at: number
  is_pano: boolean
  quality_score?: number
  compass_angle?: number
  computed_compass_angle?: number
  creator?: { username: string }
  width?: number
  height?: number
  camera_type?: string
  sequence?: string
  geometry: { coordinates: [number, number] }
}
async function search(lon: number, lat: number): Promise<Image[]> {
  const q = new URLSearchParams({
    bbox: [lon - HALF, lat - HALF, lon + HALF, lat + HALF].map((n) => n.toFixed(6)).join(','),
    limit: '100',
    fields: 'id,captured_at,is_pano,quality_score,compass_angle,computed_compass_angle,creator,geometry,width,height,camera_type,sequence',
  })
  // The search endpoint times out or returns 500 now and then, even on small boxes, so retry with backoff.
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(`https://graph.mapillary.com/images?${q}`, {
        headers: { Authorization: `OAuth ${TOKEN}` },
        signal: AbortSignal.timeout(30000),
      })
      if (res.ok) return ((await res.json()) as { data: Image[] }).data
      if (res.status < 500 && res.status !== 429) throw new Error(`Mapillary ${res.status}`)
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Mapillary 4')) throw e
    }
    await sleep(2000 * (i + 1))
  }
  return []
}

type Pt = [number, number]
const R = 6371000
const rad = Math.PI / 180
function metres(a: Pt, b: Pt) {
  const x = (b[0] - a[0]) * rad * Math.cos(((a[1] + b[1]) / 2) * rad)
  const y = (b[1] - a[1]) * rad
  return Math.hypot(x, y) * R
}
function bearing(a: Pt, b: Pt) {
  const y = Math.sin((b[0] - a[0]) * rad) * Math.cos(b[1] * rad)
  const x = Math.cos(a[1] * rad) * Math.sin(b[1] * rad) - Math.sin(a[1] * rad) * Math.cos(b[1] * rad) * Math.cos((b[0] - a[0]) * rad)
  return (Math.atan2(y, x) / rad + 360) % 360
}
/** Distance from p to the nearest segment, and that segment's bearing. */
function nearest(p: Pt, lines: Pt[][]) {
  let best = { d: Infinity, heading: 0 }
  for (const line of lines)
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1],
        b = line[i]
      const k = Math.cos(p[1] * rad)
      const [ax, ay, bx, by, px, py] = [a[0] * k, a[1], b[0] * k, b[1], p[0] * k, p[1]]
      const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2 || 1)))
      const d = metres(p, [(ax + t * (bx - ax)) / k, ay + t * (by - ay)])
      if (d < best.d) best = { d, heading: bearing(a, b) }
    }
  return best
}
/** Evenly spaced points along the road, by distance. */
function samples(lines: Pt[][], n: number): Pt[] {
  const segs = lines.flatMap((l) => l.slice(1).map((b, i) => [l[i], b, metres(l[i], b)] as const))
  const total = segs.reduce((s, [, , d]) => s + d, 0)
  const out: Pt[] = []
  let walked = 0,
    next = total / n / 2
  for (const [a, b, d] of segs) {
    while (d > 0 && next <= walked + d && out.length < n) {
      const t = (next - walked) / d
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
      next += total / n
    }
    walked += d
  }
  return out
}
const turn = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)

async function pick(id: string, lines: Pt[][]): Promise<StreetView[]> {
  const points = samples(lines, SAMPLES)
  const found: { img: Image; stretch: number; score: number }[] = []
  for (const [i, [lon, lat]] of points.entries()) {
    for (const img of await search(lon, lat)) {
      // Flat, landscape, ordinary-lens frames only: no 360° panoramas, fisheye distortion or phones held upright.
      if (img.is_pano || (img.camera_type && img.camera_type !== 'perspective')) continue
      if (!img.width || !img.height || img.width <= img.height) continue
      const at = img.geometry.coordinates
      const { d, heading } = nearest(at, lines)
      const look = img.computed_compass_angle ?? img.compass_angle
      if (d > ON_ROAD_M || look === undefined) continue
      // Looking up or down the road, not out a side window.
      if (Math.min(turn(look, heading), turn(look, heading + 180)) > ALONG_DEG) continue
      const years = (Date.now() - img.captured_at) / 3.156e10
      found.push({
        img,
        stretch: Math.floor((i * PER_ROAD) / points.length),
        score: (img.quality_score ?? 0.5) - Math.min(years, 12) * 0.02,
      })
    }
    await sleep(150)
  }
  const chosen: StreetView[] = []
  // One frame per stretch of road, and never two from the same drive, so the strip shows different days and drivers.
  const used = new Set<string>()
  for (let stretch = 0; stretch < PER_ROAD; stretch++) {
    const best = found.filter((f) => f.stretch === stretch && !used.has(f.img.sequence ?? f.img.id)).sort((a, b) => b.score - a.score)[0]
    if (!best) continue
    const { img } = best
    used.add(img.sequence ?? img.id)
    chosen.push({
      bywayId: id,
      id: img.id,
      at: img.geometry.coordinates.map((n) => +n.toFixed(5)) as Pt,
      captured: new Date(img.captured_at).toISOString().slice(0, 10),
      creator: img.creator?.username ?? 'Mapillary contributor',
    })
  }
  return chosen
}

const args = process.argv.slice(2)
const refresh = args.includes('--refresh')
const wanted = args.filter((a) => !a.startsWith('--'))
const geo = JSON.parse(await readFile(new URL('public/data/byways.geojson', ROOT), 'utf8')) as {
  features: { properties: { id: string }; geometry: { coordinates: Pt[][] } }[]
}
const roads = new Map<string, Pt[][]>()
for (const f of geo.features) roads.set(f.properties.id, [...(roads.get(f.properties.id) ?? []), ...f.geometry.coordinates])
const existing: StreetView[] = existsSync(OUT) ? JSON.parse(await readFile(OUT, 'utf8')) : []
const done = new Set(existing.map((v) => v.bywayId))
const ids = (wanted.length ? wanted : [...roads.keys()]).filter((id) => refresh || !done.has(id))
let views = existing.filter((v) => !ids.includes(v.bywayId))
for (const [n, id] of ids.entries()) {
  const lines = roads.get(id)
  if (!lines) {
    console.warn(`unknown byway ${id}`)
    continue
  }
  const chosen = await pick(id, lines)
  views = [...views, ...chosen]
  console.log(`${n + 1}/${ids.length} ${id}: ${chosen.length}`)
  // Save as we go so a long run can be stopped and resumed.
  await writeFile(
    OUT,
    JSON.stringify(
      views.sort((a, b) => a.bywayId.localeCompare(b.bywayId)),
      null,
      2,
    ) + '\n',
  )
}
