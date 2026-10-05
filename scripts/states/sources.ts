import { readFileSync } from 'node:fs'

export interface StateSource {
  state: string
  agency: string
  layer: string
  nameField: string
  /** Extra SQL condition ANDed onto every query, e.g. to keep one direction where a layer draws both carriageways. */
  where?: string
  comment?: string
  /** `match`: the value in nameField when the agency abbreviates names (FDOT: 'JC PENNEY MEM HWY'); `name` is what Rambleroo shows. */
  /**
   * `replaces`: the USDOT BYWAY_ID whose line the agency's line replaces (the national one is drawn in the wrong place); the
   * road keeps that ID and `name` must equal its national name, so its slug, strip and photos survive.
   * `osm`: draw the road from these OpenStreetMap way IDs when the agency publishes no line.
   * `clip`: keep only `miles` either side of the point on the line nearest `center` ([lon, lat]), for designations that
   * cover a short stretch of a longer agency route.
   */
  byways: {
    name: string
    match?: string
    id: number
    designation: string
    nsb: boolean
    replaces?: number
    osm?: { ways: number[] }
    clip?: { center: [number, number]; miles: number }
  }[]
}
export const stateSources: StateSource[] = JSON.parse(readFileSync(new URL('../../content/state-sources.json', import.meta.url), 'utf8'))
export const supplementFile = (state: string) => `supplement-${state === 'WI' ? 'wisdot' : state.toLowerCase()}.geojson`
export const supplementFiles = [...stateSources.map((source) => supplementFile(source.state)), 'supplement-classics.geojson']

/** Drops national parts whose BYWAY_ID an agency line replaces (supplement features marked REPLACES 'T'). */
export function applyReplacements<F extends { properties: { BYWAY_ID: number; REPLACES?: string } }>(features: F[]): F[] {
  const replaced = new Set(features.filter((f) => f.properties.REPLACES === 'T').map((f) => f.properties.BYWAY_ID))
  return features.filter((f) => !replaced.has(f.properties.BYWAY_ID) || f.properties.REPLACES === 'T')
}
