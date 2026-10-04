import { describe, expect, it, vi } from 'vitest'
import { PhotoSync } from './photo-sync'
import { emptyDocuments } from './account-stores'
const id = '12345678-1234-4234-8234-123456789abc'
function setup(remote: boolean, local: boolean, response = 201, user = crypto.randomUUID()) {
  const docs = emptyDocuments()
  docs.garage.car.picture = id
  const blob = new Blob(['original'])
  const storage = {
    get: vi.fn(async () => (local ? blob : undefined)),
    put: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  }
  const processed = new Blob(['processed'], { type: 'image/jpeg' })
  const fetcher = vi.fn(async (path: RequestInfo | URL, init?: RequestInit) => {
    if (path === '/api/photos') return Response.json(remote ? [{ id }] : [])
    if (init?.method === 'PUT')
      return Response.json({ code: 'photo-monthly-limit', resetsAt: '2027-01-01T00:00:00Z' }, { status: response })
    return new Response('processed', { headers: { 'Content-Type': 'image/jpeg' } })
  })
  const status = vi.fn()
  const process = vi.fn(async () => processed)
  const sync = new PhotoSync(user, storage, () => docs, fetcher as typeof fetch, status, process)
  return { sync, storage, fetcher, process, processed, blob, docs }
}
describe('local-first photo sync', () => {
  it('uploads processed bytes once at a time without replacing originals', async () => {
    const s = setup(false, true)
    await Promise.all([s.sync.sync(), s.sync.sync()])
    expect(s.process).toHaveBeenCalledWith(s.blob)
    expect(s.fetcher).toHaveBeenCalledTimes(2)
    expect(s.fetcher.mock.calls[1][1]?.body).toBe(s.processed)
    expect(s.storage.put).not.toHaveBeenCalled()
    expect(s.storage.remove).not.toHaveBeenCalled()
    s.sync.stop()
  })
  it('downloads missing references into local storage', async () => {
    const s = setup(true, false)
    await s.sync.sync()
    expect(s.storage.put).toHaveBeenCalledWith(id, expect.objectContaining({ type: 'image/jpeg', size: 9 }))
    expect(s.process).not.toHaveBeenCalled()
    s.sync.stop()
  })
  it('pauses on limits until app restart and never deletes originals', async () => {
    const s = setup(false, true, 429)
    await s.sync.sync()
    await s.sync.sync()
    expect(s.sync.message).toContain('Photo sync is paused until')
    expect(s.fetcher).toHaveBeenCalledTimes(2)
    expect(s.storage.remove).not.toHaveBeenCalled()
    s.sync.stop()
  })
  it('deletes remote photos removed from synced documents', async () => {
    const s = setup(true, false)
    delete s.docs.garage.car.picture
    await s.sync.sync()
    expect(s.fetcher.mock.calls[1][1]?.method).toBe('DELETE')
    s.sync.stop()
  })
  it('makes no requests after sign-out', async () => {
    const s = setup(false, true)
    s.sync.stop()
    await s.sync.sync()
    expect(s.fetcher).not.toHaveBeenCalled()
  })
})
