import { useEffect, useState } from 'react'
import photoData from '../../../content/photos.json'
import type { Photo } from '../../lib/types'
import type { StripData } from './types'

let indexPromise: Promise<string[]> | undefined
export function loadStripIndex() {
  return (indexPromise ??= fetch('/data/strips/index.json').then(async (response) => {
    if (!response.ok) throw new Error('Strip index unavailable')
    const ids: unknown = await response.json()
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) throw new Error('Invalid strip index')
    return ids as string[]
  }))
}
/** Town photos live in the photo registry (content/photos.json, `town` field), so reviewed additions show up without rebuilding strips. */
function withTownPhotos(data: StripData): StripData {
  const photos = (photoData as Photo[]).filter((photo) => photo.bywayId === data.bywayId && photo.town)
  return { ...data, towns: data.towns.map((town) => ({ ...town, photo: town.photo ?? photos.find((photo) => photo.town === town.name) })) }
}
const cache = new Map<string, Promise<StripData | undefined>>()
export function loadStrip(id: string) {
  if (!cache.has(id)) {
    cache.set(
      id,
      loadStripIndex().then(async (ids) => {
        if (!ids.includes(id)) return undefined
        const response = await fetch(`/data/strips/${encodeURIComponent(id)}.json`)
        if (!response.ok) throw new Error('This strip map could not be loaded. Please refresh to try again.')
        return withTownPhotos((await response.json()) as StripData)
      }),
    )
  }
  return cache.get(id)!
}
export function useHasStrip(id?: string) {
  const [ids, setIds] = useState<string[]>([])
  useEffect(() => {
    let active = true
    void loadStripIndex()
      .then((value) => {
        if (active) setIds(value)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  return !!id && ids.includes(id)
}
export function useStrip(id: string) {
  const [value, setValue] = useState<{ id: string; data?: StripData; error?: string }>()
  useEffect(() => {
    let active = true
    void loadStrip(id)
      .then((data) => {
        if (active) setValue({ id, data })
      })
      .catch((error: Error) => {
        if (active) setValue({ id, error: error.message })
      })
    return () => {
      active = false
    }
  }, [id])
  return { loading: value?.id !== id, ...(value?.id === id ? value : {}) }
}
