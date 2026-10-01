import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { RoadStats } from './RoadStats'
import type { BywaySummary } from '../../lib/types'
import type { StripData } from '../strip/types'

const byway = { mappedMiles: 20, states: ['WI'], designations: ['National Scenic Byway'] } as BywaySummary
const strip = {
  main: { miles: 20 },
  towns: [{ name: 'Lake Town', on: 'main' }],
  moments: [
    { title: 'Lake Town', on: 'main' },
    { title: 'Lighthouse', on: 'main' },
  ],
  stretches: [
    { on: 'main', fromMile: 0, toMile: 10, minutes: 20 },
    { on: 'main', fromMile: 10, toMile: 20, minutes: 25 },
    { on: 'branch', fromMile: 0, toMile: 5, minutes: 10 },
  ],
} as StripData

afterEach(cleanup)
it('counts distinct places and totals only the complete main drive', () => {
  render(<RoadStats byway={byway} strip={strip} season="Autumn" />)
  expect(screen.getByText('2 places')).toBeTruthy()
  expect(screen.getByText('About 45 min · without stops')).toBeTruthy()
  expect(screen.getByText('Autumn')).toBeTruthy()
})
it.each(['null', 'gap', 'overlap', 'ferry', 'partial'] as const)('omits a drive total for %s data', (condition) => {
  const data = structuredClone(strip)
  if (condition === 'null') data.stretches[0].minutes = null
  if (condition === 'gap') data.stretches[1].fromMile = 12
  if (condition === 'overlap') data.stretches[1].fromMile = 8
  if (condition === 'partial') data.stretches[1].toMile = 18
  if (condition === 'ferry') data.mode = 'ferry'
  render(<RoadStats byway={byway} strip={data} />)
  expect(screen.queryByText('Drive time')).toBeNull()
  expect(screen.queryByText(/min · without stops/)).toBeNull()
  expect(screen.getByText('Mapped distance')).toBeTruthy()
})
it('does not invent places or season when there is no strip or story', () => {
  render(<RoadStats byway={byway} />)
  expect(screen.queryByText('On the strip')).toBeNull()
  expect(screen.queryByText('Best season')).toBeNull()
  expect(screen.getByText('Wisconsin')).toBeTruthy()
})
