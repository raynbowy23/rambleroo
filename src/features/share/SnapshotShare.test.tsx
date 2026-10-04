import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SnapshotShare } from './SnapshotShare'
const account = vi.hoisted(() => ({ user: { id: 'one' }, sync: vi.fn() }))
vi.mock('../../lib/account', () => ({
  useAccount: Object.assign((select: (s: typeof account) => unknown) => select(account), { getState: () => account }),
  syncBeforeSharing: account.sync,
}))
vi.mock('../account/SignInDialog', () => ({ SignInDialog: () => null }))
beforeEach(() => {
  account.sync.mockReset().mockResolvedValue(undefined)
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('defaults notes off and sends only kind, title and the explicit notes choice', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(Response.json({ slug: 'abcdefghijklmnopqr', title: 'Weekend', kind: 'passport' }, { status: 201 }))
  vi.stubGlobal('fetch', fetcher)
  render(<SnapshotShare kind="passport" />)
  fireEvent.click(screen.getByRole('button', { name: 'Share' }))
  const notes = screen.getByLabelText('Include my notes') as HTMLInputElement
  expect(notes.checked).toBe(false)
  fireEvent.click(notes)
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Weekend' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create link' }))
  await screen.findByLabelText('Share URL')
  expect(account.sync).toHaveBeenCalledWith('one')
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ kind: 'passport', title: 'Weekend', includeNotes: true })
  expect(fetcher.mock.calls[0][1].headers['X-Rambleroo-User']).toBe('one')
  expect((screen.getByLabelText('Share URL') as HTMLInputElement).value).toContain('/s/abcdefghijklmnopqr')
})
it('does not create a stale snapshot when syncing fails', async () => {
  account.sync.mockRejectedValue(new Error('Retry sync before sharing.'))
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  render(<SnapshotShare kind="trip" />)
  fireEvent.click(screen.getByRole('button', { name: 'Share' }))
  expect(screen.queryByRole('checkbox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Create link' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Retry sync before sharing.'))
  expect(fetcher).not.toHaveBeenCalled()
})
