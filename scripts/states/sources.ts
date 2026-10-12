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
   * `layer`: this road's own layer, when the agency publishes one layer per road.
   * `where`: a full SQL condition selecting the road, for layers with no usable name field (it replaces the name match).
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
    layer?: string
    where?: string
    osm?: { ways: number[] }
    clip?: { center: [number, number]; miles: number }
  }[]
  /** National parts to leave out: every part of `bywayId` lying wholly south of `southOf` (latitude), for a national line that runs on past where the road ends. */
  drop?: { bywayId: number; southOf: number; reason: string }[]
}
export const stateSources: StateSource[] = JSON.parse(readFileSync(new URL('../../content/state-sources.json', import.meta.url), 'utf8'))
export const supplementFile = (state: string) => `supplement-${state === 'WI' ? 'wisdot' : state.toLowerCase()}.geojson`
export const supplementFiles = [...stateSources.map((source) => supplementFile(source.state)), 'supplement-classics.geojson']

/** Drops national parts whose BYWAY_ID an agency line replaces (supplement features marked REPLACES 'T'), and the parts a source's `drop` lists. */
export function applyReplacements<
  F extends { properties: { BYWAY_ID: number; REPLACES?: string }; geometry: { type: string; coordinates: unknown } },
>(features: F[]): F[] {
  const replaced = new Set(features.filter((f) => f.properties.REPLACES === 'T').map((f) => f.properties.BYWAY_ID))
  const drops = stateSources.flatMap((source) => source.drop ?? [])
  const points = (f: F) =>
    (f.geometry.type === 'LineString' ? f.geometry.coordinates : (f.geometry.coordinates as number[][][]).flat(1)) as number[][]
  const dropped = (f: F) =>
    f.properties.REPLACES !== 'T' && drops.some((d) => d.bywayId === f.properties.BYWAY_ID && points(f).every((p) => p[1] <= d.southOf))
  return features.filter((f) => (!replaced.has(f.properties.BYWAY_ID) || f.properties.REPLACES === 'T') && !dropped(f))
}
