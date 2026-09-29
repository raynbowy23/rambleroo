import type { Photo, SceneFamily, StoryMoment } from '../../lib/types'

export type Coordinate = [number, number]
export interface StripPath {
  path: Coordinate[]
  cumMiles: number[]
  miles: number
  gaps?: { atMile: number; miles: number }[]
}
export interface Stretch {
  id: string
  title: string
  from: string
  to: string
  on: 'main' | 'branch'
  fromMile: number
  toMile: number
  mappedMiles: number
  /** Routed drive time; null when no route could be verified to follow the byway (the UI then shows distance only). */
  minutes: number | null
  routedMiles: number | null
  scene: SceneFamily
  line: string
}
export interface StripData {
  /** 'ferry' for sea routes (Alaska's Marine Highway): drawn as water, no driving times or road directions. */
  mode?: 'drive' | 'ferry'
  /** Multi-part roads (Route 66): every part lists all parts; `part` names the one this file holds. */
  parts?: { key: string; label: string; miles: number; places: number }[]
  part?: { key: string; label: string }
  bywayId: string
  title: string
  reviewed: boolean
  direction: string
  builtAt: string
  sources: { geometry: string; towns: string; driveTimes: string }
  main: StripPath
  branch?: StripPath & {
    joinsAtMile: number
    name: string
    /** Human label for the side branch; Door County's tip uses the default wording. */ label?: string
  }
  towns: {
    photo?: Photo
    kind?: 'town' | 'landmark'
    name: string
    source: string
    on: 'main' | 'branch'
    mile: number
    offRouteMiles: number
    at: Coordinate
  }[]
  moments: (StoryMoment & { on: 'main' | 'branch'; mile: number; offRouteMiles: number; at: Coordinate; photo?: Photo })[]
  stretches: Stretch[]
}
