import { readFileSync } from 'node:fs'

export interface StateSource {
  state: string
  agency: string
  layer: string
  nameField: string
  comment?: string
  /** `match`: the value in nameField when the agency abbreviates names (FDOT: 'JC PENNEY MEM HWY'); `name` is what Rambleroo shows. */
  byways: { name: string; match?: string; id: number; designation: string; nsb: boolean }[]
}
export const stateSources: StateSource[] = JSON.parse(readFileSync(new URL('../../content/state-sources.json', import.meta.url), 'utf8'))
export const supplementFile = (state: string) => `supplement-${state === 'WI' ? 'wisdot' : state.toLowerCase()}.geojson`
export const supplementFiles = [...stateSources.map((source) => supplementFile(source.state)), 'supplement-classics.geojson']
