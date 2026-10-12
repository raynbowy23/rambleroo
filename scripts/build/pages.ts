// Writes the files that let link previews and search engines read Rambleroo without running the app, at the end of `vite build` (the rambleroo-pages plugin in vite.config.ts):
// a copy of index.html for each public page (dist/byway/<id>.html, dist/state/<code>.html, dist/collections/<slug>.html and a few
// fixed pages) with that page's title, description and preview photo in the head, plus sitemap.xml and robots.txt. Cloudflare serves
// /byway/<id> from byway/<id>.html as a plain static file, so this costs no Worker requests; the app then starts as usual.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { BywaySummary, BywayStory, Collection, Photo, StateChapter } from '../../src/lib/types.ts'
import {
  collectionMeta,
  pageTitle,
  photoUrl,
  roadMeta,
  SITE,
  SITE_DESCRIPTION,
  SITE_NAME,
  stateMeta,
  type PageMeta,
} from '../../src/lib/seo.ts'

const ROOT = new URL('../../', import.meta.url)
const read = async <T>(path: string) => JSON.parse(await readFile(new URL(path, ROOT), 'utf8')) as T
/** Big Sur's Bixby Creek Bridge stands for the whole site in previews of the home page and the fixed pages. */
const SITE_PHOTO_ROAD = 'route-1-big-sur-coast-highway-2301'

const firstPhoto = (covers: Record<string, Photo>, ids: string[]) => ids.map((id) => covers[id]).find(Boolean)
const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** index.html with this page's title, description, canonical link and Open Graph / Twitter preview tags. */
export function withMeta(html: string, meta: PageMeta) {
  const url = `${SITE}${meta.path === '/' ? '/' : meta.path}`
  const tags = [
    `<link rel="canonical" href="${escape(url)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${escape(url)}" />`,
    `<meta property="og:title" content="${escape(meta.title)}" />`,
    `<meta property="og:description" content="${escape(meta.description)}" />`,
    ...(meta.image
      ? [
          `<meta property="og:image" content="${escape(meta.image.url)}" />`,
          `<meta property="og:image:width" content="${meta.image.width}" />`,
          `<meta property="og:image:height" content="${meta.image.height}" />`,
          `<meta property="og:image:alt" content="${escape(meta.image.alt)}" />`,
          `<meta name="twitter:card" content="summary_large_image" />`,
        ]
      : [`<meta name="twitter:card" content="summary" />`]),
  ]
  const title = /<title>[^<]*<\/title>/
  const description = /<meta name="description" content="[^"]*" \/>/
  if (!title.test(html) || !description.test(html)) throw new Error('index.html is missing its <title> or description meta')
  return html
    .replace(title, `<title>${escape(meta.title)}</title>`)
    .replace(description, `<meta name="description" content="${escape(meta.description)}" />\n    ${tags.join('\n    ')}`)
}

export interface SiteData {
  byways: BywaySummary[]
  taglines: Record<string, string>
  chapters: StateChapter[]
  collections: Collection[]
  covers: Record<string, Photo>
  photoOrigin: string
}

/** Every public page's meta, in sitemap order. Personal pages (trip, passport, shares) and the legal pages stay out. */
export function publicPages(data: SiteData): { file: string; meta: PageMeta; listed: boolean }[] {
  const { byways, taglines, chapters, collections, covers, photoOrigin } = data
  const sitePhoto = covers[SITE_PHOTO_ROAD]
  const image = sitePhoto && { url: photoUrl(sitePhoto, photoOrigin), width: sitePhoto.width, height: sitePhoto.height, alt: sitePhoto.alt }
  const fixed = (path: string, name: string | undefined, description: string, listed = true) => ({
    file: path === '/' ? 'index.html' : `${path.slice(1)}.html`,
    meta: { path, title: pageTitle(name), description, image },
    listed,
  })
  return [
    fixed(
      '/',
      undefined,
      `${SITE_DESCRIPTION} A map of ${byways.length.toLocaleString('en-US')} scenic byways across the United States, with their stories, strip maps and postcards.`,
    ),
    fixed('/collections', 'Collections', 'Scenic byways gathered by what they show you: water, mountains, history and more.'),
    fixed('/about', 'About the data', 'Where Rambleroo’s road lines, stories and photographs come from, and how they are checked.'),
    fixed('/privacy', 'Privacy', 'What Rambleroo stores, where, and how to remove it.', false),
    fixed('/terms', 'Terms', 'The terms for using Rambleroo.', false),
    ...collections.map((c) => ({
      file: `collections/${c.slug}.html`,
      meta: collectionMeta(c, firstPhoto(covers, c.bywayIds), photoOrigin),
      listed: true,
    })),
    ...chapters.map((chapter) => {
      const members = chapter.programs.flatMap((p) => p.members.flatMap((m) => (m.bywayId ? [m.bywayId] : [])))
      const roads = byways.filter((b) => b.states.includes(chapter.code)).map((b) => b.id)
      return {
        file: `state/${chapter.code}.html`,
        meta: stateMeta(chapter.code, chapter, firstPhoto(covers, [...members, ...roads]), photoOrigin),
        listed: true,
      }
    }),
    ...byways.map((b) => ({ file: `byway/${b.id}.html`, meta: roadMeta(b, taglines[b.id], covers[b.id], photoOrigin), listed: true })),
  ]
}

export function sitemap(pages: { meta: PageMeta; listed: boolean }[]) {
  const urls = pages.filter((p) => p.listed).map((p) => `  <url><loc>${escape(`${SITE}${p.meta.path}`)}</loc></url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

export const robots = `User-agent: *
Disallow: /api/
Disallow: /s/
Disallow: /trip
Disallow: /passport
Disallow: /dev/
Disallow: /byway/*/strip/print

Sitemap: ${SITE}/sitemap.xml
`

export async function loadSiteData(photoOrigin: string): Promise<SiteData> {
  const catalog = await read<{ byways: BywaySummary[] }>('public/data/catalog.json')
  const taglines: Record<string, string> = {}
  for (const file of await readdir(new URL('content/stories/', ROOT)))
    if (file.endsWith('.json')) {
      const story = await read<BywayStory>(`content/stories/${file}`)
      if (story.tagline) taglines[story.id] = story.tagline
    }
  const chapters: StateChapter[] = []
  for (const file of (await readdir(new URL('content/states/', ROOT))).filter((f) => f.endsWith('.json')).sort())
    chapters.push(await read<StateChapter>(`content/states/${file}`))
  return {
    byways: catalog.byways,
    taglines,
    chapters,
    collections: await read<Collection[]>('content/collections.json'),
    covers: await read<Record<string, Photo>>('public/data/photos/covers.json'),
    photoOrigin,
  }
}

/** Writes the page copies, sitemap.xml and robots.txt into the build output directory. */
export async function writePages(outDir: string, photoOrigin: string) {
  const index = await readFile(join(outDir, 'index.html'), 'utf8')
  const pages = publicPages(await loadSiteData(photoOrigin))
  for (const { file, meta } of pages) {
    const path = join(outDir, file)
    if (!existsSync(dirname(path))) await mkdir(dirname(path), { recursive: true })
    await writeFile(path, withMeta(index, meta))
  }
  await writeFile(join(outDir, 'sitemap.xml'), sitemap(pages))
  await writeFile(join(outDir, 'robots.txt'), robots)
  return pages.length
}
