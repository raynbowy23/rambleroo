import { greatCircleMiles } from '../../lib/geo'
import type { BywaySummary } from '../../lib/types'
export type Location = [number, number]
/** Catalog bounds approximate the nearest point; they are not road geometry. */
export function distanceToByway(location: Location, byway: Pick<BywaySummary, 'bbox' | 'center'>) {
  const [west, south, east, north] = byway.bbox
  const nearest: Location =
    west <= east ? [Math.max(west, Math.min(east, location[0])), Math.max(south, Math.min(north, location[1]))] : byway.center
  return greatCircleMiles(location, nearest)
}
export function sortByDistance<T extends Pick<BywaySummary, 'bbox' | 'center'>>(roads: T[], location: Location) {
  return [...roads].sort((a, b) => distanceToByway(location, a) - distanceToByway(location, b))
}
export const distanceLabel = (location: Location, byway: Pick<BywaySummary, 'bbox' | 'center'>) =>
  `≈ ${Math.round(distanceToByway(location, byway))} mi away, straight line`
