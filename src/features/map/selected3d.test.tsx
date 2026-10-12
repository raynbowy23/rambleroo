import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Map } from './maplibre'
import { ReliefControls } from './ReliefControls'

const state = vi.hoisted(() => ({
  garage: {},
  motion: false,
  update: vi.fn(),
  car: vi.fn(),
  road: vi.fn(),
  options: {} as { onReady?: () => void; onFailure?: () => void },
}))
vi.mock('../../lib/motion', () => ({ useMotionEnabled: () => state.motion }))
vi.mock('../../lib/garage', () => ({ useGarage: () => state.garage }))
vi.mock('../../components/ui/Toast', () => ({ toast: vi.fn() }))
vi.mock('./terrain', () => ({ setRelief: vi.fn(), isTerrainError: () => false }))
vi.mock('./layers', () => {
  const all = {
    features: [
      {
        properties: { id: 'road', name: 'Mountain road' },
        geometry: {
          coordinates: [
            [
              [0, 0],
              [1, 1],
            ],
            [
              [2, 2],
              [3, 3],
            ],
          ],
        },
      },
      {
        properties: { id: 'ship', name: "Alaska's Marine Highway" },
        geometry: {
          coordinates: [
            [
              [0, 0],
              [1, 1],
            ],
          ],
        },
      },
    ],
  }
  return {
    loadBywayGeometry: async () => all,
    loadRoadGeometry: async (id: string) => ({ ...all, features: all.features.filter((f) => f.properties.id === id) }),
  }
})
vi.mock('./car3d', () => ({
  carLayerId: 'garage-car-3d',
  createCarLayer: (...args: unknown[]) => {
    state.car(...args)
    state.options = args[4] as typeof state.options
    return { layer: { id: 'garage-car-3d' }, update: state.update }
  },
}))
vi.mock('./road3d', () => ({
  roadLayerId: 'selected-road-3d',
  createRoadLayer: (...args: unknown[]) => {
    state.road(...args)
    return { id: 'selected-road-3d' }
  },
}))
function mockMap() {
  const layers = new Set(['route-car', 'route-flags', 'selected-glow', 'selected-halo', 'selected-art', 'selected-line'])
  const listeners = new globalThis.Map<string, Set<(event: unknown) => void>>()
  return {
    listeners,
    getPitch: vi.fn(() => 45),
    getLayer: (id: string) => layers.has(id),
    addLayer: vi.fn((layer: { id: string }) => layers.add(layer.id)),
    removeLayer: vi.fn((id: string) => layers.delete(id)),
    getPaintProperty: () => 1,
    setPaintProperty: vi.fn(),
    setLayoutProperty: vi.fn(),
    getSource: () => ({
      serialize: () => ({ data: { type: 'Feature', geometry: { coordinates: [0.4, 0.4] }, properties: { bearing: 45 } } }),
    }),
    on: (type: string, fn: (event: unknown) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(fn)
    },
    off: (type: string, fn: (event: unknown) => void) => listeners.get(type)?.delete(fn),
    isMoving: () => false,
    jumpTo: vi.fn(),
    easeTo: vi.fn(),
  }
}
beforeEach(() => {
  state.motion = false
  localStorage.clear()
  vi.clearAllMocks()
})
afterEach(cleanup)
it('installs the car on a flat map, follows drive data, and preserves the mesh across terrain toggles', async () => {
  const map = mockMap()
  const view = render(<ReliefControls map={map as unknown as Map} roadId="road" />)
  await waitFor(() => expect(state.car).toHaveBeenCalledTimes(1))
  expect(state.update).toHaveBeenCalledWith([0.4, 0.4], 45)
  expect(map.jumpTo).toHaveBeenLastCalledWith(expect.objectContaining({ pitch: 45, bearing: expect.any(Number) }))
  expect(map.setLayoutProperty).not.toHaveBeenCalledWith('route-car', 'visibility', 'none')
  act(() => state.options.onReady?.())
  expect(map.setLayoutProperty).toHaveBeenLastCalledWith('route-car', 'visibility', 'none')
  fireEvent.click(screen.getByRole('button', { name: '3D' }))
  expect(state.car).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(state.road).toHaveBeenCalledTimes(1))
  expect(state.road.mock.calls[0][0]).toHaveLength(2)
  act(() => state.road.mock.calls[0][2]())
  expect(map.setPaintProperty).not.toHaveBeenCalled()
  map.getPitch.mockReturnValue(10)
  act(() => map.listeners.get('pitch')?.forEach((fn) => fn({})))
  expect(map.setLayoutProperty).toHaveBeenLastCalledWith('route-car', 'visibility', 'visible')
  map.getPitch.mockReturnValue(45)
  act(() => map.listeners.get('pitch')?.forEach((fn) => fn({})))
  expect(map.setLayoutProperty).toHaveBeenLastCalledWith('route-car', 'visibility', 'none')
  act(() => map.listeners.get('sourcedata')?.forEach((fn) => fn({ sourceId: 'route-car' })))
  expect(state.update).toHaveBeenCalledTimes(2)
  act(() => state.options.onFailure?.())
  expect(map.setLayoutProperty).toHaveBeenLastCalledWith('route-car', 'visibility', 'visible')
  view.rerender(<ReliefControls map={map as unknown as Map} />)
  expect(map.jumpTo).toHaveBeenLastCalledWith(expect.objectContaining({ pitch: 0 }))
  expect(map.listeners.get('pitch')?.size).toBe(0)
  expect(map.removeLayer).toHaveBeenCalledWith('garage-car-3d')
  expect(map.removeLayer).toHaveBeenCalledWith('selected-road-3d')
  expect(map.listeners.get('sourcedata')?.size).toBe(0)
})
it('uses a ship on Marine Highway and leaves its water route as a line', async () => {
  const map = mockMap()
  render(<ReliefControls map={map as unknown as Map} roadId="ship" />)
  await waitFor(() => expect(state.car).toHaveBeenCalled())
  expect(state.car.mock.calls[0][3]).toBe(true)
  expect(state.road).not.toHaveBeenCalled()
})

it('eases into the selected road when motion is enabled', async () => {
  state.motion = true
  const map = mockMap()
  render(<ReliefControls map={map as unknown as Map} roadId="road" />)
  await waitFor(() => expect(map.easeTo).toHaveBeenLastCalledWith(expect.objectContaining({ pitch: 45, duration: 800 })))
  expect(map.jumpTo).not.toHaveBeenCalled()
})
