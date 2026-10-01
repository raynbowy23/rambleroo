import type { BywaySummary } from '../../lib/types'
import type { TripEntry } from '../../lib/store'
import type { StripData } from '../strip/types'
export function tripTotals(roads: TripEntry[], catalog: Map<string, BywaySummary>, strips: Record<string, StripData[] | undefined>) {
  let miles = 0,
    minutes = 0,
    missingTimes = 0,
    timedRoads = 0
  for (const road of roads) {
    miles += catalog.get(road.bywayId)?.mappedMiles ?? 0
    const parts = strips[road.bywayId]
    const stretches = parts?.flatMap((p) => (p.mode === 'ferry' ? [] : p.stretches.filter((s) => s.on === 'main'))) ?? []
    const timed = stretches.filter((s) => s.minutes !== null)
    minutes += timed.reduce((sum, s) => sum + s.minutes!, 0)
    if (timed.length) timedRoads++
    if (!stretches.length || timed.length !== stretches.length) missingTimes++
  }
  return { miles, minutes, missingTimes, timedRoads }
}
