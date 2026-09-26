import type { Position } from 'geojson'

const radians = Math.PI / 180
const mercatorY = (latitude: number) =>
  Math.log(Math.tan(Math.PI / 4 + (Math.max(-85.051129, Math.min(85.051129, latitude)) * radians) / 2))
const longitudeDelta = (a: number, b: number) => ((b - a + 540) % 360) - 180

export function bearing(a: Position, b: Position) {
  const delta = longitudeDelta(a[0], b[0]) * radians
  const lat1 = a[1] * radians
  const lat2 = b[1] * radians
  return (
    (Math.atan2(Math.sin(delta) * Math.cos(lat2), Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(delta)) /
      radians +
      360) %
    360
  )
}

export function measurePart(coordinates: Position[]) {
  const distances = [0]
  let groundLength = 0
  for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i - 1]
    const b = coordinates[i]
    const dx = longitudeDelta(a[0], b[0]) * radians
    const dy = mercatorY(b[1]) - mercatorY(a[1])
    distances.push(distances[i - 1] + Math.hypot(dx, dy))
    const h = Math.sin(((b[1] - a[1]) * radians) / 2) ** 2 + Math.cos(a[1] * radians) * Math.cos(b[1] * radians) * Math.sin(dx / 2) ** 2
    groundLength += 2 * Math.asin(Math.sqrt(Math.min(1, h)))
  }
  return { coordinates, distances, length: distances.at(-1) ?? 0, groundLength }
}

export type RoutePart = ReturnType<typeof measurePart>
export function longestPart(parts: Position[][]): RoutePart | undefined {
  return parts
    .filter((p) => p.length > 1)
    .map(measurePart)
    .filter((p) => p.length > 0)
    .sort((a, b) => b.groundLength - a.groundLength)[0]
}

export function journeyPoint(part: RoutePart, progress: number) {
  const target = Math.max(0, Math.min(1, progress)) * part.length
  let low = 1
  let high = part.distances.length - 1
  while (low < high) {
    const mid = (low + high) >> 1
    if (part.distances[mid] <= target) low = mid + 1
    else high = mid
  }
  // Ignore duplicate vertices, including duplicates at the parking position.
  let end = low
  while (end > 1 && part.distances[end] === part.distances[end - 1]) end--
  const a = part.coordinates[end - 1]
  const b = part.coordinates[end]
  const span = part.distances[end] - part.distances[end - 1]
  const t = span ? Math.max(0, Math.min(1, (target - part.distances[end - 1]) / span)) : 1
  // MapLibre's line-progress uses projected distance, not vertex count or geodesic distance.
  const y = mercatorY(a[1]) + (mercatorY(b[1]) - mercatorY(a[1])) * t
  const coordinates: [number, number] = [a[0] + longitudeDelta(a[0], b[0]) * t, (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / radians]
  return { coordinates, bearing: bearing(a, b) }
}
