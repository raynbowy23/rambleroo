/** Blobs are deliberately separate from JSON passport backups. */
export interface PhotoStorage {
  get(id: string): Promise<Blob | undefined>
  put(id: string, blob: Blob): Promise<void>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}
export function createUserPhotos(storage: PhotoStorage) {
  return {
    ...storage,
    add: async (blob: Blob) => {
      const id = crypto.randomUUID()
      await storage.put(id, blob)
      return id
    },
  }
}
function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open('rambleroo.userPhotos.v1', 1)
    opening.onupgradeneeded = () => opening.result.createObjectStore('photos')
    opening.onerror = () => reject(opening.error)
    opening.onblocked = () => reject(new Error('Photo storage is blocked. Close other Rambleroo tabs and try again.'))
    opening.onsuccess = () => {
      const db = opening.result
      const tx = db.transaction('photos', mode)
      const request = run(tx.objectStore('photos'))
      tx.oncomplete = () => {
        db.close()
        resolve(request.result)
      }
      tx.onerror = tx.onabort = () => {
        db.close()
        reject(tx.error ?? request.error ?? new Error('Photo storage unavailable'))
      }
    }
  })
}
// Stored as raw bytes plus MIME type, not as a Blob: Safari (notably private browsing) rejects Blobs in IndexedDB with
// "Error preparing Blob/File data to be stored in object store", while ArrayBuffers work in every browser.
interface StoredPhoto {
  type: string
  bytes: ArrayBuffer
}
export const userPhotos = createUserPhotos({
  get: async (id) => {
    const stored = await transaction<StoredPhoto | Blob | undefined>('readonly', (store) => store.get(id))
    if (!stored) return undefined
    // Photos saved before this change were stored as Blobs; keep reading them.
    return stored instanceof Blob ? stored : new Blob([stored.bytes], { type: stored.type })
  },
  put: async (id, blob) => {
    const record: StoredPhoto = { type: blob.type || 'image/jpeg', bytes: await blob.arrayBuffer() }
    await transaction('readwrite', (store) => store.put(record, id))
  },
  remove: async (id) => {
    await transaction('readwrite', (store) => store.delete(id))
  },
  clear: async () => {
    await transaction('readwrite', (store) => store.clear())
  },
})
export async function prepareUserPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
  if (file.size > 12 * 1024 * 1024) throw new Error('Choose an image no larger than 12 MB.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Photo processing unavailable.')
    context.fillStyle = '#f5f6ee'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not process this photo.'))), 'image/jpeg', 0.88),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}
