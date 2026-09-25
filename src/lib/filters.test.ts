import { describe, expect, it } from 'vitest'
import { filterByways } from './filters'
import type { BywaySummary } from './types'
const road = (name: string, states: string[], themes: BywaySummary['themes']): BywaySummary => ({
  id: name,
  name,
  states,
  themes,
  sourceId: 1,
  designations: ['National Scenic Byway'],
  nationalScenicByway: true,
  allAmericanRoad: false,
  mappedMiles: 12,
  bbox: [0, 0, 1, 1],
  center: [0, 0],
  scene: 'river',
  region: 'upper-midwest',
  status: 'listing',
  seed: 1,
  themeSource: 'inferred',
  look: { palette: 0, layout: 0, season: 'summer', time: 'day', lettering: 'greetings', border: 'white', mirror: false },
})
const roads = [
  road('Old River Road', ['WI'], ['water']),
  road('River Côte', ['IA', 'WI'], ['historic']),
  road('Forest Drive', ['CA'], ['forest']),
]
describe('catalog filtering', () => {
  it('combines any-of themes with state', () => expect(filterByways(roads, { themes: ['water', 'historic'], state: 'wi' })).toHaveLength(2))
  it('matches full state names and designations', () => {
    expect(filterByways(roads, { q: 'wisconsin' })).toHaveLength(2)
    expect(filterByways(roads, { q: 'National Scenic' })).toHaveLength(3)
  })
  it('normalizes diacritics, case and whitespace', () => expect(filterByways(roads, { q: ' COTE ' })).toEqual([roads[1]]))
  it('ranks prefixes ahead of interior matches', () =>
    expect(filterByways(roads, { q: 'river' }).map((b) => b.name)).toEqual(['River Côte', 'Old River Road']))
  it('leaves input untouched and handles no results', () => {
    expect(filterByways(roads, { q: 'missing' })).toEqual([])
    filterByways(roads)
    expect(roads[0].name).toBe('Old River Road')
  })
})
