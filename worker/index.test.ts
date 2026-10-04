import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import type { DatabaseSync as SQLiteDatabase } from 'node:sqlite'
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
import { readFileSync } from 'node:fs'
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
  for (const file of ['0001_auth.sql', '0002_user_data.sql'])
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
