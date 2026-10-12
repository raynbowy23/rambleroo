import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AppStatus } from './AppStatus'
import { requireNetwork } from '../../lib/network'
import { toast } from './Toast'

vi.mock('../../lib/registerWorker', () => ({ registerWorker: () => undefined, applyPendingUpdate: () => undefined }))
vi.mock('./Toast', () => ({ toast: vi.fn() }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('announces offline status and clears it when connectivity returns', () => {
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  render(
    <MemoryRouter>
      <AppStatus />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('status')).toBeNull()
  act(() => {
    online.mockReturnValue(false)
    window.dispatchEvent(new Event('offline'))
  })
  expect(screen.getByRole('status').textContent).toBe("You're offline. Saved roads and pages you've opened still work.")
  act(() => {
    online.mockReturnValue(true)
    window.dispatchEvent(new Event('online'))
  })
  expect(screen.queryByRole('status')).toBeNull()
})

it('explains why an external action cannot open offline', () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  const event = { preventDefault: vi.fn() }
  expect(requireNetwork(event)).toBe(false)
  expect(event.preventDefault).toHaveBeenCalledOnce()
  expect(toast).toHaveBeenCalledWith(expect.stringContaining('internet connection'))
})
