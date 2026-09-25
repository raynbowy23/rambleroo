import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useMotionEnabled } from './motion'
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('follows live system motion changes and removes its listener', () => {
  let change = () => {}
  const query = {
    matches: false,
    addEventListener: vi.fn((_type, listener) => {
      change = listener
    }),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('matchMedia', () => query)
  const { result, unmount } = renderHook(() => useMotionEnabled())
  expect(result.current).toBe(true)
  act(() => {
    query.matches = true
    change()
  })
  expect(result.current).toBe(false)
  unmount()
  expect(query.removeEventListener).toHaveBeenCalledWith('change', change)
})
