import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import ExplorePage from './ExplorePage'
import { usePassport } from '../../lib/passport'
import type { BywaySummary } from '../../lib/types'
vi.mock('../map/AtlasMap', () => ({
  AtlasMap: ({ onFailure }: { onFailure: () => void }) => <button onClick={onFailure}>Simulate WebGL failure</button>,
}))
const roads: BywaySummary[] = [
  {
    id: 'river',
    name: 'River Road',
    states: ['WI'],
    themes: ['water'],
    sourceId: 1,
    designations: ['State Scenic Byway'],
    nationalScenicByway: false,
    allAmericanRoad: false,
    mappedMiles: 244,
    bbox: [-92, 42, -90, 44],
    center: [-91, 43],
    scene: 'river',
    status: 'listing',
    seed: 1,
    themeSource: 'inferred',
  },
  {
    id: 'forest',
    name: 'Forest Road',
    states: ['CA'],
    themes: ['forest'],
    sourceId: 2,
    designations: [],
    nationalScenicByway: false,
    allAmericanRoad: false,
    mappedMiles: 30,
    bbox: [-120, 36, -119, 38],
    center: [-120, 37],
    scene: 'forest',
    status: 'listing',
    seed: 2,
    themeSource: 'inferred',
  },
]
function Harness() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <button onClick={() => navigate(-1)}>Browser back</button>
      <output data-testid="url">{location.search}</output>
      <ExplorePage />
    </>
  )
}
beforeAll(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ byways: roads, meta: { bywayCount: 2, storyCount: 0 } }) }),
  )
})
beforeEach(() => {
  cleanup()
  usePassport.setState({ saved: {}, visits: [], lastStampId: null })
})
describe('explorer loop', () => {
  it('selects by keyboard-accessible result, saves, and closes with Escape restoring focus', async () => {
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    )
    const result = await screen.findByRole('button', { name: /River Road WI/ })
    result.focus()
    fireEvent.click(result)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByTestId('url').textContent).toContain('byway=river')
    await waitFor(() => expect(document.activeElement?.textContent).toBe('River Road'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(usePassport.getState().isSaved('river')).toBe(true)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(result)
  })
  it('restores URL selection on Back and keeps search shareable', async () => {
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    )
    fireEvent.click(await screen.findByRole('button', { name: /River Road WI/ }))
    fireEvent.click(screen.getByRole('button', { name: /Forest Road CA/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Browser back' }))
    expect(screen.getByTestId('url').textContent).toContain('byway=river')
    fireEvent.change(screen.getByLabelText('Search byway, state or designation'), { target: { value: 'Wisconsin' } })
    expect(screen.getByTestId('url').textContent).toContain('q=Wisconsin')
    expect(screen.queryByRole('button', { name: /Forest Road CA/ })).toBeNull()
  })
  it('falls back to a usable table when the map fails', async () => {
    render(
      <MemoryRouter initialEntries={['/?themes=water']}>
        <Harness />
      </MemoryRouter>,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Simulate WebGL failure' }))
    expect(screen.getByText("The map couldn't load here, so here's the list.")).toBeTruthy()
    expect(screen.getByRole('table')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'River Road' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
