import { useEffect, useState } from 'react'
import type { BywaySummary, BywayStory, Collection, Photo, StateChapter } from './types'
import collectionData from '../../content/collections.json'
export const collections: Collection[] = collectionData as Collection[]
const chapterModules = import.meta.glob<StateChapter>('../../content/states/*.json', { eager: true, import: 'default' })
export const stateChapters: Record<string, StateChapter> = Object.fromEntries(
  Object.values(chapterModules).map((chapter) => [chapter.code, chapter]),
)
export interface CatalogMeta {
  builtAt: string
  retrievedAt: string
  source: { name: string; url: string; sha256: string; featureCount: number }
  bywayCount: number
  storyCount: number
}
export interface Catalog {
  byways: BywaySummary[]
  meta: CatalogMeta
}
let catalogPromise: Promise<Catalog> | undefined
export function loadCatalog() {
  return (catalogPromise ??= fetch('/data/catalog.json').then((r) => {
    if (!r.ok) throw new Error('The catalog could not be loaded. Please refresh to try again.')
    return r.json() as Promise<Catalog>
  }))
}
const emptyMap = new Map<string, BywaySummary>()
export function useCatalog() {
  const [value, setValue] = useState<{
    status: 'loading' | 'ready' | 'error'
    byways: BywaySummary[]
    byId: Map<string, BywaySummary>
    meta: CatalogMeta | null
    error: Error | null
  }>({ status: 'loading', byways: [], byId: emptyMap, meta: null, error: null })
  useEffect(() => {
    let active = true
    loadCatalog()
      .then((c) => {
        if (active) setValue({ ...c, status: 'ready', byId: new Map(c.byways.map((b) => [b.id, b])), error: null })
      })
      .catch((error: Error) => {
        if (active) setValue((v) => ({ ...v, status: 'error', error }))
      })
    return () => {
      active = false
    }
  }, [])
  return value
}
export function useByway(id?: string) {
  const c = useCatalog()
  return { ...c, byway: id ? c.byId.get(id) : undefined }
}
const storyModules = import.meta.glob<BywayStory>('/content/stories/*.json', { import: 'default' })
const storyCache = new Map<string, Promise<BywayStory | undefined>>()
export function loadStory(id: string) {
  if (!storyCache.has(id)) {
    const loader = storyModules[`/content/stories/${id}.json`]
    storyCache.set(id, loader ? loader() : Promise.resolve(undefined))
  }
  return storyCache.get(id)!
}
export function useStory(id?: string) {
  const [value, setValue] = useState<{ id?: string; story?: BywayStory; error?: Error; status: 'loading' | 'ready' | 'error' }>({
    status: 'loading',
  })
  useEffect(() => {
    let active = true
    if (!id) return
    loadStory(id)
      .then((story) => {
        if (active) setValue({ id, story, status: 'ready' })
      })
      .catch((error: Error) => {
        if (active) setValue({ id, error, status: 'error' })
      })
    return () => {
      active = false
    }
  }, [id])
  return value.id === id ? value : { story: undefined, error: undefined, status: 'loading' as const }
}

// Photos are fetched, not bundled: covers.json (one cover per road) for cards and list pages, and one file per road with all of its
// photos for that road's page, postcards and strip map. scripts/photos/split.ts writes both from content/photos.json.
// Loaded values are kept so a page mounted later starts with its photo instead of flashing the illustration first.
let coversPromise: Promise<Record<string, Photo>> | undefined
let coversLoaded: Record<string, Photo> | undefined
export function loadCovers() {
  return (coversPromise ??= fetch('/data/photos/covers.json')
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, Photo>>) : {}))
    .then((c) => (coversLoaded = c))
    .catch(() => {
      coversPromise = undefined
      return {}
    }))
}
/** Cover photos by road id; undefined until loaded, so callers can keep their illustration until then. */
export function useCovers() {
  const [covers, setCovers] = useState(coversLoaded)
  useEffect(() => {
    let active = true
    void loadCovers().then((c) => {
      if (active) setCovers(c)
    })
    return () => {
      active = false
    }
  }, [])
  return covers
}
/** The first of these roads that has a cover photo. */
export const firstPhoto = (covers: Record<string, Photo> | undefined, bywayIds: string[]) =>
  covers && bywayIds.map((id) => covers[id]).find(Boolean)
export async function loadFirstPhoto(bywayIds: string[]) {
  return firstPhoto(await loadCovers(), bywayIds)
}

const roadPhotos = new Map<string, Promise<Photo[]>>()
const roadPhotosLoaded = new Map<string, Photo[]>()
export function loadPhotos(bywayId: string) {
  if (!roadPhotos.has(bywayId))
    roadPhotos.set(
      bywayId,
      fetch(`/data/photos/${encodeURIComponent(bywayId)}.json`)
        .then((r) => (r.ok ? (r.json() as Promise<Photo[]>) : []))
        .then((photos) => {
          roadPhotosLoaded.set(bywayId, photos)
          return photos
        })
        .catch(() => {
          roadPhotos.delete(bywayId)
          return []
        }),
    )
  return roadPhotos.get(bywayId)!
}
const none: Photo[] = []
/** All of one road's photos, empty while they load. */
export function usePhotos(bywayId?: string): Photo[] {
  const [value, setValue] = useState<{ id?: string; photos: Photo[] }>({ photos: none })
  useEffect(() => {
    let active = true
    if (!bywayId) return
    void loadPhotos(bywayId).then((photos) => {
      if (active) setValue({ id: bywayId, photos })
    })
    return () => {
      active = false
    }
  }, [bywayId])
  return value.id === bywayId ? value.photos : ((bywayId ? roadPhotosLoaded.get(bywayId) : undefined) ?? none)
}
