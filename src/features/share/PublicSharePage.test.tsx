import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import PublicSharePage, { loader } from './PublicSharePage'

vi.mock('../../lib/data', () => ({
  useCatalog: () => ({
    status: 'ready',
    byId: new Map([
      ['a', { id: 'a', name: 'First road', states: ['KY'], mappedMiles: 10, scene: 'forest', seed: 1 }],
      ['b', { id: 'b', name: 'Second road', states: ['TN'], mappedMiles: 20, scene: 'forest', seed: 2 }],
    ]),
  }),
}))
vi.mock('../../components/art', () => ({ Scene: () => <svg aria-hidden="true" /> }))
vi.setConfig({ testTimeout: 20_000 })
// The first render compiles the page's map imports; on a cold CI machine that alone can take over a second.
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
function open() {
  const router = createMemoryRouter([{ path: '/s/:slug', loader, Component: PublicSharePage, HydrateFallback: () => <p>Loading</p> }], {
    initialEntries: ['/s/abcdefghijklmnopqr'],
  })
  return render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}
it('loads once in StrictMode, preserves road order, and cleans up noindex', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ kind: 'trip', title: 'Autumn', roads: ['b', 'a'] }))
  vi.stubGlobal('fetch', fetcher)
  const view = open()
  await screen.findByRole('heading', { name: 'Autumn' }, { timeout: 10_000 })
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Second road', 'First road'])
  expect(screen.getByText('2 roads · 30 mapped miles')).toBeTruthy()
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher.mock.calls[0][0]).toBe('/api/public/shares/abcdefghijklmnopqr')
  expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex')
  view.unmount()
  expect(document.querySelector('meta[name="robots"]')).toBeNull()
})
it('shows the turned-off state for a 404', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, { status: 404 })))
  open()
  await screen.findByRole('heading', { name: 'This link was turned off' }, { timeout: 10_000 })
})
it('keeps transient errors distinct from revoked links', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, { status: 503 })))
  open()
  await screen.findByRole('heading', { name: 'This trip couldn’t be loaded' }, { timeout: 10_000 })
})
it('renders visit notes as text and retains missing roads', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      Response.json({
        kind: 'passport',
        roads: ['a', 'missing'],
        saved: ['a'],
        visits: [{ bywayId: 'a', date: '2026-10-03', note: '<script>secret()</script>' }],
      }),
    ),
  )
  open()
  await screen.findByText('<script>secret()</script>', undefined, { timeout: 10_000 })
  expect(screen.getByText('Saved road')).toBeTruthy()
  expect(screen.getByText('2026-10-03')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Road no longer in catalog' })).toBeTruthy()
  expect(screen.getByText('2 roads · 10 mapped miles')).toBeTruthy()
})
