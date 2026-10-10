import { useEffect, useState } from 'react'
import { loadPhotos } from '../../lib/data'
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
async function withTownPhotos(data: StripData): Promise<StripData> {
  const photos = (await loadPhotos(data.bywayId)).filter((photo) => photo.town)
  return { ...data, towns: data.towns.map((town) => ({ ...town, photo: town.photo ?? photos.find((photo) => photo.town === town.name) })) }
}
const cache = new Map<string, Promise<StripData | undefined>>()
/** `part` selects one section of a multi-part road (Route 66: il, ok, nm, az); without it the default part loads. */
export function loadStrip(id: string, part?: string) {
  const key = part ? `${id}.${part}` : id
  if (!cache.has(key)) {
    cache.set(
      key,
      loadStripIndex().then(async (ids) => {
        if (!ids.includes(id)) return undefined
        const response = await fetch(`/data/strips/${encodeURIComponent(key)}.json`)
        if (!response.ok) throw new Error('This strip map could not be loaded. Please refresh to try again.')
        return withTownPhotos((await response.json()) as StripData)
      }),
    )
  }
  return cache.get(key)!
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
export function useStrip(id: string, part?: string) {
  const key = part ? `${id}.${part}` : id
  const [value, setValue] = useState<{ id: string; data?: StripData; error?: string }>()
  useEffect(() => {
    let active = true
    void loadStrip(id, part)
      .then((data) => {
        if (active) setValue({ id: key, data })
      })
      .catch((error: Error) => {
        if (active) setValue({ id: key, error: error.message })
      })
    return () => {
      active = false
    }
  }, [id, part, key])
  return { loading: value?.id !== key, ...(value?.id === key ? value : {}) }
}
