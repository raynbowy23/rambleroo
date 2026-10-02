import type { StripData } from './types'

/** Labels one printed panel can hold beside its ribbon before they crowd; denser stretches of road get shorter panels. */
export const MAX_LABELS = 10
const PANEL_MILES = 25
const MIN_PANEL_MILES = 2

export interface PrintEntry {
  mile: number
  label: string
  kind: 'town' | 'landmark' | 'moment' | 'gap'
}
export interface PrintPanel {
  on: 'main' | 'branch'
  route: NonNullable<StripData['main']>
  from: number
  to: number
  continuation: number
  entries: PrintEntry[]
  stretches: { title: string; from: number; to: number }[]
}

export function printPanels(data: StripData): PrintPanel[] {
  return (['main', 'branch'] as const).flatMap((on) => {
    const route = data[on]
    if (!route) return []
    const last = (to: number) => to >= route.miles
    const entriesIn = (from: number, to: number): PrintEntry[] => {
      const contains = (mile: number) => mile >= from && (mile < to || (last(to) && mile <= to))
      const off = (miles?: number) => (miles ? ` · ${miles} mi off route` : '')
      return [
        ...data.towns
          .filter((t) => t.on === on && contains(t.mile))
          .map((t) => ({
            mile: t.mile,
            label: `${t.name}${off(t.offRouteMiles)}`,
            kind: t.kind === 'landmark' ? ('landmark' as const) : ('town' as const),
          })),
        ...data.moments
          .filter((t) => t.on === on && contains(t.mile))
          .map((t) => ({ mile: t.mile, label: `${t.title} · ${t.kind}${off(t.offRouteMiles)}`, kind: 'moment' as const })),
        ...(route.gaps ?? [])
          .filter((g) => g.atMile < to && g.atMile + g.miles > from)
          .map((g) => ({
            mile: Math.max(from, g.atMile),
            label: `Unmapped gap · miles ${g.atMile.toFixed(1)}–${(g.atMile + g.miles).toFixed(1)}. Check your route.`,
            kind: 'gap' as const,
          })),
      ].sort((a, b) => a.mile - b.mile)
    }
    // Split a range in half until its labels fit beside the ribbon, so every label can sit next to its own mile.
    const split = (from: number, to: number): [number, number][] =>
      entriesIn(from, to).length > MAX_LABELS && to - from > MIN_PANEL_MILES * 2
        ? [...split(from, (from + to) / 2), ...split((from + to) / 2, to)]
        : [[from, to]]
    const count = Math.max(1, Math.ceil(route.miles / PANEL_MILES))
    const ranges = Array.from({ length: count }, (_, i) => split((i * route.miles) / count, ((i + 1) * route.miles) / count)).flat()
    return ranges.flatMap(([from, to]) => {
      const entries = entriesIn(from, to)
      const stretches = data.stretches
        .filter((t) => t.on === on && t.fromMile < to && t.toMile > from)
        .map((t) => ({ title: t.title, from: Math.max(from, t.fromMile), to: Math.min(to, t.toMile) }))
      // A town cluster too tight to split further (a few miles of main street) continues on another sheet rather than being clipped.
      return Array.from({ length: Math.max(1, Math.ceil(entries.length / MAX_LABELS)) }, (_, continuation) => ({
        on,
        route,
        from,
        to,
        continuation,
        entries: entries.slice(continuation * MAX_LABELS, (continuation + 1) * MAX_LABELS),
        stretches,
      }))
    })
  })
}

/**
 * Places labels as close as possible to their mile without overlapping: push each one down below the previous label, then
 * pull them back up from the bottom if the last ones ran off the panel. Returns the y of each label's centre.
 */
export function layoutLabels(targets: number[], height: number, gap: number): number[] {
  const ys: number[] = []
  for (const [i, y] of targets.entries()) ys.push(Math.max(y, i ? ys[i - 1] + gap : gap / 2))
  for (let i = ys.length - 1; i >= 0; i--) ys[i] = Math.min(ys[i], i === ys.length - 1 ? height - gap / 2 : ys[i + 1] - gap)
  return ys.map((y) => Math.max(gap / 2, y))
}
