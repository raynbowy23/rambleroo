import type { BywaySummary, Theme } from './types'
import { states } from './states'
export const themes: Theme[] = ['water', 'coast', 'mountain', 'forest', 'desert', 'historic', 'countryside']
export const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
export interface Filters {
  themes?: Theme[]
  state?: string
  q?: string
}
export function filterByways(byways: BywaySummary[], filters: Filters = {}) {
  const q = normalize(filters.q ?? '')
  const fields = (b: BywaySummary) => [b.name, ...b.states.flatMap((s) => [s, states[s] ?? s]), ...b.designations].map(normalize)
  return byways
    .filter(
      (b) =>
        (!filters.themes?.length || b.themes.some((t) => filters.themes!.includes(t))) &&
        (!filters.state || b.states.includes(filters.state.toUpperCase())) &&
        (!q || fields(b).some((s) => s.includes(q))),
    )
    .sort(
      (a, b) =>
        Number(fields(b).some((s) => s.startsWith(q))) - Number(fields(a).some((s) => s.startsWith(q))) || a.name.localeCompare(b.name),
    )
}
