import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import PassportPage from './PassportPage'
import { usePassport } from '../../lib/passport'
import type { BywaySummary } from '../../lib/types'
const { roads } = vi.hoisted(() => ({
  roads: [
    {
      id: 'river',
      name: 'River Road',
      states: ['WI'],
      themes: ['water'],
      sourceId: 1,
      designations: [],
      nationalScenicByway: false,
      allAmericanRoad: false,
      mappedMiles: 244,
      bbox: [-92, 42, -90, 44],
      center: [-91, 43],
      scene: 'river',
      region: 'upper-midwest',
      status: 'listing',
      seed: 1,
      themeSource: 'inferred',
      look: { palette: 0, layout: 0, season: 'summer', time: 'day', lettering: 'greetings', border: 'white', mirror: false },
    },
  ] as BywaySummary[],
}))
vi.mock('../../lib/data', () => ({
  useCatalog: () => ({ byways: roads, byId: new Map(roads.map((b) => [b.id, b])), status: 'ready' }),
  useStory: () => ({ story: undefined }),
}))
vi.mock('../../components/ui/RouteMap', () => ({ RouteMap: () => null }))
beforeAll(() => vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
beforeEach(() => usePassport.setState({ saved: {}, visits: [], lastStampId: null }))
afterEach(cleanup)
it('separates distinct roads from repeated visits and confirms journal deletion inline', () => {
  const store = usePassport.getState()
  store.addVisit({ bywayId: 'river', date: '2025-01-01', scope: 'part', note: 'First stretch' })
  store.addVisit({ bywayId: 'river', date: '2025-02-01', scope: 'whole', note: 'Returned' })
  render(
    <MemoryRouter>
      <PassportPage />
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { name: '1 byway visited' })).toBeTruthy()
  expect(screen.getByText('2 visits recorded')).toBeTruthy()
  expect(screen.getAllByRole('img', { name: /River Road.*Visited/ })).toHaveLength(1)
  expect(screen.getByRole('progressbar').getAttribute('value')).toBe('1')
  fireEvent.click(screen.getAllByRole('button', { name: 'Delete visit' })[0])
  expect(usePassport.getState().visits).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(usePassport.getState().visits).toHaveLength(2)
  fireEvent.click(screen.getAllByRole('button', { name: 'Delete visit' })[0])
  fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
  expect(screen.getByText('1 visit recorded')).toBeTruthy()
  expect(screen.getByRole('heading', { name: '1 byway visited' })).toBeTruthy()
  expect(usePassport.getState().visits[0].note).toBe('First stretch')
})
it('shows an honest empty passport', () => {
  render(
    <MemoryRouter>
      <PassportPage />
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { name: '0 byways visited' })).toBeTruthy()
  expect(screen.getByText('0 visits recorded')).toBeTruthy()
  expect(screen.getByText('Saved in this browser. Accounts and sync come later.')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'More roads ahead' })).toBeTruthy()
})

it('counts only documented multi-state segments and sorts states by visits then name', () => {
  const original = [...roads]
  try {
    roads.push(
      { ...roads[0], id: 'multi', states: ['WI', 'IA', 'MN'], stateMiles: { WI: 50, IA: 20 } },
      { ...roads[0], id: 'illinois', states: ['IL'] },
    )
    for (const bywayId of ['river', 'multi', 'illinois']) {
      usePassport.getState().addVisit({ bywayId, date: '2025-01-01', scope: 'part', note: '' })
    }
    render(
      <MemoryRouter>
        <PassportPage />
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('progressbar').map((bar) => bar.getAttribute('aria-label'))).toEqual([
      'Wisconsin: 2 of 2 catalog roads visited',
      'Illinois: 1 of 1 catalog roads visited',
      'Iowa: 1 of 1 catalog roads visited',
    ])
  } finally {
    roads.splice(0, roads.length, ...original)
  }
})
