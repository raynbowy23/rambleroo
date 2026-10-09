import views from '../content/streetview.json'
import momentViews from '../content/streetview-moments.json'
import type { Env } from './env'

// Serves the Mapillary frames picked in content/streetview.json and streetview-moments.json. Mapillary image URLs are signed and expire, so the page asks
// us by id and we look up a fresh URL with the token. The bytes come through here rather than by redirect, so visitors' browsers
// never contact Meta's image CDN, and each frame is cached at the edge.
const allowed = new Set([...(views as { id: string }[]), ...(momentViews as { id: string }[])].map((v) => v.id))
const edge = () => (globalThis.caches as unknown as { default?: Cache } | undefined)?.default

export async function streetView(request: Request, env: Env, id: string): Promise<Response> {
  if (!allowed.has(id) || request.method !== 'GET') return new Response('Not found', { status: 404 })
  const key = new Request(new URL(`/api/street/${id}`, request.url).toString())
  const cache = edge()
  const hit = await cache?.match(key)
  if (hit) return hit
  const meta = await fetch(`https://graph.mapillary.com/${id}?fields=thumb_1024_url`, {
    headers: { Authorization: `OAuth ${env.MAPILLARY_TOKEN}` },
  })
  const url = meta.ok ? ((await meta.json()) as { thumb_1024_url?: string }).thumb_1024_url : undefined
  if (!url) return new Response('Street view unavailable', { status: 502 })
  const image = await fetch(url)
  const type = image.headers.get('Content-Type') ?? ''
  if (!image.ok || !type.startsWith('image/')) return new Response('Street view unavailable', { status: 502 })
  const response = new Response(image.body, {
    headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=604800', 'X-Content-Type-Options': 'nosniff' },
  })
  await cache?.put(key, response.clone())
  return response
}
