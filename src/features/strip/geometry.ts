import type { Coordinate, Stretch, StripPath } from './types'

export const pixelsPerMile = (miles: number, phone = false) => clamp((phone ? 7000 : 9000) / Math.max(1, miles), 18, 110)
export const milePostInterval = (scale: number) => (scale >= 60 ? 5 : scale >= 30 ? 10 : 25)
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

/** Binary search keeps scroll updates independent of the number of source vertices. */
export function coordinateAtMile(route: StripPath, mile: number): Coordinate {
  const { path, cumMiles } = route
  if (!path.length) throw new Error('A strip path needs coordinates')
  if (mile <= 0 || path.length === 1) return [...path[0]]
  if (mile >= cumMiles[cumMiles.length - 1]) return [...path[path.length - 1]]
  let low = 0
  let high = cumMiles.length - 1
  while (high - low > 1) {
    const middle = (low + high) >> 1
    if (cumMiles[middle] <= mile) low = middle
    else high = middle
  }
  const span = cumMiles[high] - cumMiles[low]
  const fraction = span ? (mile - cumMiles[low]) / span : 0
  return [path[low][0] + (path[high][0] - path[low][0]) * fraction, path[low][1] + (path[high][1] - path[low][1]) * fraction]
}
function bearing(a: Coordinate, b: Coordinate) {
  return Math.atan2((b[0] - a[0]) * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180), b[1] - a[1])
}
/** Signed bearing change over a mile; straight roads settle at zero, turns bend the ribbon. */
export function swayAtMile(route: StripPath, mile: number, window = 0.7, amplitude = 1) {
  const a = coordinateAtMile(route, Math.max(0, mile - window))
  const b = coordinateAtMile(route, mile)
  const c = coordinateAtMile(route, Math.min(route.cumMiles.at(-1)!, mile + window))
  if ((a[0] === b[0] && a[1] === b[1]) || (b[0] === c[0] && b[1] === c[1])) return 0
  const change = bearing(b, c) - bearing(a, b)
  return clamp(Math.atan2(Math.sin(change), Math.cos(change)) * 9 * amplitude, -13 * amplitude, 13 * amplitude)
}
export function sideOfRoad(route: StripPath, mile: number, point: Coordinate): 'left' | 'right' {
  const a = coordinateAtMile(route, Math.max(0, mile - 0.05))
  const b = coordinateAtMile(route, mile + 0.05)
  const cross = (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0])
  return cross > 0 ? 'left' : 'right'
}
export function googleMapsUrl(route: StripPath, stretch: Pick<Stretch, 'fromMile' | 'toMile'>) {
  const start = clamp(stretch.fromMile, 0, route.miles)
  const end = clamp(stretch.toMile, 0, route.miles)
  const coordinate = (mile: number) => {
    const [lng, lat] = coordinateAtMile(route, mile)
    return `${lat.toFixed(6)},${lng.toFixed(6)}`
  }
  const params = new URLSearchParams({ api: '1', origin: coordinate(start), destination: coordinate(end), travelmode: 'driving' })
  if (end !== start) params.set('waypoints', [1, 2, 3].map((i) => coordinate(start + ((end - start) * i) / 4)).join('|'))
  return `https://www.google.com/maps/dir/?${params}`
}
export function mappedIntervals(route: StripPath, from = 0, to = route.miles) {
  const intervals: [number, number][] = []
  let cursor = from
  for (const gap of route.gaps ?? []) {
    if (gap.atMile > cursor) intervals.push([cursor, Math.min(to, gap.atMile)])
    cursor = Math.max(cursor, gap.atMile + gap.miles)
    if (cursor >= to) break
  }
  if (cursor < to) intervals.push([cursor, to])
  return intervals.filter(([a, b]) => b > a)
}
export function buildRibbon(route: StripPath, scale = pixelsPerMile(route.miles)) {
  // On compressed (long) roads, keep samples ≥ 10 px apart, read curvature over a wider window, and soften the sway, so the
  // ribbon bends with the big turns instead of zigzagging on every switchback. Full-scale roads keep 1/8-mile detail.
  const step = Math.max(1 / 8, 10 / scale)
  const window = Math.max(0.7, step * 2.5)
  const amplitude = clamp(scale / 80, 0.45, 1)
  const samples = Array.from({ length: Math.ceil(route.miles / step) + 1 }, (_, i) => {
    const mile = Math.min(route.miles, i * step)
    return { mile, x: swayAtMile(route, mile, window, amplitude) }
  })
  const offset = (mile: number) => {
    const index = Math.min(samples.length - 2, Math.floor(clamp(mile, 0, route.miles) / step))
    const a = samples[index],
      b = samples[index + 1]
    return a.x + (b.x - a.x) * clamp((mile - a.mile) / (b.mile - a.mile || 1), 0, 1)
  }
  const path = (from: number, to: number) => {
    const miles = [from, ...samples.filter((p) => p.mile > from && p.mile < to).map((p) => p.mile), to]
    return miles.map((mile, i) => `${i ? 'L' : 'M'}${50 + offset(mile)},${(mile - from) * scale}`).join(' ')
  }
  return { offset, path }
}
