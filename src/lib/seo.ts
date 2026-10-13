// Titles, descriptions and preview images for each public page. The build writes them into a static copy of index.html per page
// (scripts/build/pages.ts) so link previews and search engines see them without running the app, and the app sets the same title
// on the browser tab as you move around.
import type { BywaySummary, Collection, Photo, StateChapter } from './types.ts'
import { listingDescription, shortDesignation } from './format.ts'
import { states } from './states.ts'

export const SITE = 'https://rambleroo.app'
export const SITE_NAME = 'Rambleroo'
export const SITE_DESCRIPTION = 'Drive into the heart of the American story.'

export interface PageMeta {
  path: string
  title: string
  description: string
  image?: { url: string; width: number; height: number; alt: string }
  /** The page's hero photo, announced in the head so it starts downloading before the app has loaded. */
  preload?: { src: string; srcSet?: string; sizes?: string }
}

/** Tab and preview title: the page's own name first, the site name after. */
export const pageTitle = (name?: string) => (name ? `${name} · ${SITE_NAME}` : `${SITE_NAME} · Scenic roads of America`)

/** A photo's public URL: library paths (/photos/<road>/<file>) are served from the photo host. */
export const photoUrl = (photo: Photo, origin: string) =>
  origin ? `${origin}${photo.file.replace(/^\/photos/, '')}` : `${SITE}${photo.file}`

const image = (photo: Photo | undefined, origin: string): PageMeta['image'] =>
  photo && { url: photoUrl(photo, origin), width: photo.width, height: photo.height, alt: photo.alt }

export function roadMeta(b: BywaySummary, tagline: string | undefined, cover: Photo | undefined, origin: string): PageMeta {
  const sentence = tagline ? `${tagline.replace(/\.$/, '')}.` : listingDescription(b)
  return {
    path: `/byway/${b.id}`,
    title: pageTitle(b.name),
    description: `${sentence} ${shortDesignation(b)}, ${Math.round(b.mappedMiles)} miles mapped.`,
    image: image(cover, origin),
  }
}

export function stateMeta(code: string, chapter: StateChapter | undefined, cover: Photo | undefined, origin: string): PageMeta {
  return {
    path: `/state/${code}`,
    title: pageTitle(`${states[code] ?? code} scenic byways`),
    description: chapter?.tagline ?? `Scenic byways in ${states[code] ?? code}.`,
    image: image(cover, origin),
  }
}

export function collectionMeta(c: Collection, cover: Photo | undefined, origin: string): PageMeta {
  return { path: `/collections/${c.slug}`, title: pageTitle(c.title), description: c.intro, image: image(cover, origin) }
}

const fixedNames: Record<string, string> = {
  '/collections': 'Collections',
  '/about': 'About the data',
  '/privacy': 'Privacy',
  '/terms': 'Terms',
  '/trip': 'Trip',
  '/passport': 'Passport',
}
/** The browser-tab title for an address in the app, matching the titles the build writes into each page copy. */
export function titleFor(pathname: string, roadName: (id: string) => string | undefined, collections: Collection[]) {
  const road = pathname.match(/^\/byway\/([^/]+)(\/strip)?/)
  if (road) {
    const name = roadName(decodeURIComponent(road[1]))
    return pageTitle(name && (road[2] ? `${name} strip map` : name))
  }
  const state = pathname.match(/^\/state\/([A-Za-z]{2})$/)
  if (state) return pageTitle(states[state[1].toUpperCase()] && `${states[state[1].toUpperCase()]} scenic byways`)
  const collection = pathname.match(/^\/collections\/([^/]+)$/)
  if (collection) return pageTitle(collections.find((c) => c.slug === collection[1])?.title)
  return pageTitle(fixedNames[pathname])
}
