// Cleans a built strip route before it is published, so the car neither doubles back nor crosses water:
//  1. Spikes: a point where the line turns back on itself (> 150°) is dropped when it sits at a gap end (the next source piece starts
//     behind where the last one ended) or when the line returns within 150 ft of where it left (an out-and-back stub in the source).
//     Real hairpins come back further apart than that and are kept. Every mile on the strip is remapped so places stay where they were.
//  2. Gap connectors: each unmapped gap gets the OSRM route between its two ends (OpenStreetMap roads), stored as `via` for drawing
//     and for moving the car. The gap itself stays a gap: the ribbon still says the source data has no road there.
import type { Position } from 'geojson'

const R = 3958.8
const rad = (d: number) => (d * Math.PI) / 180
export const miles = (a: Position, b: Position) =>
  2 *
  R *
  Math.asin(
    Math.sqrt(Math.sin(rad(b[1] - a[1]) / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2),
  )
const bearing = (a: Position, b: Position) =>
  (Math.atan2(
    Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1])),
    Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0])),
  ) *
    180) /
  Math.PI
const turn = (a: Position, b: Position, c: Position) => Math.abs(((bearing(b, c) - bearing(a, b) + 540) % 360) - 180)
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d

const SPIKE_TURN = 150
const STUB_RETURN_MI = 150 / 5280
const MIN_GAP_MI = 0.02

export interface Gap {
  atMile: number
  miles: number
  via?: Position[]
}
export interface Route {
  path: Position[]
  cumMiles: number[]
  miles: number
  gaps?: Gap[]
}

/** Drops spike points and returns the repaired route plus a function that maps an old mile on this route to its new mile. */
export function despike(route: Route): { route: Route; remap: (mile: number) => number; removed: number } {
  // Mark which segments are gaps (segment i joins point i and i + 1).
  const gapSegment = route.path
    .slice(1)
    .map((_, i) =>
      (route.gaps ?? []).some(
        (g) => Math.abs(route.cumMiles[i] - g.atMile) < 0.011 && Math.abs(route.cumMiles[i + 1] - route.cumMiles[i] - g.miles) < 0.011,
      ),
    )
  const points = route.path.map((p, i) => ({ p, old: route.cumMiles[i] }))
  let removed = 0
  for (let changed = true; changed;) {
    changed = false
    for (let i = 1; i < points.length - 1; i++) {
      const [a, b, c] = [points[i - 1].p, points[i].p, points[i + 1].p]
      if (miles(a, b) < 1e-5 || miles(b, c) < 1e-5) continue
      if (turn(a, b, c) <= SPIKE_TURN) continue
      const atGap = gapSegment[i - 1] || gapSegment[i]
      if (!atGap && miles(a, c) > STUB_RETURN_MI) continue
      gapSegment.splice(i - 1, 2, atGap)
      points.splice(i, 1)
      removed++
      changed = true
    }
  }
  const cum = [0]
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + miles(points[i - 1].p, points[i].p))
  const gaps: Gap[] = []
  gapSegment.forEach((isGap, i) => {
    const length = cum[i + 1] - cum[i]
    if (isGap && length >= MIN_GAP_MI) gaps.push({ atMile: round(cum[i]), miles: round(length) })
  })
  const olds = points.map((p) => p.old)
  const remap = (mile: number) => {
    if (mile <= olds[0]) return 0
    if (mile >= olds.at(-1)!) return round(cum.at(-1)!)
    let hi = olds.findIndex((o) => o >= mile)
    const lo = hi - 1
    const f = (mile - olds[lo]) / (olds[hi] - olds[lo] || 1)
    return round(cum[lo] + (cum[hi] - cum[lo]) * f)
  }
  return {
    route: { ...route, path: points.map((p) => p.p), cumMiles: cum.map((c) => round(c, 3)), miles: round(cum.at(-1)!, 1), gaps },
    remap,
    removed,
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function osrm(a: Position, b: Position) {
  const url = `https://router.project-osrm.org/route/v1/driving/${a[0].toFixed(5)},${a[1].toFixed(5)};${b[0].toFixed(5)},${b[1].toFixed(5)}?overview=full&geometries=geojson`
  for (let i = 0; i < 6; i++) {
    await sleep(1100)
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Rambleroo/0.1 (scenic byway strip maps; personal project; https://rambleroo.app; https://github.com/raynbowy23/rambleroo/issues)',
        },
      })
      if (res.ok) return (await res.json()) as { code: string; routes?: { distance: number; geometry: { coordinates: Position[] } }[] }
    } catch {
      // retry below
    }
    await sleep(10000 * (i + 1))
  }
  return undefined
}

/**
 * Adds an OpenStreetMap connector to each gap. A connector is kept only when it is a plausible way across: no longer than three times
 * the straight line (or the straight line plus two miles), and starting and ending within a tenth of a mile of the gap's ends.
 */
export async function addConnectors(route: Route): Promise<number> {
  let added = 0
  for (const gap of route.gaps ?? []) {
    const i = route.cumMiles.findIndex((c) => Math.abs(c - gap.atMile) < 0.011)
    if (i < 0 || i + 1 >= route.path.length) continue
    const [a, b] = [route.path[i], route.path[i + 1]]
    const d = await osrm(a, b)
    const r = d?.code === 'Ok' ? d.routes?.[0] : undefined
    if (!r) continue
    const via = r.geometry.coordinates.map((p) => [round(p[0], 5), round(p[1], 5)])
    const routed = r.distance / 1609.344
    if (routed > Math.max(3 * gap.miles, gap.miles + 2)) continue
    if (miles(via[0], a) > 0.1 || miles(via.at(-1)!, b) > 0.1) continue
    gap.via = [a, ...via, b]
    added++
  }
  return added
}

type Item = { on?: string; mile?: number; fromMile?: number; toMile?: number; mappedMiles?: number }
/** Repairs main and branch of a built strip in place and remaps every mile that refers to them. */
export async function repairStrip(
  data: {
    mode?: string
    main: Route
    branch?: (Route & { joinsAtMile?: number }) | null
    towns: Item[]
    moments: Item[]
    stretches: Item[]
  },
  { connectors = true } = {},
) {
  const report = { removed: 0, connectors: 0 }
  for (const on of ['main', 'branch'] as const) {
    const route = data[on]
    if (!route) continue
    const { route: fixed, remap, removed } = despike(route)
    report.removed += removed
    Object.assign(route, fixed)
    for (const item of [...data.towns, ...data.moments])
      if ((item.on ?? 'main') === on && item.mile !== undefined) item.mile = remap(item.mile)
    for (const s of data.stretches)
      if ((s.on ?? 'main') === on && s.fromMile !== undefined && s.toMile !== undefined) {
        const [from, to] = [remap(s.fromMile), remap(s.toMile)]
        if (s.mappedMiles !== undefined && s.toMile > s.fromMile)
          s.mappedMiles = round((s.mappedMiles * (to - from)) / (s.toMile - s.fromMile), 1)
        Object.assign(s, { fromMile: from, toMile: to })
      }
    if (on === 'main' && data.branch?.joinsAtMile !== undefined) data.branch.joinsAtMile = remap(data.branch.joinsAtMile)
    if (connectors && data.mode !== 'ferry') report.connectors += await addConnectors(route)
  }
  return report
}
