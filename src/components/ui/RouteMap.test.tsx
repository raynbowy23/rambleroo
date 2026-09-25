import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { BywaySummary } from '../../lib/types'
import { RouteMap } from './RouteMapCanvas'

const mocks = vi.hoisted(() => ({
  fitBounds: vi.fn(),
  resize: vi.fn(),
  load: undefined as (() => void) | undefined,
  observeResize: undefined as (() => void) | undefined,
}))
vi.mock('../../features/map/maplibre', () => ({
  default: {
    Map: class {
      fitBounds = mocks.fitBounds
      resize = mocks.resize
      addControl = vi.fn()
      setPaintProperty = vi.fn()
      setLayoutProperty = vi.fn()
      getSource = () => ({ setData: vi.fn() })
      remove = vi.fn()
      on(event: string, callback: () => void) {
        if (event === 'load') mocks.load = callback
      }
    },
    AttributionControl: class {},
    Marker: class {
      setLngLat() {
        return this
      }
      addTo() {
        return this
      }
    },
  },
}))
vi.mock('../../features/map/style', () => ({ createAtlasStyle: () => ({}), palette: () => () => '#214a3b' }))
vi.mock('../../lib/motion', () => ({ useMotionEnabled: () => false }))
vi.mock('../../features/map/layers', () => ({
  addBywayLayers: vi.fn(),
  loadBywayGeometry: async () => ({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { id: 'river' },
        geometry: {
          type: 'MultiLineString',
          coordinates: [
            [
              [-91.2, 43],
              [-91, 44],
              [-90, 30],
            ],
          ],
        },
      },
    ],
  }),
}))
const road = { id: 'river', bbox: [-94, 29, -89, 48] } as BywaySummary
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        mocks.observeResize = callback
      }
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('positions the chapter before load and refits it after a container resize', async () => {
  const bbox: [number, number, number, number] = [-92.95, 42.45, -86.75, 47.1]
  render(<RouteMap byways={[road]} bbox={bbox} />)
  expect(mocks.fitBounds).toHaveBeenLastCalledWith(bbox, expect.anything())
  await act(async () => {
    mocks.load?.()
  })
  act(() => {
    mocks.observeResize?.()
  })
  expect(mocks.resize).toHaveBeenCalled()
  expect(mocks.fitBounds).toHaveBeenLastCalledWith(bbox, expect.anything())
})

it('frames story stops and nearby route geometry, preserving Whole route through resize', async () => {
  render(
    <RouteMap
      byways={[road]}
      moments={[
        { title: 'South', kind: 'roadside', text: '', scene: 'river', at: [-91.1, 43] },
        { title: 'North', kind: 'roadside', text: '', scene: 'river', at: [-91, 44] },
      ]}
    />,
  )
  await act(async () => {
    mocks.load?.()
  })
  const localBounds = mocks.fitBounds.mock.lastCall?.[0]
  expect(localBounds[0]).toBeCloseTo(-91.28)
  expect(localBounds[1]).toBeCloseTo(42.92)
  expect(localBounds[3]).toBeCloseTo(44.08)
  fireEvent.click(screen.getByRole('button', { name: 'Whole route' }))
  expect(mocks.fitBounds).toHaveBeenLastCalledWith(road.bbox, expect.anything())
  act(() => {
    mocks.observeResize?.()
  })
  expect(mocks.fitBounds).toHaveBeenLastCalledWith(road.bbox, expect.anything())
  fireEvent.click(screen.getByRole('button', { name: 'Story stops' }))
  expect(mocks.fitBounds).toHaveBeenLastCalledWith(localBounds, expect.anything())
})
