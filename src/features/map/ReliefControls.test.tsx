import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Map } from './maplibre'
import { ReliefControls } from './ReliefControls'
const state = vi.hoisted(() => ({ motion: true, relief: vi.fn(), toast: vi.fn() }))
vi.mock('../../lib/motion', () => ({ useMotionEnabled: () => state.motion }))
vi.mock('../../components/ui/Toast', () => ({ toast: state.toast }))
vi.mock('./terrain', () => ({ setRelief: state.relief, isTerrainError: (e: { sourceId: string }) => e.sourceId === 'raised-relief' }))
vi.mock('./layers', () => ({
  loadBywayGeometry: async () => ({
    features: [
      {
        properties: { id: 'road' },
        geometry: {
          coordinates: [
            [
              [0, 0],
              [0, 1],
              [1, 2],
            ],
          ],
        },
      },
    ],
  }),
}))
function mockMap() {
  const listeners = new globalThis.Map<string, (event: unknown) => void>()
  const canvas = document.createElement('canvas')
  return {
    listeners,
    canvas,
    on: vi.fn((type: string, fn: (event: unknown) => void) => listeners.set(type, fn)),
    off: vi.fn((type: string) => listeners.delete(type)),
    getCanvas: () => canvas,
    isMoving: () => false,
    jumpTo: vi.fn(),
    easeTo: vi.fn(),
    stop: vi.fn(),
    getSource: () => ({ setData: vi.fn() }),
  }
}
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  state.motion = true
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('persists the toggle and returns to a flat map with a toast on DEM failure', async () => {
  const map = mockMap()
  render(<ReliefControls map={map as unknown as Map} />)
  expect(state.relief).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '3D' }))
  expect(localStorage.getItem('rambleroo.relief.v1')).toBe('true')
  expect(map.easeTo).toHaveBeenLastCalledWith(expect.objectContaining({ pitch: 60 }))
  act(() => map.listeners.get('error')?.({ sourceId: 'raised-relief' }))
  expect(screen.getByRole('button', { name: '3D' }).getAttribute('aria-pressed')).toBe('false')
  expect(state.relief).toHaveBeenLastCalledWith(map, false)
  expect(map.easeTo).toHaveBeenLastCalledWith(expect.objectContaining({ pitch: 0 }))
  expect(state.toast).toHaveBeenCalledWith("3D terrain isn't available right now")
})
it('keeps 3D available with reduced motion, without flight or camera easing', async () => {
  state.motion = false
  const map = mockMap()
  render(<ReliefControls map={map as unknown as Map} roadId="road" fly />)
  await act(async () => {})
  fireEvent.click(screen.getByRole('button', { name: '3D' }))
  expect(screen.getByRole('status').textContent).toContain('Still 3D')
  expect(screen.queryByRole('button', { name: 'Fly this road' })).toBeNull()
  expect(map.easeTo).not.toHaveBeenCalled()
  expect(map.jumpTo).toHaveBeenCalledWith(expect.objectContaining({ pitch: 60 }))
})
it('pauses, resumes, skips and cancels flights on interaction and unmount', async () => {
  const cancel = vi.fn()
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  )
  vi.stubGlobal('cancelAnimationFrame', cancel)
  const map = mockMap()
  const view = render(<ReliefControls map={map as unknown as Map} roadId="road" fly />)
  await act(async () => {})
  fireEvent.click(screen.getByRole('button', { name: '3D' }))
  fireEvent.click(screen.getByRole('button', { name: 'Fly this road' }))
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
  expect(cancel).toHaveBeenCalledWith(1)
  fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
  fireEvent.click(screen.getByRole('button', { name: 'Fly this road' }))
  fireEvent.pointerDown(map.canvas)
  expect(screen.getByRole('button', { name: 'Fly this road' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Fly this road' }))
  view.unmount()
  expect(cancel).toHaveBeenCalledTimes(4)
})
