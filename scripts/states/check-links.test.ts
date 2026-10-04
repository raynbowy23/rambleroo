import { describe, expect, it, vi } from 'vitest'
import { checkLink } from './check-links'

const pause = async () => {}
describe('chapter link checker', () => {
  it('falls back to GET when HEAD is rejected', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(new Response())
    expect(await checkLink('https://example.com', request, pause)).toEqual([])
    expect(request.mock.calls.map((call) => call[1]?.method)).toEqual(['HEAD', 'GET'])
  })
  it('reports intermediate host changes even when a redirect returns to the original host', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: 'https://new.example.com' } }))
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://example.com/final' } }))
      .mockResolvedValueOnce(new Response())
    expect(await checkLink('https://example.com', request, pause)).toHaveLength(2)
  })
  it('accepts same-host redirects and reports failed destinations', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: '/new' } }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
    expect(await checkLink('https://example.com', request, pause)).toEqual(['HTTP 404'])
  })
  it('reports network failures and bounds redirect loops', async () => {
    const broken = vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'))
    expect(await checkLink('https://example.com', broken, pause)).toEqual(['offline'])
    const loop = vi.fn<typeof fetch>().mockImplementation(async () => new Response(null, { status: 302, headers: { location: '/' } }))
    expect(await checkLink('https://example.com', loop, pause)).toEqual(['more than 10 redirects'])
    expect(loop).toHaveBeenCalledTimes(22)
  })
})
