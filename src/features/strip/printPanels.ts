import type { StripData } from './types'
export function printPanels(data: StripData) {
  return (['main', 'branch'] as const).flatMap((on) => {
    const route = data[on]
    if (!route) return []
    const count = Math.max(1, Math.ceil(route.miles / 25))
    return Array.from({ length: count }, (_, i) => {
      const from = (i * route.miles) / count,
        to = ((i + 1) * route.miles) / count
      const contains = (mile: number) => mile >= from && (mile < to || (i === count - 1 && mile <= to))
      const entries = [
        ...data.towns
          .filter((t) => t.on === on && contains(t.mile))
          .map((t) => ({ mile: t.mile, label: `${t.name}${t.offRouteMiles ? ` · ${t.offRouteMiles} mi off route` : ''}` })),
        ...data.moments
          .filter((t) => t.on === on && contains(t.mile))
          .map((t) => ({ mile: t.mile, label: `${t.title} · ${t.kind}${t.offRouteMiles ? ` · ${t.offRouteMiles} mi off route` : ''}` })),
        ...data.stretches
          .filter((t) => t.on === on && t.fromMile < to && t.toMile > from)
          .map((t) => ({ mile: Math.max(from, t.fromMile), label: `${t.title} · miles ${t.fromMile.toFixed(1)}–${t.toMile.toFixed(1)}` })),
        ...(route.gaps ?? [])
          .filter((g) => g.atMile < to && g.atMile + g.miles > from)
          .map((g) => ({
            mile: Math.max(from, g.atMile),
            label: `Unmapped gap · miles ${g.atMile.toFixed(1)}–${(g.atMile + g.miles).toFixed(1)}. Check your route.`,
          })),
      ].sort((a, b) => a.mile - b.mile)
      // Dense towns get continuation panels so no place or credit is clipped by the paper boundary.
      return Array.from({ length: Math.max(1, Math.ceil(entries.length / 8)) }, (_, continuation) => ({
        on,
        route,
        from,
        to,
        continuation,
        entries: entries.slice(continuation * 8, (continuation + 1) * 8),
      }))
    }).flat()
  })
}
