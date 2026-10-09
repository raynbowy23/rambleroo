import * as T from 'three'
import type { DioramaSpec } from './spec'

/** One full turn about every 40 seconds. */
export const SPIN_PER_SECOND = (2 * Math.PI) / 40
/** Radians turned per pixel dragged. */
export const DRAG_RADIANS_PER_PX = Math.PI / 300
export function makeRoute(spec: DioramaSpec) {
  const coords = spec.road.coordinates
  const cos = Math.cos((coords[0][1] * Math.PI) / 180)
  const xs = coords.map((p) => p[0] * cos),
    zs = coords.map((p) => -p[1])
  const midX = (Math.max(...xs) + Math.min(...xs)) / 2,
    midZ = (Math.max(...zs) + Math.min(...zs)) / 2
  const scale = 7 / Math.max(0.000001, Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs))
  const bends = coords.map((_, i) => new T.Vector3((xs[i] - midX) * scale, 0, (zs[i] - midZ) * scale))
  const length = bends.slice(1).reduce((sum, p, i) => sum + p.distanceTo(bends[i]), 0)
  const flat = [bends[0]]
  for (let i = 1; i < bends.length; i++) {
    const steps = Math.max(1, Math.ceil(bends[i].distanceTo(bends[i - 1]) / Math.max(0.18, length / 90)))
    for (let j = 1; j <= steps; j++) flat.push(bends[i - 1].clone().lerp(bends[i], j / steps))
  }
  const distances = [0]
  for (let i = 1; i < flat.length; i++) distances.push(distances[i - 1] + flat[i].distanceTo(flat[i - 1]))
  const total = distances.at(-1)!
  const elevation = (t: number) => {
    const knots = spec.road.elevation
    const i = Math.max(
      1,
      knots.findIndex((p) => p[0] >= t),
    )
    const a = knots[i - 1],
      b = knots[i]
    return T.MathUtils.lerp(a[1], b[1], T.MathUtils.smoothstep(t, a[0], b[0]))
  }
  const points = flat.map((p, i) => p.clone().setY(elevation(distances[i] / total)))
  function sample(t: number) {
    const d = T.MathUtils.clamp(t, 0, 1) * total
    let i = 1
    while (i < distances.length - 1 && distances[i] < d) i++
    return points[i - 1].clone().lerp(points[i], (d - distances[i - 1]) / (distances[i] - distances[i - 1] || 1))
  }
  function nearest(x: number, z: number) {
    let best = Infinity,
      y = 0,
      side = 0,
      at = 0
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i],
        dx = b.x - a.x,
        dz = b.z - a.z
      const t = T.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1)
      const d = Math.hypot(x - a.x - t * dx, z - a.z - t * dz)
      if (d < best) {
        best = d
        y = T.MathUtils.lerp(a.y, b.y, t)
        side = Math.sign(dx * (z - a.z) - dz * (x - a.x))
        at = T.MathUtils.lerp(distances[i - 1], distances[i], t) / total
      }
    }
    return { distance: best, y, side, at }
  }
  const height = (x: number, z: number) => {
    const n = nearest(x, z)
    if (spec.ground === 'coastal-cliff') {
      const bridge = spec.landmarks.find((l) => l.model === 'open-spandrel-arch-bridge' && l.offset === 'on-road')
      const canyon = bridge ? Math.exp(-Math.pow((n.at - bridge.at) / 0.065, 2)) * 1.7 : 0
      return Math.max(0.08, n.y + (n.side > 0 ? -Math.max(0, n.distance - 0.19) * 2.8 : n.distance * 0.48) - canyon)
    }
    if (spec.ground === 'low-shore') return Math.max(0.08, n.y - (n.side > 0 ? n.distance * 0.25 : 0))
    if (spec.ground === 'main-street' || spec.ground === 'prairie-grid') return n.y
    if (spec.ground === 'desert-mesas') return n.y + Math.min(0.7, Math.max(0, n.distance - 0.5)) * 0.7
    const ridge = spec.ground === 'forested-ridges' ? 0.7 : 0.38
    return Math.max(0.1, n.y + Math.min(n.distance, 2) * ridge + Math.sin(x * 2 + z) * Math.min(n.distance, 0.2))
  }
  const frame = (t: number, distance = 0) => {
    const p = sample(t),
      tangent = sample(Math.min(1, t + 0.002))
        .sub(sample(Math.max(0, t - 0.002)))
        .normalize()
    p.add(new T.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(distance))
    return { point: p, tangent, angle: Math.atan2(tangent.x, tangent.z) }
  }
  return { points, sample, frame, height, nearest }
}
export type Route = ReturnType<typeof makeRoute>
