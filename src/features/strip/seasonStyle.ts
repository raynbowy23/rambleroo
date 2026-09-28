import { mixInk, warmWinter } from '../../components/art/looks'
import type { BywaySummary, PostcardLook, Region } from '../../lib/types'
import type { ExpressionSpecification, Map } from '../map/maplibre'
import { palette } from '../map/style'
import { terrainSource } from '../map/terrain'

export type Season = PostcardLook['season']
export type Climate = 'snowy' | 'mild' | 'tropical'
export const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter']
type Place = Pick<BywaySummary, 'region' | 'center' | 'scene'>

export function climateFor({ region, center: [longitude, latitude], scene }: Place, elevation?: number): Climate {
  if (region === 'florida' || region === 'hawaii') return 'tropical'
  // Until DEM tiles arrive, a mountain illustration is our only elevation hint.
  const height = elevation ?? (scene === 'mountain' ? 1800 : 0)
  if (region === 'southwest') return height >= 1800 ? 'snowy' : 'mild'
  if (warmWinter(region) || region === 'ozarks') return 'mild'
  if (region === 'california') return height >= 1500 ? 'snowy' : 'mild'
  if (region === 'pacific-northwest') return height >= 900 || longitude > -121 ? 'snowy' : 'mild'
  if (region === 'appalachia') return height >= 900 || latitude >= 40 ? 'snowy' : 'mild'
  if (region === 'great-plains') return latitude >= 40 || height >= 1500 ? 'snowy' : 'mild'
  return 'snowy'
}

const inks = {
  spring: ['#c2dba3', '#adc593', '#abd7e3', '#66aabd', '#e4f3f5', '#fff3d9', '#648b83'],
  summer: ['#739965', '#648b5c', '#64b8ca', '#258d9e', '#a5d9eb', '#fff0c4', '#365c65'],
  autumn: ['#d6ad69', '#bd895d', '#a5c6cf', '#759cae', '#e9d9bd', '#ffe5a2', '#86654f'],
  winter: ['#f0f4f5', '#e2e9ee', '#c5e3ed', '#92b5cb', '#e5edf2', '#ffffff', '#718ca7'],
  mild: ['#b9ba94', '#aaa88a', '#afd0dd', '#749eaf', '#c4deed', '#eee8cd', '#778487'],
  tropical: ['#80b76c', '#69a564', '#6ad8d2', '#28aaa9', '#8ed7ef', '#fff0bd', '#397c79'],
} satisfies Record<string, string[]>

export function seasonProfile(season: Season, place: Place, elevation?: number) {
  const climate = climateFor(place, elevation)
  const snowy = season === 'winter' && climate === 'snowy'
  const colors = inks[climate === 'tropical' ? 'tropical' : season === 'winter' && climate === 'mild' ? 'mild' : season]
  let [land, otherLand, water, river, sky, highlight, shadow] = colors
  if (climate === 'tropical') {
    const amount = { spring: 0.08, summer: 0.24, autumn: 0.12, winter: 0 }[season]
    land = mixInk(land, '#267b42', amount)
    otherLand = mixInk(otherLand, '#267b42', amount)
    sky = season === 'winter' ? '#79c9ed' : sky
  }
  const mountain = place.scene === 'mountain' || ['rockies', 'alaska'].includes(place.region) || (elevation ?? 0) >= 1500
  const snowline = snowy ? 0 : climate !== 'tropical' && mountain && (season === 'spring' || season === 'autumn') ? 3000 : null
  return {
    season,
    climate,
    snowy,
    land,
    otherLand,
    water,
    river,
    sky,
    highlight,
    shadow,
    accent: snowy ? '#a1b6cb' : otherLand,
    intensity: snowy ? 0.38 : 0.25,
    horizon: snowy ? '#f5f7f8' : highlight,
    fog: snowy ? 0.42 : season === 'autumn' || (climate === 'tropical' && season === 'summer') ? 0.3 : 0.12,
    road: snowy ? '#455566' : season === 'autumn' ? '#793e2e' : '#395440',
    edge: snowy ? '#ffffff' : '#faf1d9',
    width: snowy ? 5 : 4,
    snowline,
    weather: climate === 'tropical' ? null : snowy ? 'snow' : season === 'spring' ? 'petals' : season === 'autumn' ? 'leaves' : null,
  }
}
export type SeasonProfile = ReturnType<typeof seasonProfile>
export const seasonalTerrain = 'strip-season-terrain'

export function snowTint(profile: SeasonProfile): ExpressionSpecification {
  const line = profile.snowline ?? 3000
  return ['interpolate', ['linear'], ['elevation'], line, 'rgba(255,255,255,0)', line + (profile.snowy ? 800 : 200), '#f7faff']
}

export function applySeasonStyle(map: Map, profile: SeasonProfile, relief: boolean) {
  const c = palette()
  const tint = (base: string, color: string) => (relief ? color : mixInk(c(base), color, 0.4))
  map.setPaintProperty('land', 'fill-color', [
    'case',
    ['==', ['get', 'us'], true],
    tint('land-us', profile.land),
    tint('land', profile.otherLand),
  ])
  map.setPaintProperty('sea', 'background-color', tint('water-light', profile.water))
  map.setPaintProperty('lakes', 'fill-color', tint('water-light', profile.water))
  map.setPaintProperty('lakes', 'fill-outline-color', tint('water', profile.river))
  for (const id of [
    'rivers',
    'coast',
    'coast-wash',
    ...['land', 'lakes'].flatMap((source) => [0, 1, 2, 3].map((i) => `${source}-waterline-${i}`)),
  ])
    map.setPaintProperty(id, 'line-color', tint('water-deep', profile.river))
  map.setPaintProperty('road', 'line-color', profile.road)
  map.setPaintProperty('road', 'line-width', relief ? profile.width : 2)
  map.setPaintProperty('road-edge', 'line-color', profile.edge)
  map.setPaintProperty('road-edge', 'line-width', relief ? profile.width + 3 : 4)
  if (!relief) return
  if (!map.getLayer(seasonalTerrain))
    map.addLayer({ id: seasonalTerrain, type: 'color-relief', source: terrainSource, paint: { 'color-relief-opacity': 0 } }, 'coast-wash')
  map.setPaintProperty(seasonalTerrain, 'color-relief-color', snowTint(profile))
  map.setPaintProperty(seasonalTerrain, 'color-relief-opacity', profile.snowline === null ? 0 : 0.85)
  map.setPaintProperty('relief-shade', 'hillshade-highlight-color', profile.highlight)
  map.setPaintProperty('relief-shade', 'hillshade-shadow-color', profile.shadow)
  map.setPaintProperty('relief-shade', 'hillshade-accent-color', profile.accent)
  map.setPaintProperty('relief-shade', 'hillshade-exaggeration', profile.intensity)
  map.setSky({
    'sky-color': profile.sky,
    'horizon-color': profile.horizon,
    'fog-color': profile.horizon,
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.5,
    'fog-ground-blend': profile.fog,
  })
}

export function seasonLabel(profile: SeasonProfile, region: Region) {
  const detail =
    profile.climate === 'tropical'
      ? `${region === 'florida' ? 'Florida' : 'Hawaii'} stays warm`
      : profile.season === 'winter'
        ? profile.climate
        : 'seasonal light'
  return `${profile.season[0].toUpperCase()}${profile.season.slice(1)} · ${detail}`
}
