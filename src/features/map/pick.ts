// Which road a click on the map means. A click a little beside a line still counts as that road, so a near miss does not send the map
// back to the whole country. Within the margin the selected road wins (a click beside the road you are on keeps it), then the nearest.
export type Point = { x: number; y: number }
export type Candidate = { id: string; parts: Point[][] }

/** Click margin in screen pixels: a finger is less precise than a mouse. */
export const clickMargin = (coarse: boolean) => (coarse ? 24 : 16)

function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y
  const length = dx * dx + dy * dy
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Distance from `p` to a candidate's lines (or points, for single-vertex parts), in the same pixels. */
export function distanceTo(p: Point, candidate: Candidate) {
  let best = Infinity
  for (const part of candidate.parts) {
    if (part.length === 1) best = Math.min(best, Math.hypot(p.x - part[0].x, p.y - part[0].y))
    for (let i = 1; i < part.length; i++) best = Math.min(best, segmentDistance(p, part[i - 1], part[i]))
  }
  return best
}

export function pickRoad(candidates: Candidate[], p: Point, margin: number, selectedId?: string): string | null {
  let nearest: { id: string; distance: number } | null = null
  for (const candidate of candidates) {
    const distance = distanceTo(p, candidate)
    if (distance > margin) continue
    if (candidate.id === selectedId) return candidate.id
    if (!nearest || distance < nearest.distance) nearest = { id: candidate.id, distance }
  }
  return nearest?.id ?? null
}
