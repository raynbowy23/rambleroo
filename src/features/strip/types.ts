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
  minutes: number
  routedMiles: number
  scene: SceneFamily
  line: string
}
export interface StripData {
  bywayId: string
  title: string
  reviewed: boolean
  direction: string
  builtAt: string
  sources: { geometry: string; towns: string; driveTimes: string }
  main: StripPath
  branch?: StripPath & { joinsAtMile: number; name: string }
  towns: { name: string; source: string; on: 'main' | 'branch'; mile: number; offRouteMiles: number; at: Coordinate }[]
  moments: (StoryMoment & { on: 'main' | 'branch'; mile: number; offRouteMiles: number; at: Coordinate; photo?: Photo })[]
  stretches: Stretch[]
}
