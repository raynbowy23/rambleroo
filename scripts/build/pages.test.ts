import { expect, it } from 'vitest'
import { publicPages, sitemap, withMeta } from './pages'
import type { BywaySummary, Collection, Photo, StateChapter } from '../../src/lib/types'

const index =
  '<head>\n    <title>Rambleroo</title>\n    <meta name="description" content="Drive into the heart of the American story." />\n  </head>'

it('puts the page title, description and preview tags in the head, escaped', () => {
  const html = withMeta(index, {
    path: '/byway/a',
    title: 'Ocean & "Sky" · Rambleroo',
    description: 'Cliffs <and> coves.',
    image: { url: 'https://photos.example/a.jpg', width: 1600, height: 900, alt: 'Cliffs.' },
  })
  expect(html).toContain('<title>Ocean &amp; &quot;Sky&quot; · Rambleroo</title>')
  expect(html).toContain('<meta name="description" content="Cliffs &lt;and&gt; coves." />')
  expect(html).toContain('<link rel="canonical" href="https://rambleroo.app/byway/a" />')
  expect(html).toContain('<meta property="og:image" content="https://photos.example/a.jpg" />')
  expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />')
  expect(() => withMeta('<head></head>', { path: '/', title: 't', description: 'd' })).toThrow()
})

it('lists every road, state and collection page in the sitemap, but not the legal pages', () => {
  const pages = publicPages({
    byways: [{ id: 'a', name: 'A Road', states: ['ME'], themes: [], designations: [], mappedMiles: 10 } as unknown as BywaySummary],
    taglines: {},
    chapters: [{ code: 'ME', name: 'Maine', tagline: 'Coast.', intro: '', programs: [], sources: [] } as StateChapter],
    collections: [{ slug: 'coast', title: 'Coast', intro: 'Shores.', bywayIds: ['a'] } as unknown as Collection],
    covers: { a: { file: '/photos/a/x.jpg', width: 1, height: 1, alt: '' } as Photo },
    heroes: { a: { bywayId: 'a', file: '/photos/a/x.jpg', medium: '/photos/a/x-960.webp', width: 1600, height: 1000, alt: '' } as Photo },
    photoOrigin: 'https://photos.example',
  })
  expect(pages.map((p) => p.file)).toEqual([
    'index.html',
    'collections.html',
    'about.html',
    'privacy.html',
    'terms.html',
    'collections/coast.html',
    'state/ME.html',
    'byway/a.html',
  ])
  const xml = sitemap(pages)
  expect(xml).toContain('<loc>https://rambleroo.app/byway/a</loc>')
  expect(xml).toContain('<loc>https://rambleroo.app/state/ME</loc>')
  expect(xml).not.toContain('/privacy')
  expect(pages.find((p) => p.file === 'collections/coast.html')!.meta.image?.url).toBe('https://photos.example/a/x.jpg')
  const road = withMeta(index, pages.find((p) => p.file === 'byway/a.html')!.meta)
  expect(road).toContain(
    '<link rel="preload" as="image" fetchpriority="high" crossorigin="anonymous" href="https://photos.example/a/x-960.webp" imagesrcset="https://photos.example/a/x-960.webp 960w, https://photos.example/a/x.jpg 1600w" imagesizes="100vw" />',
  )
})
