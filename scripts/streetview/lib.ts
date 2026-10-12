// Shared Mapillary search and geometry helpers for the street-view scripts.
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

export const ROOT = new URL('../../', import.meta.url)
const HALF = 0.006 // degrees; Mapillary's search fails on large or dense boxes

async function token() {
  if (process.env.MAPILLARY_TOKEN) return process.env.MAPILLARY_TOKEN
  const vars = existsSync(new URL('.dev.vars', ROOT)) ? await readFile(new URL('.dev.vars', ROOT), 'utf8') : ''
  const t = vars.match(/^MAPILLARY_TOKEN=\s*"?([^"\n]+)"?/m)?.[1]
  if (!t) throw new Error('MAPILLARY_TOKEN is not set (environment or .dev.vars)')
  return t.trim()
}
const TOKEN = await token()
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface Image {
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
export async function search(lon: number, lat: number, half = HALF): Promise<Image[]> {
  const q = new URLSearchParams({
    bbox: [lon - half, lat - half, lon + half, lat + half].map((n) => n.toFixed(6)).join(','),
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

export type Pt = [number, number]
const R = 6371000
const rad = Math.PI / 180
export function metres(a: Pt, b: Pt) {
  const x = (b[0] - a[0]) * rad * Math.cos(((a[1] + b[1]) / 2) * rad)
  const y = (b[1] - a[1]) * rad
  return Math.hypot(x, y) * R
}
export function bearing(a: Pt, b: Pt) {
  const y = Math.sin((b[0] - a[0]) * rad) * Math.cos(b[1] * rad)
  const x = Math.cos(a[1] * rad) * Math.sin(b[1] * rad) - Math.sin(a[1] * rad) * Math.cos(b[1] * rad) * Math.cos((b[0] - a[0]) * rad)
  return (Math.atan2(y, x) / rad + 360) % 360
}
/** Distance from p to the nearest segment, and that segment's bearing. */
export function nearest(p: Pt, lines: Pt[][]) {
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
export function samples(lines: Pt[][], n: number): Pt[] {
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
export const turn = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)

/** Frames and moments a person looked at and turned down: the landmark is not in view, or the picture is poor. Reruns skip them. */
export const rejects = JSON.parse(await readFile(new URL('scripts/streetview/rejects.json', ROOT), 'utf8')) as {
  moments: { bywayId: string; moment: string; reason: string }[]
  images: { id: string; reason: string }[]
}
export const rejectedImage = new Set(rejects.images.map((r) => r.id))
