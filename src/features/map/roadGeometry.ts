import type { Position } from 'geojson'

/** Selected ribbon's extra deck height, in ribbon widths; released with its layer. */
export const roadDeckLift = new WeakMap<object, (point: Position) => number>()

export const circumference = 40075016.686
export const ribbonFade = (zoom: number) => Math.max(0, Math.min(1, (zoom - 9) / 1.5))
/** Match selected-art's interpolated screen width, without a street-zoom width floor. */
export function ribbonWidth(zoom: number, latitude: number) {
  const stops = [
    [2, 5],
    [6, 11],
    [8, 14],
    [11, 19],
    [14, 26],
  ]
  let pixels = stops[0][1]
  for (let i = 1; i < stops.length; i++) {
    const [z, width] = stops[i],
      [previousZ, previousWidth] = stops[i - 1]
    if (zoom >= previousZ) pixels = previousWidth + (width - previousWidth) * Math.min(1, (zoom - previousZ) / (z - previousZ))
  }
  return (pixels * circumference * Math.cos((latitude * Math.PI) / 180)) / (512 * 2 ** zoom)
}
export type RoadPoint = { x: number; y: number; lng: number; lat: number }

/** Local Mercator metres. Unwrap dateline crossings instead of spanning the world. */
export function projectRoad(parts: Position[][]) {
  const first = parts.find((part) => part.length > 1)?.[0] ?? [0, 0]
  const latitude = first[1]
  const scale = Math.cos((latitude * Math.PI) / 180)
  const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * Math.PI) / 360))
  const originY = mercY(latitude)
  return {
    origin: first as [number, number],
    parts: parts
      .filter((part) => part.length > 1)
      .map((part) => {
        let previous = first[0]
        return part.map(([lng, lat]) => {
          const unwrapped = previous + ((((lng - previous) % 360) + 540) % 360) - 180
          previous = unwrapped
          return {
            x: ((unwrapped - first[0]) / 360) * circumference * scale,
            y: ((originY - mercY(lat)) / (2 * Math.PI)) * circumference * scale,
            lng,
            lat,
          }
        })
      }),
  }
}

/** Iterative Douglas–Peucker preserves bends without recursive stack growth on long roads. */
export function simplifyRoad(points: RoadPoint[], tolerance = 8): RoadPoint[] {
  if (points.length < 3) return points
  const keep = new Set([0, points.length - 1])
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [start, end] = stack.pop()!
    const a = points[start],
      b = points[end]
    const dx = b.x - a.x,
      dy = b.y - a.y,
      length = dx * dx + dy * dy
    let farthest = -1,
      distance = tolerance * tolerance
    for (let i = start + 1; i < end; i++) {
      const p = points[i]
      const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0
      const d = (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2
      if (d > distance) {
        distance = d
        farthest = i
      }
    }
    if (farthest >= 0) {
      keep.add(farthest)
      stack.push([start, farthest], [farthest, end])
    }
  }
  return [...keep].sort((a, b) => a - b).map((i) => points[i])
}

/** Bound complexity across all parts; add samples to long straight spans for terrain draping. */
export function sampleRoad(parts: RoadPoint[][], budget = 12000) {
  let tolerance = 8
  let simplified = parts.map((p) => simplifyRoad(p, tolerance))
  while (simplified.reduce((n, p) => n + p.length, 0) > budget / 2 && tolerance < circumference) {
    tolerance *= 2
    simplified = parts.map((p) => simplifyRoad(p, tolerance))
  }
  const total = simplified.reduce((n, p) => n + p.slice(1).reduce((sum, b, i) => sum + Math.hypot(b.x - p[i].x, b.y - p[i].y), 0), 0)
  const spacing = Math.max(100, total / (budget / 2))
  return simplified.map((part) =>
    part.flatMap((a, i) => {
      const b = part[i + 1]
      if (!b) return [a]
      const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / spacing))
      return Array.from({ length: count }, (_, j) => {
        const t = j / count
        const delta = ((((b.lng - a.lng) % 360) + 540) % 360) - 180
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, lng: a.lng + delta * t, lat: a.lat + (b.lat - a.lat) * t }
      })
    }),
  )
}

/** Bounded mitres prevent spikes at switchbacks and tolerate duplicate coordinates. */
export function roadNormal(points: RoadPoint[], i: number): [number, number] {
  const a = points[Math.max(0, i - 1)],
    p = points[i],
    b = points[Math.min(points.length - 1, i + 1)]
  const normal = (dx: number, dy: number) => {
    const d = Math.hypot(dx, dy)
    return d ? [-dy / d, dx / d] : [0, 0]
  }
  const before = normal(p.x - a.x, p.y - a.y),
    after = normal(b.x - p.x, b.y - p.y)
  if (!Math.hypot(...after)) return before as [number, number]
  if (!Math.hypot(...before)) return after as [number, number]
  const nx = before[0] + after[0],
    ny = before[1] + after[1],
    length = Math.hypot(nx, ny)
  if (length < 0.001) return after as [number, number]
  const x = nx / length,
    y = ny / length
  const dot = Math.abs(x * after[0] + y * after[1])
  const miter = Math.min(2, 1 / Math.max(0.5, dot))
  return [x * miter, y * miter]
}
