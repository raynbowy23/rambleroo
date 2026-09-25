import type { BywaySummary } from './types'
import { states } from './states'
export const formatMiles = (miles: number) => `≈ ${Math.round(miles).toLocaleString('en-US')} mi mapped`
export function shortDesignation(b: BywaySummary) {
  if (b.allAmericanRoad) return 'All-American Road'
  if (b.nationalScenicByway) return 'National Scenic Byway'
  if (b.designations.some((d) => /National Forest/i.test(d))) return 'National Forest byway'
  if (b.designations.some((d) => /BLM/i.test(d))) return 'BLM Back Country byway'
  return b.designations.some((d) => /State|Heritage/i.test(d)) ? 'State byway' : 'Scenic byway'
}
export function listingDescription(b: BywaySummary) {
  const names = b.states.slice(0, 2).map((s) => states[s] ?? s)
  const place = b.states.length > 2 ? `${names.join(', ')} and ${b.states.length - 2} more states` : names.join(' and ')
  const character = b.themes
    .slice(0, 2)
    .map((t) => (t === 'historic' ? 'history' : t))
    .join(' and ')
  return `A ${character || 'scenic'} road${place ? ` through ${place}` : ''}.`
}
