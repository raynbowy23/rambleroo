import { expect, it } from 'vitest'
import { createUserPhotos, prepareUserPhoto, type PhotoStorage } from './userPhotos'
function memoryStorage(): PhotoStorage {
  const blobs = new Map<string, Blob>()
  return {
    get: async (id) => blobs.get(id),
    put: async (id, blob) => {
      blobs.set(id, blob)
    },
    remove: async (id) => {
      blobs.delete(id)
    },
    clear: async () => {
      blobs.clear()
    },
  }
}
it('stores, retrieves and deletes blobs through the same asynchronous storage contract', async () => {
  const photos = createUserPhotos(memoryStorage())
  const first = new Blob(['jpeg'], { type: 'image/jpeg' })
  const id = await photos.add(first)
  expect(await photos.get(id)).toBe(first)
  await photos.remove(id)
  expect(await photos.get(id)).toBeUndefined()
  const second = await photos.add(first)
  await photos.clear()
  expect(await photos.get(second)).toBeUndefined()
})
it('propagates storage failures without claiming a photo was saved', async () => {
  const photos = createUserPhotos({
    ...memoryStorage(),
    put: async () => {
      throw new Error('Quota exceeded')
    },
  })
  await expect(photos.add(new Blob())).rejects.toThrow('Quota exceeded')
})
it('rejects non-images and files over 12 MB before decoding', async () => {
  await expect(prepareUserPhoto(new File(['text'], 'text.txt', { type: 'text/plain' }))).rejects.toThrow('Choose an image')
  await expect(prepareUserPhoto(new File([new Uint8Array(12 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))).rejects.toThrow(
    '12 MB',
  )
})
