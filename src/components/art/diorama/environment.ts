import type { BywaySummary, BywayStory, Motif, PostcardLook } from '../../../lib/types'
import { lookInks, lookSky, mixInk, warmWinter } from '../looks'

export type Weather = 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog'
export type Season = PostcardLook['season']

export function environment(byway: BywaySummary, now: Date, hour?: number, season?: Season, weather: Weather = 'clear') {
  const local = new Date(now.getTime() + (byway.center[0] / 15) * 3_600_000)
  const h = (((hour ?? local.getUTCHours() + local.getUTCMinutes() / 60) % 24) + 24) % 24
  const month = (local.getUTCMonth() + (byway.center[1] < 0 ? 6 : 0)) % 12
  const resolvedSeason = season ?? (['winter', 'spring', 'summer', 'autumn'] as const)[Math.floor(((month + 1) % 12) / 3)]
  const time = h < 5 || h >= 21 ? 'night' : h < 8 ? 'dawn' : h < 17 ? 'day' : h < 19 ? 'golden' : 'dusk'
  const night = time === 'night' || time === 'dusk'
  const snow = weather === 'snow' || (resolvedSeason === 'winter' && !warmWinter(byway.region))
  const look: PostcardLook = { ...byway.look, time: time === 'night' ? ('dusk' as const) : time, season: resolvedSeason }
  const base = lookInks(byway.scene, look)
  const tint =
    resolvedSeason === 'spring' ? '#b48691' : resolvedSeason === 'autumn' ? '#c8742f' : resolvedSeason === 'winter' ? '#a9b8c4' : '#2f6b55'
  const inks = {
    ...base,
    mid: mixInk(base.mid, tint, 0.45),
    far: snow ? mixInk(base.far, base.paper, 0.75) : base.far,
    window: night ? '#f4cf78' : undefined,
  }
  if (night) {
    inks.mid = mixInk(inks.mid, '#394763', 0.45)
    inks.dark = mixInk(inks.dark, '#394763', 0.5)
    inks.far = mixInk(inks.far, '#6081a5', 0.35)
    inks.water = mixInk(inks.water, '#394763', 0.55)
    inks.paper = mixInk(base.paper, '#839eb9', 0.3)
  }
  return {
    hour: h,
    season: resolvedSeason,
    time,
    night,
    snow,
    inks,
    paper: base.paper,
    sky: time === 'night' ? '#394763' : lookSky(look, byway.region).top,
  }
}

const momentMotifs: Record<BywaySummary['scene'], Motif> = {
  river: 'lake-wide',
  coast: 'sea-rock',
  mountain: 'rolling-ridges',
  forest: 'aspens',
  desert: 'slickrock-ridge',
  town: 'steeple-town',
  prairie: 'orchard',
}

export function selectMotifs(story?: BywayStory): Motif[] {
  const explicit = [...(story?.motifs ?? []), ...(story?.moments.flatMap((moment) => moment.motifs ?? []) ?? [])]
  const inferred =
    story?.moments
      .filter((moment) => !moment.motifs?.length)
      .map((moment) => (moment.kind === 'town' ? ('steeple-town' as const) : momentMotifs[moment.scene])) ?? []
  return [...new Set([...explicit, ...inferred])].slice(0, 3)
}
