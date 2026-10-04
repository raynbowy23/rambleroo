import { createAuthClient } from 'better-auth/react'
import { magicLinkClient } from 'better-auth/client/plugins'
import { create } from 'zustand'
import { AccountSync, parseMap, type Journal } from './account-sync'
import { applyDocuments, applyDocument, emptyDocuments, hasLocalData, readDocuments, subscribeDocuments } from './account-stores'
import { dataKinds, parseDocument, type Documents } from './account-data'
import { useGarage } from './garage'
import { usePostcards } from './postcards'

/** Shown on the passport when signed out: where things are saved, and how to keep them everywhere. */
export const SIGNED_OUT_STATUS = 'Saved in this browser. Sign in to keep it on every device.'
/** Toast after saving a road: true to where it went. */
export const savedMessage = () => (useAccount.getState().user ? 'Saved to your passport' : 'Saved in this browser')
export const accountClient = createAuthClient({ basePath: '/api/auth', plugins: [magicLinkClient()] })
export interface AccountUser {
  id: string
  name: string
  email: string
  image?: string | null
}
export const useAccount = create<{
  user: AccountUser | null
  status: string
  importing: boolean
}>()(() => ({ user: null, status: SIGNED_OUT_STATUS, importing: false }))
const memory = new Map<string, string>()
const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key) ?? memory.get(key) ?? null
    } catch {
      return memory.get(key) ?? null
    }
  },
  set(key: string, value: unknown) {
    const text = JSON.stringify(value)
    memory.set(key, text)
    try {
      localStorage.setItem(key, text)
    } catch {
      /* Memory stays usable when storage is unavailable. */
    }
  },
  remove(key: string) {
    memory.delete(key)
    try {
      localStorage.removeItem(key)
    } catch {
      /* Storage is optional. */
    }
  },
}
const prefix = 'rambleroo.account.'
let engine: AccountSync | undefined
let unsubscribe: (() => void) | undefined
let generation = 0
let resolveImport: ((bring: boolean) => void) | undefined
let loading: Promise<void> | undefined
const journalKey = (id: string) => `${prefix}pending.${id}`
function readJournal(id: string): Journal | undefined {
  try {
    const raw = JSON.parse(storage.get(journalKey(id)) ?? 'null')
    if (!raw || !Array.isArray(raw.dirty)) return
    const documents = Object.fromEntries(dataKinds.map((kind) => [kind, parseDocument(kind, raw.documents[kind])])) as unknown as Documents
    return {
      documents,
      base: parseMap(raw.base),
      dirty: raw.dirty.filter((kind: unknown) => dataKinds.includes(kind as (typeof dataKinds)[number])),
    }
  } catch {
    return
  }
}
interface LocalMedia {
  picture?: string
  usePicture: boolean
  photos: Record<string, string | undefined>
}
function readLocalMedia(): LocalMedia {
  return {
    picture: useGarage.getState().picture,
    usePicture: useGarage.getState().usePicture,
    photos: Object.fromEntries(Object.entries(usePostcards.getState().cards).map(([key, card]) => [key, card.userPhotoId])),
  }
}
function backupGuest() {
  storage.set(`${prefix}guest`, {
    documents: readDocuments(),
    cards: usePostcards.getState().cards,
    picture: useGarage.getState().picture,
    usePicture: useGarage.getState().usePicture,
  })
}
function restoreGuest() {
  const saved = storage.get(`${prefix}guest`)
  if (!saved) return
  try {
    const snapshot = JSON.parse(saved)
    const docs = Object.fromEntries(dataKinds.map((kind) => [kind, parseDocument(kind, snapshot.documents[kind])])) as unknown as Documents
    applyDocuments(docs)
    usePostcards.setState({ cards: snapshot.cards })
    useGarage.setState({ picture: snapshot.picture, usePicture: snapshot.usePicture })
  } catch {
    /* Keep the current browser data if its backup cannot be read. */
  }
}
export function answerImport(bring: boolean) {
  resolveImport?.(bring)
  resolveImport = undefined
  useAccount.setState({ importing: false })
}
function stopSync() {
  generation++
  engine?.stop()
  engine = undefined
  unsubscribe?.()
  unsubscribe = undefined
  answerImport(false)
  loading = undefined
}
export async function connectAccount(user: AccountUser | null) {
  if (user?.id === useAccount.getState().user?.id && engine) {
    useAccount.setState({ user })
    return
  }
  stopSync()
  let owner: string | null = null
  try {
    owner = JSON.parse(storage.get(`${prefix}owner`) ?? 'null') as string | null
  } catch {
    storage.remove(`${prefix}owner`)
  }
  if (!user) {
    if (owner) restoreGuest()
    storage.remove(`${prefix}owner`)
    useAccount.setState({ user: null, status: SIGNED_OUT_STATUS })
    return
  }
  useAccount.setState({ user })
  if (owner && owner !== user.id) restoreGuest()
  if (!owner || owner !== user.id) backupGuest()
  storage.set(`${prefix}owner`, user.id)
  const token = generation
  const local = readDocuments()
  const pending = readJournal(user.id)
  const choiceKey = `${prefix}imported.${user.id}`
  const mediaKey = `${prefix}media.${user.id}`
  let media: LocalMedia = readLocalMedia()
  try {
    media = JSON.parse(storage.get(mediaKey) ?? 'null') ?? media
  } catch {
    /* Keep this browser's current photo references. */
  }
  const sync = new AccountSync(
    user.id,
    {
      read: readDocuments,
      apply: (kind, document) => {
        applyDocument(kind, document)
        if (kind === 'garage') useGarage.setState({ picture: media.picture, usePicture: media.usePicture })
        if (kind === 'postcards') {
          const cards = Object.fromEntries(
            Object.entries(usePostcards.getState().cards).map(([key, card]) => [key, { ...card, userPhotoId: media.photos[key] }]),
          )
          usePostcards.setState({ cards })
        }
      },
      fetch: (...args) => fetch(...args),
      save: (journal) => {
        storage.set(journalKey(user.id), journal)
        media = readLocalMedia()
        storage.set(mediaKey, media)
      },
      status: (status) => {
        if (token === generation) useAccount.setState({ status })
      },
    },
    emptyDocuments(),
  )
  engine = sync
  unsubscribe = subscribeDocuments(() => {
    try {
      sync.changed()
    } catch (error) {
      useAccount.setState({ status: error instanceof Error ? error.message : 'Could not sync this document.' })
    }
  })
  loading = sync
    .load(async () => {
      if (token !== generation || storage.get(choiceKey) || !hasLocalData(local)) return false
      useAccount.setState({ importing: true })
      return new Promise<boolean>((resolve) => {
        resolveImport = resolve
      })
    }, pending)
    .then(() => {
      if (token === generation) storage.set(choiceKey, true)
    })
    .catch((error: unknown) => {
      if (token === generation) {
        sync.stop()
        unsubscribe?.()
        unsubscribe = undefined
        engine = undefined
        useAccount.setState({ status: error instanceof Error ? error.message : 'Could not load your account.' })
      }
    })
  await loading
}
export async function retrySync() {
  if (loading) await loading
  if (engine) await engine.flush()
  else await connectAccount(useAccount.getState().user)
}
export async function signOutAccount() {
  if (engine) await engine.flush()
  const result = await accountClient.signOut()
  if (result.error) throw new Error(result.error.message ?? 'Could not sign out.')
  await connectAccount(null)
}
export async function deleteAccount() {
  const user = useAccount.getState().user
  if (!user) return
  stopSync()
  const response = await fetch('/api/account', { method: 'DELETE', headers: { 'X-Rambleroo-User': user.id } })
  if (!response.ok) {
    void connectAccount(user)
    throw new Error('Could not delete your account. Please retry.')
  }
  storage.remove(journalKey(user.id))
  storage.remove(`${prefix}imported.${user.id}`)
  await connectAccount(null)
  await accountClient.getSession({ fetchOptions: { cache: 'no-store' } })
}
export async function exportAccount() {
  await retrySync()
  if (!engine || engine.hasPendingChanges()) throw new Error('Some changes have not synced yet. Retry sync before exporting.')
  const response = await fetch('/api/export', { headers: { 'X-Rambleroo-User': useAccount.getState().user?.id ?? '' } })
  if (!response.ok) throw new Error('Could not export your account. Please retry.')
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = 'rambleroo-account.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
