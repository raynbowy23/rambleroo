import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import type { DatabaseSync as SQLiteDatabase } from 'node:sqlite'
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
import { readdirSync, readFileSync } from 'node:fs'
import type { Env, Statement } from './env'

const session = vi.hoisted(() => ({ user: { id: 'one', name: 'One', email: 'one@example.test', image: null }, authenticated: true }))
vi.mock('./auth', () => ({
  getAuth: () => ({
    api: { getSession: async () => (session.authenticated ? { user: session.user } : null) },
    handler: async () => Response.json({ mockedAuth: true }),
  }),
}))
import worker from './index'
import { PHOTO_LIMITS as L, photoMonth } from '../src/lib/photo-limits'
import { countOperation, photoRoute } from './photos'
let db: SQLiteDatabase
let env: Env
const document = { version: 1, roads: [{ bywayId: 'road', addedAt: '2026-10-04T00:00:00.000Z' }] }
function request(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  return worker.fetch(
    new Request(`https://rambleroo.app${path}`, {
      method,
      headers: { Origin: 'https://rambleroo.app', 'Content-Type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    env,
  )
}
beforeEach(() => {
  session.authenticated = true
  session.user.id = 'one'
  db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  // Every migration, in order, so the fake matches the live schema as it grows.
  for (const file of readdirSync(new URL('../migrations/', import.meta.url))
    .filter((f) => f.endsWith('.sql'))
    .sort())
    db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'))
  db.exec(`INSERT INTO user VALUES ('one', 'One', 'one@example.test', 1, NULL, 1, 1), ('two', 'Two', 'two@example.test', 1, NULL, 1, 1)`)
  const prepare = (sql: string): Statement => {
    let values: (string | number | null)[] = []
    return {
      bind(...args) {
        values = args as typeof values
        return this
      },
      async first<T>() {
        return (db.prepare(sql).get(...values) ?? null) as T | null
      },
      async all<T>() {
        return { results: db.prepare(sql).all(...values) as T[] }
      },
      async run() {
        return { meta: { changes: Number(db.prepare(sql).run(...values).changes) } }
      },
    }
  }
  env = {
    PHOTOS: {
      put: vi.fn(async () => null),
      get: vi.fn(async () => ({ body: new Blob(['image']).stream() })),
      delete: vi.fn(async () => {}),
      list: vi.fn(async () => ({ objects: [], truncated: false })),
    },
    RESEND_API_KEY: '',
    TURNSTILE_SECRET: '',
    DB: { prepare, batch: async (statements) => Promise.all(statements.map((statement) => statement.run())) },
    ASSETS: { fetch: async () => new Response('asset') },
    AUTH_URL: 'https://rambleroo.app',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    BETTER_AUTH_SECRET: 'test',
  }
})
afterEach(() => db.close())
describe('account Worker with SQLite-backed D1 fake', () => {
  it('requires sessions on every data/profile/export/deletion route', async () => {
    session.authenticated = false
    for (const [path, method] of [
      ['/api/me', 'GET'],
      ['/api/data', 'GET'],
      ['/api/export', 'GET'],
      ['/api/data/trip', 'PUT'],
      ['/api/account', 'DELETE'],
    ])
      expect((await request(path, method)).status).toBe(401)
  })
  it('rejects cross-origin writes and an account changed in another tab', async () => {
    expect((await request('/api/data/trip', 'PUT', {}, { Origin: 'https://elsewhere.test' })).status).toBe(403)
    expect((await request('/api/data/trip', 'PUT', {}, { 'X-Rambleroo-User': 'two' })).status).toBe(409)
  })
  it('creates, updates atomically, and returns the winner for stale or duplicate writes', async () => {
    const created = await request('/api/data/trip', 'PUT', { json: document, baseUpdatedAt: null })
    expect(created.status).toBe(200)
    const first = await created.json()
    const duplicate = await request('/api/data/trip', 'PUT', { json: document, baseUpdatedAt: null })
    expect(duplicate.status).toBe(409)
    expect((await duplicate.json()).server).toEqual(first)
    const second = await (
      await request('/api/data/trip', 'PUT', { json: { version: 1, roads: [] }, baseUpdatedAt: first.updatedAt })
    ).json()
    expect(second.updatedAt).toBeGreaterThan(first.updatedAt)
    expect((await request('/api/data/trip', 'PUT', { json: document, baseUpdatedAt: first.updatedAt })).status).toBe(409)
  })
  it('isolates users and returns all four kinds without caching', async () => {
    await request('/api/data/trip', 'PUT', { json: document, baseUpdatedAt: null })
    session.user.id = 'two'
    const response = await request('/api/data')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ passport: null, trip: null, garage: null, postcards: null })
  })
  it('rejects invalid, oversized and non-JSON payloads', async () => {
    expect((await request('/api/data/trip', 'PUT', { json: { version: 1, roads: [{}] }, baseUpdatedAt: null })).status).toBe(400)
    expect((await request('/api/data/trip', 'PUT', { extra: 'a'.repeat(263169) })).status).toBe(413)
    expect((await request('/api/data/trip', 'PUT', {}, { 'Content-Type': 'text/plain' })).status).toBe(415)
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('x'.repeat(264000)))
        controller.close()
      },
    })
    const response = await worker.fetch(
      new Request('https://rambleroo.app/api/data/trip', {
        method: 'PUT',
        headers: { Origin: 'https://rambleroo.app', 'Content-Type': 'application/json' },
        body,
        duplex: 'half',
      } as RequestInit),
      env,
    )
    expect(response.status).toBe(413)
  })
  it('exports records without credentials and cascades deletion', async () => {
    db.exec(
      `INSERT INTO session VALUES ('s', 99, 'secret-token', 1, 1, NULL, 'browser', 'one'); INSERT INTO account (id, accountId, providerId, userId, accessToken, createdAt, updatedAt) VALUES ('a', 'google-id', 'google', 'one', 'secret-access', 1, 1)`,
    )
    await request('/api/data/trip', 'PUT', { json: document, baseUpdatedAt: null })
    const response = await request('/api/export')
    expect(response.headers.get('content-disposition')).toContain('attachment')
    const exported = await response.text()
    expect(exported).toContain('google-id')
    expect(exported).not.toContain('secret-')
    expect(exported).toContain('"trip"')
    const deleted = await request('/api/account', 'DELETE')
    expect(deleted.status).toBe(200)
    expect(deleted.headers.get('set-cookie')).toContain('Max-Age=0')
    for (const table of ['session', 'account', 'user_data']) expect(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n).toBe(0)
    expect(db.prepare('SELECT COUNT(*) AS n FROM user').get()?.n).toBe(1)
  })
})

describe('share API', () => {
  async function createTrip() {
    await request('/api/data/trip', 'PUT', { json: document, baseUpdatedAt: null })
    const response = await request('/api/shares', 'POST', { kind: 'trip', title: 'Weekend roads' })
    expect(response.status).toBe(201)
    return response.json() as Promise<{ slug: string; kind: string; title: string; created: number; revoked: null }>
  }
  it('creates, lists privately, and reads an immutable snapshot signed out', async () => {
    const share = await createTrip()
    expect(share.slug).toMatch(/^[A-Za-z0-9_-]{18}$/)
    const list = await request('/api/shares')
    expect(list.headers.get('cache-control')).toBe('no-store')
    expect(await list.json()).toEqual([share])
    db.exec("DELETE FROM user_data WHERE user_id = 'one'")
    session.user.id = 'two'
    expect(await (await request('/api/shares')).json()).toEqual([])
    session.authenticated = false
    const response = await request(`/api/public/shares/${share.slug}`)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, max-age=300')
    expect(await response.json()).toEqual({ kind: 'trip', title: 'Weekend roads', roads: ['road'] })
  })
  it('allows only the owner to revoke and returns 404 publicly afterward', async () => {
    const { slug } = await createTrip()
    session.user.id = 'two'
    expect((await request(`/api/shares/${slug}`, 'DELETE')).status).toBe(404)
    expect((await request(`/api/public/shares/${slug}`)).status).toBe(200)
    session.user.id = 'one'
    expect((await request(`/api/shares/${slug}`, 'DELETE')).status).toBe(200)
    expect((await request(`/api/shares/${slug}`, 'DELETE')).status).toBe(200)
    expect((await (await request('/api/shares')).json())[0].revoked).toEqual(expect.any(Number))
    session.authenticated = false
    const response = await request(`/api/public/shares/${slug}`)
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect((await request('/api/public/shares/doesnotexist123')).status).toBe(404)
    expect((await request('/api/public/shares/bad')).status).toBe(404)
  })
  it('caps active shares at 50 and frees a slot on revocation', async () => {
    const first = await createTrip()
    for (let i = 1; i < 50; i++) expect((await request('/api/shares', 'POST', { kind: 'trip' })).status).toBe(201)
    expect((await request('/api/shares', 'POST', { kind: 'trip' })).status).toBe(409)
    await request(`/api/shares/${first.slug}`, 'DELETE')
    expect((await request('/api/shares', 'POST', { kind: 'trip' })).status).toBe(201)
  })
  it('requires sign-in and same origin, and rejects empty or invalid inputs', async () => {
    session.authenticated = false
    for (const method of ['GET', 'POST']) expect((await request('/api/shares', method)).status).toBe(401)
    expect((await request('/api/shares/abcdefghijkl', 'DELETE')).status).toBe(401)
    session.authenticated = true
    expect((await request('/api/shares', 'POST', { kind: 'trip' })).status).toBe(400)
    expect((await request('/api/shares', 'POST', { kind: 'garage' })).status).toBe(400)
    expect((await request('/api/shares', 'POST', {}, { Origin: 'https://elsewhere.test' })).status).toBe(403)
    const { slug } = await createTrip()
    expect((await request(`/api/shares/${slug}`, 'DELETE', undefined, { Origin: 'https://elsewhere.test' })).status).toBe(403)
    expect((await request('/api/shares', 'POST', { kind: 'trip' }, { 'X-Rambleroo-User': 'two' })).status).toBe(409)
  })
  it('exports only share metadata and cascades account deletion', async () => {
    const share = await createTrip()
    const exported = await (await request('/api/export')).json()
    expect(exported.shares).toEqual([share])
    await request('/api/account', 'DELETE')
    expect(db.prepare('SELECT COUNT(*) AS n FROM shares').get()?.n).toBe(0)
    session.authenticated = false
    expect((await request(`/api/public/shares/${share.slug}`)).status).toBe(404)
  })
  it('builds passport snapshots server-side with notes only on explicit opt-in', async () => {
    await request('/api/data/passport', 'PUT', {
      baseUpdatedAt: null,
      json: {
        version: 1,
        saved: { road: '2026-10-04' },
        visits: [{ id: 'secret', bywayId: 'road', date: '2026-10-04', createdAt: '2026-10-04', scope: 'whole', note: 'My note' }],
      },
    })
    for (const includeNotes of [false, true]) {
      const { slug } = await (
        await request('/api/shares', 'POST', { kind: 'passport', includeNotes, snapshot: { email: 'injected' } })
      ).json()
      const snapshot = await (await request(`/api/public/shares/${slug}`)).json()
      expect(snapshot).toEqual({
        kind: 'passport',
        roads: ['road'],
        saved: ['road'],
        visits: [{ bywayId: 'road', date: '2026-10-04', ...(includeNotes ? { note: 'My note' } : {}) }],
      })
    }
  })
})

describe('private photo API', () => {
  const id = '12345678-1234-4234-8234-123456789abc'
  const upload = (photo = id, size = 100) =>
    worker.fetch(
      new Request(`https://rambleroo.app/api/photos/${photo}`, {
        method: 'PUT',
        headers: { Origin: 'https://rambleroo.app', 'Content-Type': 'image/jpeg' },
        body: new Uint8Array(size),
      }),
      env,
    )
  it('uploads once, reads only for the owner, and exports metadata', async () => {
    expect((await upload()).status).toBe(201)
    expect((await upload()).status).toBe(200)
    expect(env.PHOTOS.put).toHaveBeenCalledTimes(1)
    const read = await request(`/api/photos/${id}`)
    expect(read.status).toBe(200)
    expect(read.headers.get('cache-control')).toBe('private, max-age=86400')
    expect((await (await request('/api/export')).json()).photos).toEqual([
      { id, bytes: 100, type: 'image/jpeg', created: expect.any(Number) },
    ])
    expect(await (await request('/api/usage')).json()).toMatchObject({ count: 1, bytes: 100, available: true })
    session.user.id = 'two'
    expect((await request(`/api/photos/${id}`)).status).toBe(404)
    expect((await request(`/api/photos/${id}`, 'DELETE')).status).toBe(404)
    expect(env.PHOTOS.get).toHaveBeenCalledTimes(1)
  })
  it('refuses global storage and monthly ceilings before put', async () => {
    db.prepare("UPDATE usage SET value = ? WHERE metric = 'storedBytes'").run(L.storedBytes)
    expect((await upload()).status).toBe(507)
    db.prepare("UPDATE usage SET value = 0 WHERE metric = 'storedBytes'").run()
    db.prepare('INSERT INTO usage VALUES (?, ?, ?)').run(photoMonth().month, 'classA', L.classA)
    const response = await upload()
    expect(response.status).toBe(429)
    expect(await response.json()).toMatchObject({ code: 'photo-monthly-limit', resetsAt: photoMonth().resetsAt })
    expect(env.PHOTOS.put).not.toHaveBeenCalled()
    expect(db.prepare('SELECT COUNT(*) AS n FROM photos').get()?.n).toBe(0)
  })
  it('serializes reservations at the last storage slot', async () => {
    db.prepare("UPDATE usage SET value = ? WHERE metric = 'storedBytes'").run(L.storedBytes - 100)
    const first = await upload()
    session.user.id = 'two'
    expect((await upload('22345678-1234-4234-8234-123456789abc')).status).toBe(507)
    expect(first.status).toBe(201)
    expect(env.PHOTOS.put).toHaveBeenCalledTimes(1)
  })
  it('cannot over-reserve storage across concurrent accounts', async () => {
    db.prepare("UPDATE usage SET value = ? WHERE metric = 'storedBytes'").run(L.storedBytes - 100)
    const put = (user: string, photo: string) =>
      photoRoute(
        new Request('https://rambleroo.app/api/photos/' + photo, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg' },
          body: new Uint8Array(100),
        }),
        env,
        user,
        photo,
      )
    const results = await Promise.all([put('one', id), put('two', '22345678-1234-4234-8234-123456789abc')])
    expect(results.map((r) => r.status).sort()).toEqual([201, 507])
    expect(env.PHOTOS.put).toHaveBeenCalledTimes(1)
    expect(db.prepare("SELECT value FROM usage WHERE metric = 'storedBytes'").get()?.value).toBe(L.storedBytes)
  })
  it('waits for a live lock but takes over one left by an interrupted request', async () => {
    db.prepare('INSERT INTO photo_locks (user_id, expires_at) VALUES (?, ?)').run(session.user.id, Date.now() + 60_000)
    expect((await upload()).status).toBe(503)
    db.prepare('UPDATE photo_locks SET expires_at = ? WHERE user_id = ?').run(Date.now() - 1, session.user.id)
    expect((await upload()).status).toBe(201)
  })
  it('caps user count and bytes', async () => {
    for (let i = 0; i < 60; i++) db.prepare("INSERT INTO photos VALUES (?, 'one', 1, 'image/jpeg', 1, 'ready')").run(`old-${i}`)
    expect((await upload()).status).toBe(507)
    db.exec("DELETE FROM photos; INSERT INTO photos VALUES ('big', 'one', 60000000, 'image/jpeg', 1, 'ready')")
    expect(await (await upload()).json()).toMatchObject({ code: 'photo-user-limit' })
    expect(env.PHOTOS.put).not.toHaveBeenCalled()
  })
  it('counts reads and failed calls, with atomic monthly rollover', async () => {
    await upload()
    db.prepare('INSERT INTO usage VALUES (?, ?, ?)').run(photoMonth().month, 'classB', L.classB)
    expect((await request(`/api/photos/${id}`)).status).toBe(429)
    expect(env.PHOTOS.get).not.toHaveBeenCalled()
    db.prepare("UPDATE usage SET value = ? WHERE metric = 'classA'").run(L.classA - 1)
    const results = await Promise.allSettled([countOperation(env, 'classA'), countOperation(env, 'classA')])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2030-01-01T00:00:00Z'))
      await countOperation(env, 'classA')
      expect(db.prepare("SELECT value FROM usage WHERE month = '2030-01' AND metric = 'classA'").get()?.value).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })
  it('keeps storage reserved on uncertain puts and recovers safely', async () => {
    vi.mocked(env.PHOTOS.put).mockRejectedValueOnce(new Error('timeout'))
    expect((await upload()).status).toBe(503)
    expect(db.prepare("SELECT value FROM usage WHERE metric = 'storedBytes'").get()?.value).toBe(100)
    expect((await upload()).status).toBe(201)
    expect(env.PHOTOS.delete).toHaveBeenCalledWith(`u/one/${id}`)
    expect(db.prepare("SELECT value FROM usage WHERE metric = 'storedBytes'").get()?.value).toBe(100)
  })
  it('deletes objects before releasing storage, including account cleanup', async () => {
    await upload()
    expect((await request(`/api/photos/${id}`, 'DELETE')).status).toBe(200)
    expect(db.prepare("SELECT value FROM usage WHERE metric = 'storedBytes'").get()?.value).toBe(0)
    await upload()
    vi.mocked(env.PHOTOS.list).mockResolvedValueOnce({ objects: [{ key: `u/one/${id}` }], truncated: false })
    await request('/api/account', 'DELETE')
    expect(env.PHOTOS.list).toHaveBeenCalledWith({ prefix: 'u/one/', cursor: undefined })
    expect(env.PHOTOS.delete).toHaveBeenCalledTimes(2)
    expect(db.prepare("SELECT value FROM usage WHERE metric = 'storedBytes'").get()?.value).toBe(0)
  })
  it('still deletes the account but retains leftover storage on cleanup failure', async () => {
    await upload()
    vi.mocked(env.PHOTOS.list).mockRejectedValueOnce(new Error('offline'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await request('/api/account', 'DELETE')).status).toBe(200)
    expect(log).toHaveBeenCalledWith(expect.any(String), 'u/one/', expect.any(Error))
    expect(db.prepare("SELECT value FROM usage WHERE metric = 'storedBytes'").get()?.value).toBe(100)
    log.mockRestore()
  })
  it('rejects oversized bodies, bad IDs, MIME types, origins and guests', async () => {
    expect((await upload(id, L.photoBytes + 1)).status).toBe(413)
    expect((await upload('bad')).status).toBe(400)
    expect((await request(`/api/photos/${id}`, 'PUT', {})).status).toBe(415)
    expect((await request(`/api/photos/${id}`, 'DELETE', undefined, { Origin: 'https://other.test' })).status).toBe(403)
    session.authenticated = false
    expect((await upload()).status).toBe(401)
    expect((await request('/api/usage')).status).toBe(401)
    expect(env.PHOTOS.put).not.toHaveBeenCalled()
  })
})

describe('street view proxy', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('serves only listed Mapillary frames, signed out, without exposing the token', async () => {
    session.authenticated = false
    const listed = (JSON.parse(readFileSync(new URL('../content/streetview.json', import.meta.url), 'utf8')) as { id: string }[])[0]
    expect((await request('/api/street/123')).status).toBe(404)
    if (!listed) return
    env.MAPILLARY_TOKEN = 'secret-token'
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input instanceof Request ? input.url : input)
        calls.push(url)
        if (url.startsWith('https://graph.mapillary.com/')) {
          expect(new Headers(init?.headers).get('Authorization')).toBe('OAuth secret-token')
          return Response.json({ thumb_1024_url: 'https://scontent.example/frame.jpg' })
        }
        return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } })
      }),
    )
    const res = await request(`/api/street/${listed.id}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/jpeg')
    expect(res.headers.get('Cache-Control')).toContain('public')
    expect(calls.every((c) => !c.includes('secret-token'))).toBe(true)
  })
})
