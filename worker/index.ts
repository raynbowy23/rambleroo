import { buildSnapshot, createShareSlug, parseShareRequest } from '../src/lib/shares'
import { getAuth } from './auth'
import type { Env } from './env'
import { dataKinds, MAX_DOCUMENT_BYTES, parsePut, type DataKind } from '../src/lib/account-data'

type Row = { kind: DataKind; json: string; updated_at: number }
const copy = (row: Row | null) => (row ? { json: JSON.parse(row.json), updatedAt: row.updated_at } : null)
const json = (value: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
async function readBody(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new Response('JSON required', { status: 415 })
  // Allow the small PUT envelope in addition to the per-document cap; count streamed bytes even without Content-Length.
  const limit = MAX_DOCUMENT_BYTES + 1024
  if (Number(request.headers.get('content-length')) > limit) throw new Response('Too large', { status: 413 })
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Missing body')
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const part = await reader.read()
    if (part.done) break
    length += part.value.length
    if (length > limit) {
      await reader.cancel()
      throw new Response('Too large', { status: 413 })
    }
    chunks.push(part.value)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
    if (pathname === '/api/health') return json({ ok: true })
    try {
      const publicShare = pathname.match(/^\/api\/public\/shares\/([A-Za-z0-9_-]{12,128})$/)
      if (publicShare && request.method === 'GET') {
        const row = await env.DB.prepare('SELECT snapshot FROM shares WHERE slug = ? AND revoked_at IS NULL')
          .bind(publicShare[1])
          .first<{ snapshot: string }>()
        return row ? json(JSON.parse(row.snapshot), 200, { 'Cache-Control': 'public, max-age=300' }) : json({ error: 'Not found' }, 404)
      }
      if (pathname.startsWith('/api/public/shares/')) return json({ error: 'Not found' }, 404)
      const auth = getAuth(env)
      if (pathname.startsWith('/api/auth/')) {
        const response = await auth.handler(request)
        const secured = new Response(response.body, response)
        secured.headers.set('Cache-Control', 'no-store')
        return secured
      }
      if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('origin') !== new URL(env.AUTH_URL).origin)
        return json({ error: 'Invalid origin' }, 403)
      const session = await auth.api.getSession({ headers: request.headers })
      if (!session) return json({ error: 'Sign in required' }, 401)
      const userId = session.user.id
      if (request.headers.has('x-rambleroo-user') && request.headers.get('x-rambleroo-user') !== userId)
        return json({ error: 'Account changed' }, 409)
      const user = { id: userId, name: session.user.name, email: session.user.email, image: session.user.image ?? null }
      if (pathname === '/api/shares' && request.method === 'GET') {
        const shares = await env.DB.prepare(
          'SELECT slug, kind, title, created_at AS created, revoked_at AS revoked FROM shares WHERE user_id = ? ORDER BY created_at DESC',
        )
          .bind(userId)
          .all()
        return json(shares.results)
      }
      if (pathname === '/api/shares' && request.method === 'POST') {
        let input, snapshot
        try {
          input = parseShareRequest(await readBody(request))
          const row = await env.DB.prepare('SELECT json FROM user_data WHERE user_id = ? AND kind = ?')
            .bind(userId, input.kind)
            .first<{ json: string }>()
          if (!row) return json({ error: 'Add a road before creating a share link' }, 400)
          snapshot = buildSnapshot(input, JSON.parse(row.json))
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : 'Invalid request' }, error instanceof Response ? error.status : 400)
        }
        const slug = createShareSlug()
        const created = Date.now()
        // A single conditional insert serializes the limit check with creation, including concurrent requests.
        const result = await env.DB.prepare(
          'INSERT INTO shares (slug, user_id, kind, snapshot, title, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM shares WHERE user_id = ? AND revoked_at IS NULL) < 50',
        )
          .bind(slug, userId, input.kind, JSON.stringify(snapshot), input.title ?? null, created, userId)
          .run()
        if (!result.meta.changes) return json({ error: 'You have 50 active share links. Turn one off before creating another.' }, 409)
        return json({ slug, kind: input.kind, title: input.title ?? null, created, revoked: null }, 201)
      }
      const ownedShare = pathname.match(/^\/api\/shares\/([A-Za-z0-9_-]{12,128})$/)
      if (ownedShare && request.method === 'DELETE') {
        const result = await env.DB.prepare('UPDATE shares SET revoked_at = COALESCE(revoked_at, ?) WHERE slug = ? AND user_id = ?')
          .bind(Date.now(), ownedShare[1], userId)
          .run()
        return result.meta.changes ? json({ ok: true }) : json({ error: 'Not found' }, 404)
      }
      if (pathname === '/api/me' && request.method === 'GET') return json(user)
      if ((pathname === '/api/data' || pathname === '/api/export') && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT kind, json, updated_at FROM user_data WHERE user_id = ?').bind(userId).all<Row>()
        const data = Object.fromEntries(dataKinds.map((kind) => [kind, copy(rows.results.find((row) => row.kind === kind) ?? null)]))
        if (pathname === '/api/data') return json(data)
        // Export profile, provider identity and session metadata, never credentials or session tokens.
        const accounts = await env.DB.prepare('SELECT providerId, accountId, scope, createdAt, updatedAt FROM account WHERE userId = ?')
          .bind(userId)
          .all()
        const sessions = await env.DB.prepare('SELECT createdAt, updatedAt, expiresAt, ipAddress, userAgent FROM session WHERE userId = ?')
          .bind(userId)
          .all()
        const profile = await env.DB.prepare('SELECT id, name, email, emailVerified, image, createdAt, updatedAt FROM "user" WHERE id = ?')
          .bind(userId)
          .first()
        // Passkey labels and dates only; public keys and credential IDs are not useful to a person and stay out of the export.
        const passkeys = await env.DB.prepare('SELECT name, deviceType, backedUp, createdAt FROM passkey WHERE userId = ?')
          .bind(userId)
          .all()
        const shares = await env.DB.prepare(
          'SELECT slug, kind, title, created_at AS created, revoked_at AS revoked FROM shares WHERE user_id = ?',
        )
          .bind(userId)
          .all()
        return json(
          {
            shares: shares.results,
            version: 1,
            exportedAt: new Date().toISOString(),
            user: profile,
            data,
            accounts: accounts.results,
            sessions: sessions.results,
            passkeys: passkeys.results,
          },
          200,
          { 'Content-Disposition': 'attachment; filename="rambleroo-account.json"' },
        )
      }
      if (pathname === '/api/account' && request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM "user" WHERE id = ?').bind(userId).run()
        return json({ ok: true }, 200, {
          'Set-Cookie': '__Secure-rambleroo.session_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
        })
      }
      const kind = pathname.slice('/api/data/'.length) as DataKind
      if (pathname.startsWith('/api/data/') && dataKinds.includes(kind) && request.method === 'PUT') {
        let payload
        try {
          payload = parsePut(kind, await readBody(request))
        } catch (error) {
          return json(
            {
              error:
                error instanceof Response
                  ? error.statusText || 'Invalid request'
                  : error instanceof Error
                    ? error.message
                    : 'Invalid payload',
            },
            error instanceof Response ? error.status : 400,
          )
        }
        const { json: document, baseUpdatedAt } = payload
        const updatedAt = Math.max(Date.now(), (baseUpdatedAt ?? 0) + 1)
        const serialized = JSON.stringify(document)
        const result =
          baseUpdatedAt === null
            ? await env.DB.prepare(
                'INSERT INTO user_data (user_id, kind, json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, kind) DO NOTHING',
              )
                .bind(userId, kind, serialized, updatedAt)
                .run()
            : await env.DB.prepare('UPDATE user_data SET json = ?, updated_at = ? WHERE user_id = ? AND kind = ? AND updated_at = ?')
                .bind(serialized, updatedAt, userId, kind, baseUpdatedAt)
                .run()
        if (!result.meta.changes) {
          const row = await env.DB.prepare('SELECT kind, json, updated_at FROM user_data WHERE user_id = ? AND kind = ?')
            .bind(userId, kind)
            .first<Row>()
          return json({ error: 'Conflict', server: copy(row) }, 409)
        }
        return json({ json: document, updatedAt })
      }
      return json({ error: 'Not found' }, 404)
    } catch {
      return json({ error: 'Account service unavailable' }, 503)
    }
  },
}
