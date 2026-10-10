import { afterEach, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { photoFiles } from '../../scripts/photos/split'
import type { Photo } from './types'

const photo = (bywayId: string, file: string, town?: string) => ({ bywayId, file, town }) as Photo

it('splits the registry into covers without town photos and one file per road', () => {
  const files = photoFiles(
    [photo('a', '/1.jpg', 'Medart'), photo('a', '/2.jpg'), photo('a', '/3.jpg'), photo('b', '/4.jpg')],
    ['a', 'b', 'c'],
  )
  expect(JSON.parse(files['covers.json'])).toEqual({ a: photo('a', '/2.jpg'), b: photo('b', '/4.jpg') })
  expect(JSON.parse(files['a.json']).map((p: Photo) => p.file)).toEqual(['/1.jpg', '/2.jpg', '/3.jpg'])
  expect(JSON.parse(files['c.json'])).toEqual([])
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

it('fetches a road’s photos once and starts later pages from the loaded list', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify([photo('road-1', '/x.jpg')])))
  vi.stubGlobal('fetch', fetch)
  const { usePhotos, loadPhotos } = await import('./data')
  const first = renderHook(() => usePhotos('road-1'))
  expect(first.result.current).toEqual([])
  await waitFor(() => expect(first.result.current).toHaveLength(1))
  await loadPhotos('road-1')
  const later = renderHook(() => usePhotos('road-1'))
  expect(later.result.current).toHaveLength(1)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith('/data/photos/road-1.json')
})

it('treats a missing cover file as no covers rather than an error', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('', { status: 404 })),
  )
  const { loadFirstPhoto } = await import('./data')
  expect(await loadFirstPhoto(['road-1'])).toBeUndefined()
})
