import { afterEach, expect, it, vi } from 'vitest'
import { renderHook, waitFor, cleanup } from '@testing-library/react'
import { useDioramaSpec } from './useDioramaSpec'
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('fetches per road, clears stale content, and hides missing miniatures', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ bywayId: 'first' }) })
    .mockResolvedValueOnce({ ok: false })
  vi.stubGlobal('fetch', fetcher)
  const { result, rerender } = renderHook(({ id }) => useDioramaSpec(id), { initialProps: { id: 'first' } })
  await waitFor(() => expect(result.current?.bywayId).toBe('first'))
  expect(fetcher.mock.calls[0][0]).toBe('/data/dioramas/first.json')
  rerender({ id: 'missing' })
  expect(result.current).toBeNull()
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  expect(result.current).toBeNull()
})
it('aborts stale requests on road changes and unmount', () => {
  const fetcher = vi.fn().mockImplementation(() => new Promise(() => {}))
  vi.stubGlobal('fetch', fetcher)
  const { rerender, unmount } = renderHook(({ id }) => useDioramaSpec(id), { initialProps: { id: 'one' } })
  rerender({ id: 'two' })
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true)
  unmount()
  expect(fetcher.mock.calls[1][1].signal.aborted).toBe(true)
})
