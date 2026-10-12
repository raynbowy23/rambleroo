import type { Position, Polygon, MultiPolygon } from 'geojson'
import type { SceneFamily } from '../../lib/types'
import type { DioramaSpec } from '../../components/art/diorama3d/spec'
import type { StripData } from '../strip/types'
import { loadStory } from '../../lib/data'
import { circumference, type RoadPoint } from './roadGeometry'

export interface RoadCountry {
  moments?: { at?: Position; scene?: SceneFamily; title: string }[]
  strip?: StripData
  spec?: DioramaSpec
}
export async function loadRoadCountry(id: string): Promise<RoadCountry> {
  const json = async <T>(path: string): Promise<T | undefined> => {
    try {
      const response = await fetch(path)
      return response.ok ? ((await response.json()) as T) : undefined
    } catch {
      return undefined
    }
  }
  const [story, strip, spec] = await Promise.all([
    loadStory(id).catch(() => undefined),
    json<StripData>(`/data/strips/${encodeURIComponent(id)}.json`),
    json<DioramaSpec>(`/data/dioramas/${encodeURIComponent(id)}.json`),
  ])
  const moments =
    story?.moments.map((moment) => ({
      ...moment,
      at: strip?.moments.find((stop) => stop.title.toLowerCase() === moment.title.toLowerCase())?.at ?? moment.at,
    })) ?? strip?.moments
  return { moments, strip, spec }
}
export function sceneAt(point: Position, moments: RoadCountry['moments'], fallback: string) {
  let scene = fallback,
    distance = Infinity
  for (const moment of moments ?? []) {
    if (!moment.at) continue
    const d = ((moment.at[0] - point[0]) * Math.cos((point[1] * Math.PI) / 180)) ** 2 + (moment.at[1] - point[1]) ** 2
    if (d < distance) {
      distance = d
      scene = moment.scene ?? fallback
    }
  }
  return scene
}
/** Segment runs never connect disconnected parts. Nearest moment uses geographic distance. */
export function splitStretches(points: RoadPoint[], moments: RoadCountry['moments'], fallback: string) {
  const runs: { start: number; end: number; scene: string }[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1]
    const scene = sceneAt([(a.lng + b.lng) / 2, (a.lat + b.lat) / 2], moments, fallback)
    const last = runs.at(-1)
    if (last?.scene === scene) last.end = i + 1
    else runs.push({ start: i, end: i + 1, scene })
  }
  return runs
}
export function propSpacing(zoom: number, latitude: number, pixels = 48) {
  return (pixels * circumference * Math.cos((latitude * Math.PI) / 180)) / (512 * 2 ** zoom)
}
export type WaterPolygon = Polygon | MultiPolygon
const polygonBounds = new WeakMap<WaterPolygon, [number, number, number, number]>()
function boundsOf(polygon: WaterPolygon) {
  let bounds = polygonBounds.get(polygon)
  if (!bounds) {
    bounds = [Infinity, Infinity, -Infinity, -Infinity]
    for (const rings of polygon.type === 'Polygon' ? [polygon.coordinates] : polygon.coordinates)
      for (const [x, y] of rings[0]) {
        bounds[0] = Math.min(bounds[0], x)
        bounds[1] = Math.min(bounds[1], y)
        bounds[2] = Math.max(bounds[2], x)
        bounds[3] = Math.max(bounds[3], y)
      }
    polygonBounds.set(polygon, bounds)
  }
  return bounds
}
function overlaps(polygon: WaterPolygon, a: Position, b = a) {
  const [west, south, east, north] = boundsOf(polygon)
  return Math.max(a[0], b[0]) >= west && Math.min(a[0], b[0]) <= east && Math.max(a[1], b[1]) >= south && Math.min(a[1], b[1]) <= north
}
function inRing(p: Position, ring: Position[]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j]
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}
export function onWater(p: Position, polygons: WaterPolygon[]) {
  return polygons.some(
    (g) =>
      overlaps(g, p) &&
      (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).some(
        (rings) => inRing(p, rings[0]) && !rings.slice(1).some((r) => inRing(p, r)),
      ),
  )
}
/** Clip against all rings, then classify interval interiors: handles holes and narrow crossings with dry endpoints. */
export function waterCrossings(a: Position, b: Position, polygons: WaterPolygon[]): [number, number][] {
  const cuts = [0, 1],
    dx = b[0] - a[0],
    dy = b[1] - a[1]
  for (const g of polygons.filter((g) => overlaps(g, a, b)))
    for (const rings of g.type === 'Polygon' ? [g.coordinates] : g.coordinates)
      for (const ring of rings)
        for (let i = 1; i < ring.length; i++) {
          const c = ring[i - 1],
            d = ring[i],
            ex = d[0] - c[0],
            ey = d[1] - c[1],
            den = dx * ey - dy * ex
          if (Math.abs(den) < 1e-15) continue
          const t = ((c[0] - a[0]) * ey - (c[1] - a[1]) * ex) / den
          const u = ((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) / den
          if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t)
        }
  cuts.sort((x, y) => x - y)
  return cuts.slice(1).flatMap((end, i) => {
    const start = cuts[i],
      t = (start + end) / 2
    return end > start && onWater([a[0] + dx * t, a[1] + dy * t], polygons) ? [[start, end] as [number, number]] : []
  })
}
