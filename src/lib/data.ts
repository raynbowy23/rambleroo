import photoData from '../../content/photos.json'
import { useEffect, useState } from 'react'
import type { BywaySummary, BywayStory, Collection, Photo } from './types'
import collectionData from '../../content/collections.json'
import wisconsin from '../../content/states/WI.json'
export const collections: Collection[] = collectionData as Collection[]
export const stateChapters: Record<string, typeof wisconsin> = { WI: wisconsin }
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

export function firstPhoto(bywayIds: string[]): Photo | undefined {
  for (const id of bywayIds) {
    const photo = (photoData as Photo[]).find((photo) => photo.bywayId === id)
    if (photo) return photo
  }
}
export function usePhotos(bywayId?: string): Photo[] {
  return (photoData as Photo[]).filter((photo) => photo.bywayId === bywayId)
}
