import { dataKinds, isRecord, mergeDocument, parseDocument, type DataKind, type DocumentMap, type Documents } from './account-data'

export interface SyncPorts {
  read(): Documents
  apply<K extends DataKind>(kind: K, document: Documents[K]): void
  save(journal: Journal): void
  status(message: string): void
  fetch: typeof fetch
}
export interface Journal {
  documents: Documents
  base: DocumentMap
  dirty: DataKind[]
}
export const emptyMap = (): DocumentMap => ({ passport: null, trip: null, garage: null, postcards: null })
export function parseMap(value: unknown): DocumentMap {
  if (!isRecord(value)) throw new Error('Invalid account response')
  return Object.fromEntries(
    dataKinds.map((kind) => {
      const entry = value[kind]
      if (entry === null) return [kind, null]
      if (!isRecord(entry) || !Number.isSafeInteger(entry.updatedAt) || Number(entry.updatedAt) < 0)
        throw new Error('Invalid account version')
      return [kind, { json: parseDocument(kind, entry.json), updatedAt: Number(entry.updatedAt) }]
    }),
  ) as DocumentMap
}
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
export class AccountSync {
  private base: DocumentMap = emptyMap()
  private dirty = new Set<DataKind>()
  private active = true
  private applying = false
  private ready = false
  private running: Promise<void> | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private abort = new AbortController()
  private observed: Documents
  private userId: string
  private ports: SyncPorts
  private defaults: Documents
  constructor(userId: string, ports: SyncPorts, defaults: Documents) {
    this.userId = userId
    this.ports = ports
    this.defaults = defaults
    this.observed = ports.read()
  }
  private request(path: string, init: RequestInit = {}) {
    return this.ports.fetch(path, {
      ...init,
      credentials: 'same-origin',
      signal: this.abort.signal,
      headers: { 'Content-Type': 'application/json', 'X-Rambleroo-User': this.userId, ...init.headers },
    })
  }
  private persist() {
    this.ports.save({ documents: this.ports.read(), base: this.base, dirty: [...this.dirty] })
  }
  async load(chooseImport: () => Promise<boolean>, pending?: Journal) {
    this.observed = this.ports.read()
    this.ports.status('Loading your account…')
    const response = await this.request('/api/data')
    if (!response.ok) throw new Error('Could not load your account. Your browser data is still here.')
    const server = parseMap(await response.json())
    const bring = await chooseImport()
    if (!this.active) return
    const local = this.ports.read()
    this.applying = true
    try {
      for (const kind of dataKinds) {
        const remote = server[kind]?.json
        let next = remote ?? this.defaults[kind]
        if (pending?.dirty.includes(kind)) {
          const unchanged = pending.base[kind]?.updatedAt === server[kind]?.updatedAt
          next = !remote || unchanged ? pending.documents[kind] : mergeDocument(kind, pending.documents[kind], remote)
          this.dirty.add(kind)
        } else if (bring) {
          next = remote ? mergeDocument(kind, local[kind], remote) : local[kind]
          if (!equal(next, remote)) this.dirty.add(kind)
        }
        if (!equal(local[kind], this.observed[kind])) {
          next = remote ? mergeDocument(kind, local[kind], remote) : local[kind]
          this.dirty.add(kind)
        }
        this.ports.apply(kind, next)
      }
      this.base = server
      this.observed = this.ports.read()
      this.ready = true
      this.persist()
    } finally {
      this.applying = false
    }
    this.ports.status(this.dirty.size ? 'Waiting to sync…' : 'Synced to your account')
    this.schedule()
  }
  changed() {
    if (!this.active || this.applying || !this.ready) return
    const current = this.ports.read()
    for (const kind of dataKinds) if (!equal(current[kind], this.observed[kind])) this.dirty.add(kind)
    this.observed = current
    this.persist()
    if (this.dirty.size) this.ports.status('Waiting to sync…')
    this.schedule()
  }
  private schedule() {
    clearTimeout(this.timer)
    if (this.dirty.size && this.active && this.ready)
      this.timer = setTimeout(() => {
        void this.flush()
      }, 1500)
  }
  hasPendingChanges() {
    return this.dirty.size > 0
  }
  flush(): Promise<void> {
    if (this.running) return this.running
    if (!this.active || !this.ready || !this.dirty.size) return Promise.resolve()
    this.running = this.write().finally(() => {
      this.running = null
    })
    return this.running
  }
  private async write() {
    clearTimeout(this.timer)
    this.ports.status('Syncing…')
    try {
      for (const kind of [...this.dirty]) {
        let document = this.ports.read()[kind]
        for (let attempt = 0; attempt < 2; attempt++) {
          const response = await this.request(`/api/data/${kind}`, {
            method: 'PUT',
            body: JSON.stringify({ json: document, baseUpdatedAt: this.base[kind]?.updatedAt ?? null }),
          })
          if (!this.active) return
          if (response.status === 409) {
            const conflict = await response.json()
            if (!this.active) return
            const server = parseMap({ ...emptyMap(), [kind]: conflict.server })[kind]
            // Advance the base only alongside the merged pending document so a later retry cannot discard a conflict.
            const latest = this.ports.read()[kind]
            document = server ? mergeDocument(kind, latest, server.json) : latest
            this.applying = true
            try {
              this.ports.apply(kind, document)
            } finally {
              this.applying = false
            }
            Object.assign(this.base, { [kind]: server })
            this.observed = this.ports.read()
            this.persist()
            if (attempt === 1) throw new Error('Another device is still making changes. Retry sync when it has finished.')
            continue
          }
          if (!response.ok)
            throw new Error(
              response.status === 401
                ? 'Your session ended. Sign in again to sync.'
                : 'Could not sync. Changes are saved in this browser; retry when connected.',
            )
          const accepted = parseMap({ ...emptyMap(), [kind]: await response.json() })[kind]
          if (!this.active) return
          Object.assign(this.base, { [kind]: accepted })
          if (equal(this.ports.read()[kind], document)) this.dirty.delete(kind)
          this.persist()
          break
        }
      }
      this.ports.status(this.dirty.size ? 'Waiting to sync…' : 'Synced to your account')
      this.schedule()
    } catch (error) {
      if (this.active) this.ports.status(error instanceof Error ? error.message : 'Could not sync. Please retry.')
    }
  }
  stop() {
    this.active = false
    clearTimeout(this.timer)
    this.abort.abort()
  }
}
