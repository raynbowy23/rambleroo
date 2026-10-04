import { PHOTO_ID, PHOTO_LIMITS as L, photoMonth } from '../src/lib/photo-limits'
import type { Env } from './env'
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const full = (code: 'photo-storage-full' | 'photo-user-limit' | 'photo-monthly-limit') =>
  json(
    {
      error:
        code === 'photo-monthly-limit'
          ? 'Photo sync is paused until next month — your photos are safe on this device'
          : 'Photo sync is paused because storage is full — your photos are safe on this device',
      code,
      ...(code === 'photo-monthly-limit' ? { resetsAt: photoMonth().resetsAt } : {}),
    },
    code === 'photo-monthly-limit' ? 429 : 507,
  )
export async function countOperation(env: Env, metric: 'classA' | 'classB') {
  const { month } = photoMonth()
  await env.DB.prepare('INSERT INTO usage (month, metric, value) VALUES (?, ?, 0) ON CONFLICT DO NOTHING').bind(month, metric).run()
  const result = await env.DB.prepare('UPDATE usage SET value = value + ? WHERE month = ? AND metric = ? AND value <= ?')
    .bind(1, month, metric, L[metric] - 1)
    .run()
  if (!result.meta.changes) throw full('photo-monthly-limit')
}
const LOCK_MS = 2 * 60 * 1000
async function locked<T>(env: Env, user: string, action: () => Promise<T>) {
  // Take the lock, or take over one whose holder was interrupted (expired lease).
  const now = Date.now()
  const lock = await env.DB.prepare(
    'INSERT INTO photo_locks (user_id, expires_at) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET expires_at = excluded.expires_at WHERE photo_locks.expires_at < ?',
  )
    .bind(user, now + LOCK_MS, now)
    .run()
  if (!lock.meta.changes) throw json({ error: 'Photo sync is busy. Your photos are safe on this device.' }, 503)
  try {
    return await action()
  } finally {
    await env.DB.prepare('DELETE FROM photo_locks WHERE user_id = ?').bind(user).run()
  }
}
export async function photoList(env: Env, user: string) {
  return (
    await env.DB.prepare("SELECT id, bytes, type, created_at AS created FROM photos WHERE user_id = ? AND state = 'ready'").bind(user).all()
  ).results
}
export async function photoUsage(env: Env, user: string) {
  const own = await env.DB.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(bytes), 0) AS bytes FROM photos WHERE user_id = ?')
    .bind(user)
    .first<{ count: number; bytes: number }>()
  const rows = await env.DB.prepare("SELECT metric, value FROM usage WHERE month = ? OR month = 'all'")
    .bind(photoMonth().month)
    .all<{ metric: string; value: number }>()
  const used = Object.fromEntries(rows.results.map((r) => [r.metric, r.value]))
  const code =
    used.classA >= L.classA || used.classB >= L.classB
      ? 'photo-monthly-limit'
      : used.storedBytes >= L.storedBytes
        ? 'photo-storage-full'
        : own!.count >= L.userCount || own!.bytes >= L.userBytes
          ? 'photo-user-limit'
          : undefined
  const lock = await env.DB.prepare('SELECT user_id FROM photo_locks WHERE user_id = ? AND expires_at >= ?').bind(user, Date.now()).first()
  return json({
    ...own,
    available: !code && !lock,
    ...(code ? { code, ...(code === 'photo-monthly-limit' ? { resetsAt: photoMonth().resetsAt } : {}) } : {}),
  })
}
async function release(env: Env, user: string, id: string) {
  await env.DB.batch([
    env.DB.prepare("UPDATE photos SET state = 'deleted' WHERE user_id = ? AND id = ?").bind(user, id),
    env.DB.prepare("DELETE FROM photos WHERE user_id = ? AND id = ? AND state = 'deleted'").bind(user, id),
  ])
}
export async function deletePhotoPrefix(env: Env, user: string) {
  const prefix = `u/${user}/`
  try {
    await locked(env, user, async () => {
      let cursor: string | undefined
      do {
        await countOperation(env, 'classA')
        const page = await env.PHOTOS.list({ prefix, cursor })
        for (const object of page.objects) {
          await countOperation(env, 'classA')
          await env.PHOTOS.delete(object.key)
          await release(env, user, object.key.slice(prefix.length))
        }
        cursor = page.truncated ? page.cursor : undefined
        if (page.truncated && !cursor) throw new Error('Missing R2 cursor')
      } while (cursor)
      await env.DB.prepare('DELETE FROM "user" WHERE id = ?').bind(user).run()
    })
  } catch (error) {
    console.error('Photo cleanup incomplete; leftover prefix', prefix, error)
  }
}
export async function photoRoute(request: Request, env: Env, user: string, id: string) {
  if (!PHOTO_ID.test(id)) return json({ error: 'Invalid photo ID' }, 400)
  const key = `u/${user}/${id}`
  if (request.method === 'GET') {
    const row = await env.DB.prepare("SELECT type FROM photos WHERE id = ? AND user_id = ? AND state = 'ready'")
      .bind(id, user)
      .first<{ type: string }>()
    if (!row) return json({ error: 'Not found' }, 404)
    await countOperation(env, 'classB')
    const object = await env.PHOTOS.get(key)
    return object
      ? new Response(object.body, {
          headers: {
            'Content-Type': row.type,
            'Cache-Control': 'private, max-age=86400',
            Vary: 'Cookie, X-Rambleroo-User',
            'X-Content-Type-Options': 'nosniff',
          },
        })
      : json({ error: 'Not found' }, 404)
  }
  if (!['PUT', 'DELETE'].includes(request.method)) return json({ error: 'Not found' }, 404)
  let bytes = new Uint8Array(0),
    type = ''
  if (request.method === 'PUT') {
    type = request.headers.get('content-type') ?? ''
    if (!['image/jpeg', 'image/webp'].includes(type)) return json({ error: 'JPEG or WebP required' }, 415)
    if (Number(request.headers.get('content-length')) > L.photoBytes) return json({ error: 'Photo exceeds 1.5 MB' }, 413)
    const reader = request.body?.getReader()
    if (!reader) return json({ error: 'Missing image' }, 400)
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.length
      if (size > L.photoBytes) {
        await reader.cancel()
        return json({ error: 'Photo exceeds 1.5 MB' }, 413)
      }
      chunks.push(part.value)
    }
    if (!size) return json({ error: 'Missing image' }, 400)
    bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.length
    }
  }
  return locked(env, user, async () => {
    const existing = await env.DB.prepare('SELECT user_id, state FROM photos WHERE id = ?')
      .bind(id)
      .first<{ user_id: string; state: string }>()
    if (existing && existing.user_id !== user) return json({ error: 'Not found' }, 404)
    if (request.method === 'DELETE') {
      if (!existing) return json({ ok: true })
      await countOperation(env, 'classA')
      await env.PHOTOS.delete(key)
      await release(env, user, id)
      return json({ ok: true })
    }
    if (existing?.state === 'ready') return json({ ok: true })
    // Pending rows may represent an uncertain put; delete before retrying so their reservation is never released prematurely.
    if (existing) {
      await countOperation(env, 'classA')
      await env.PHOTOS.delete(key)
      await release(env, user, id)
    }
    const reserved = await env.DB.prepare(
      `INSERT INTO photos (id, user_id, bytes, type, created_at) SELECT ?, ?, ?, ?, ? WHERE (SELECT value FROM usage WHERE month = 'all' AND metric = 'storedBytes') <= ? AND (SELECT COUNT(*) FROM photos WHERE user_id = ?) < ? AND (SELECT COALESCE(SUM(bytes), 0) FROM photos WHERE user_id = ?) <= ?`,
    )
      .bind(id, user, bytes.length, type, Date.now(), L.storedBytes - bytes.length, user, L.userCount, user, L.userBytes - bytes.length)
      .run()
    if (!reserved.meta.changes) {
      const total = await env.DB.prepare("SELECT value FROM usage WHERE month = 'all' AND metric = 'storedBytes'").first<{
        value: number
      }>()
      return full(!total || total.value > L.storedBytes - bytes.length ? 'photo-storage-full' : 'photo-user-limit')
    }
    try {
      await countOperation(env, 'classA')
    } catch (error) {
      await release(env, user, id)
      throw error
    }
    await env.PHOTOS.put(key, bytes, { httpMetadata: { contentType: type } })
    await env.DB.prepare("UPDATE photos SET state = 'ready' WHERE id = ? AND user_id = ?").bind(id, user).run()
    return json({ ok: true }, 201)
  })
}
