import { onPhotoRemoved } from './userPhotos'
import { safeStorage } from './storage'
import type { Documents } from './account-data'
import type { PhotoStorage } from './userPhotos'
import { processPhoto } from './photo-process'
import { PHOTO_ID } from './photo-limits'
export function referencedPhotos(docs: Documents) {
  return new Set(
    [docs.garage.car.picture, ...Object.values(docs.postcards.cards).map((card) => card.userPhotoId)].filter(
      (id): id is string => !!id && PHOTO_ID.test(id),
    ),
  )
}
// Limit responses pause this account for the lifetime of this app, including sign-out/sign-in and manual retries.
const paused = new Map<string, string>()
export class PhotoSync {
  message = ''
  private abort = new AbortController()
  private running?: Promise<void>
  private off: () => void
  private deleted = new Set<string>()
  private user: string
  private storage: PhotoStorage
  private read: () => Documents
  private fetcher: typeof fetch
  private status: (message: string) => void
  private process: typeof processPhoto
  constructor(
    user: string,
    storage: PhotoStorage,
    read: () => Documents,
    fetcher: typeof fetch,
    status: (message: string) => void,
    process = processPhoto,
  ) {
    this.user = user
    this.storage = storage
    this.read = read
    this.fetcher = fetcher
    this.status = status
    this.process = process
    try {
      const saved = safeStorage.getItem(`rambleroo.photo-deletions.${user}`)
      this.deleted = new Set(JSON.parse(typeof saved === 'string' ? saved : '[]'))
    } catch {
      /* Keep an empty deletion queue if local storage is damaged. */
    }
    this.off = onPhotoRemoved((id) => {
      for (const photo of id ? [id] : referencedPhotos(this.read())) this.deleted.add(photo)
      this.saveDeletions()
    })
  }
  private saveDeletions() {
    safeStorage.setItem(`rambleroo.photo-deletions.${this.user}`, JSON.stringify([...this.deleted]))
  }
  stop() {
    this.abort.abort()
    this.off()
  }
  private async request(path: string, init: RequestInit = {}) {
    const response = await this.fetcher(path, {
      ...init,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: this.abort.signal,
      headers: { 'X-Rambleroo-User': this.user, ...init.headers },
    })
    if (response.status === 429 || response.status === 507) {
      const body = await response.json()
      this.message = body.resetsAt
        ? `Photo sync is paused until ${new Date(body.resetsAt).toLocaleDateString()} — your photos are safe on this device`
        : 'Photo sync is paused because storage is full — your photos are safe on this device'
      paused.set(this.user, this.message)
      throw new Error(this.message)
    }
    if (!response.ok) throw new Error('Photo sync is unavailable — your photos are safe on this device')
    return response
  }
  sync(): Promise<void> {
    if (this.running) return this.running
    this.running = this.run().finally(() => {
      this.running = undefined
    })
    return this.running
  }
  private async run() {
    if (this.abort.signal.aborted) return
    this.message = paused.get(this.user) ?? ''
    if (this.message) {
      this.status(this.message)
      return
    }
    try {
      for (const id of this.deleted) {
        await this.request(`/api/photos/${id}`, { method: 'DELETE' })
        this.deleted.delete(id)
        this.saveDeletions()
      }
      const remote = (await (await this.request('/api/photos')).json()) as { id: string }[]
      const known = new Set(remote.map((photo) => photo.id))
      // This runs only after account documents are loaded or successfully written; removals survive offline restarts in the document journal.
      for (const id of known) {
        if (!referencedPhotos(this.read()).has(id)) await this.request(`/api/photos/${id}`, { method: 'DELETE' })
      }
      for (const id of referencedPhotos(this.read())) {
        if (this.abort.signal.aborted) return
        const local = await this.storage.get(id)
        if (!local && known.has(id)) {
          const blob = await (await this.request(`/api/photos/${id}`)).blob()
          if (!this.abort.signal.aborted && referencedPhotos(this.read()).has(id)) await this.storage.put(id, blob)
        } else if (local && !known.has(id)) {
          const body = await this.process(local)
          if (!referencedPhotos(this.read()).has(id)) continue
          await this.request(`/api/photos/${id}`, { method: 'PUT', headers: { 'Content-Type': body.type }, body })
        }
      }
      this.message = ''
    } catch (error) {
      if (!this.abort.signal.aborted) {
        this.message = error instanceof Error ? error.message : 'Photo sync is unavailable — your photos are safe on this device'
        this.status(this.message)
      }
    }
  }
}
