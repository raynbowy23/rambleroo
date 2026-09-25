// Assigns every byway a postcard look so that no two postcards share the same art direction.
// Two guarantees, checked by content.test.ts:
//  1. the full look tuple is unique across the catalog;
//  2. within a region and scene family, the most visible dimensions (layout, palette, time, season) are unique while combinations remain, so similar roads side by side still differ at a glance.
import type { PostcardLook, Region, SceneFamily } from '../../src/lib/types.ts'

export const PALETTES = 4
export const LAYOUTS = 3
const SEASONS: PostcardLook['season'][] = ['spring', 'summer', 'autumn', 'winter']
const TIMES: PostcardLook['time'][] = ['dawn', 'day', 'golden', 'dusk']
const LETTERING: PostcardLook['lettering'][] = ['greetings', 'ribbon', 'block', 'script', 'banner']
const BORDERS: PostcardLook['border'][] = ['white', 'deckle', 'linen', 'scallop']

/** Total number of distinct looks; each index maps to exactly one tuple. */
export const LOOK_SPACE = PALETTES * LAYOUTS * SEASONS.length * TIMES.length * LETTERING.length * BORDERS.length * 2

export function lookFromIndex(i: number): PostcardLook {
  const take = (n: number) => {
    const v = i % n
    i = Math.floor(i / n)
    return v
  }
  // Most visible dimensions vary fastest, so probing to the next index changes something you can see.
  const layout = take(LAYOUTS)
  const time = TIMES[take(TIMES.length)]
  const palette = take(PALETTES)
  const season = SEASONS[take(SEASONS.length)]
  const lettering = LETTERING[take(LETTERING.length)]
  const border = BORDERS[take(BORDERS.length)]
  const mirror = take(2) === 1
  return { palette, layout, season, time, lettering, border, mirror }
}

export const lookKey = (l: PostcardLook) => `${l.palette}|${l.layout}|${l.season}|${l.time}|${l.lettering}|${l.border}|${l.mirror}`
export const visibleKey = (l: PostcardLook) => `${l.layout}|${l.palette}|${l.time}|${l.season}`

interface LookInput {
  id: string
  seed: number
  region: Region
  scene: SceneFamily
}

export function assignLooks(byways: LookInput[]): Map<string, PostcardLook> {
  const used = new Set<string>()
  const visibleUsed = new Map<string, Set<string>>()
  const out = new Map<string, PostcardLook>()
  // Stable order so rebuilding the same snapshot gives the same looks.
  for (const b of [...byways].sort((a, z) => a.id.localeCompare(z.id))) {
    const group = `${b.region}|${b.scene}`
    const seen = visibleUsed.get(group) ?? new Set<string>()
    visibleUsed.set(group, seen)
    const start = b.seed % LOOK_SPACE
    let chosen: PostcardLook | undefined
    let fallback: PostcardLook | undefined
    for (let step = 0; step < LOOK_SPACE; step++) {
      const look = lookFromIndex((start + step * 7919) % LOOK_SPACE)
      if (used.has(lookKey(look))) continue
      fallback ??= look
      if (!seen.has(visibleKey(look))) {
        chosen = look
        break
      }
    }
    const look = chosen ?? fallback
    if (!look) throw new Error('look space exhausted')
    used.add(lookKey(look))
    seen.add(visibleKey(look))
    out.set(b.id, look)
  }
  return out
}
