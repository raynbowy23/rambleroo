import { describe, expect, it } from 'vitest'
import { buildShareLinks } from './links'

describe('buildShareLinks', () => {
  it('round trips punctuation, Unicode, newlines and URL query parameters', () => {
    const url = 'https://example.com/byway/a?one=1&two=a%20b#road'
    const title = 'Côte & River / #12?'
    const text = `${title} — found on Rambleroo\nMy note: tea + sunshine = joy!`
    const links = buildShareLinks({ url, title, text })
    expect(new URL(links.email).searchParams.get('subject')).toBe(title)
    expect(new URL(links.email).searchParams.get('body')).toBe(`${text}\n\n${url}`)
    expect(new URL(links.x).searchParams.get('text')).toBe(text)
    expect(new URL(links.x).searchParams.get('url')).toBe(url)
    expect(new URL(links.facebook).searchParams.get('u')).toBe(url)
    expect(new URL(links.bluesky).searchParams.get('text')).toBe(`${text}\n${url}`)
    expect(new URL(links.reddit).searchParams.get('url')).toBe(url)
    expect(new URL(links.reddit).searchParams.get('title')).toBe(text)
  })
})
