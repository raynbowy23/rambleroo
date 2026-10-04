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
