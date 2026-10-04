import { isRecord, parseDocument } from './account-data'

export type ShareKind = 'trip' | 'passport'
export interface ShareSnapshot {
  kind: ShareKind
  title?: string
  roads: string[]
  saved?: string[]
  visits?: { bywayId: string; date: string; note?: string }[]
}
export interface ShareSummary {
  slug: string
  kind: ShareKind
  title: string | null
  created: number
  revoked: number | null
}
export function parseShareRequest(value: unknown) {
  if (!isRecord(value) || (value.kind !== 'trip' && value.kind !== 'passport')) throw new Error('Choose a trip or passport')
  if (value.title !== undefined && (typeof value.title !== 'string' || value.title.length > 200))
    throw new Error('Title must be at most 200 characters')
  if (value.includeNotes !== undefined && typeof value.includeNotes !== 'boolean') throw new Error('Invalid notes choice')
  return {
    kind: value.kind as ShareKind,
    title: (value.title as string | undefined)?.trim() || undefined,
    includeNotes: value.includeNotes === true,
  }
}
export function buildSnapshot(input: ReturnType<typeof parseShareRequest>, document: unknown): ShareSnapshot {
  const { kind, title, includeNotes } = input
  const snapshot: ShareSnapshot = { kind, ...(title ? { title } : {}), roads: [] }
  if (kind === 'trip') {
    snapshot.roads = parseDocument('trip', document).roads.map((road) => road.bywayId)
  } else {
    const passport = parseDocument('passport', document)
    snapshot.saved = Object.keys(passport.saved)
    snapshot.visits = passport.visits.map((visit) => ({
      bywayId: visit.bywayId,
      date: visit.date,
      ...(includeNotes && visit.note ? { note: visit.note } : {}),
    }))
    snapshot.roads = [...new Set([...snapshot.saved, ...snapshot.visits.map((visit) => visit.bywayId)])]
  }
  if (!snapshot.roads.length) throw new Error('Add a road before creating a share link')
  if (new TextEncoder().encode(JSON.stringify(snapshot)).length > 65536)
    throw new Error('This snapshot exceeds 64 KB. Share fewer roads or leave notes out.')
  return snapshot
}
export function createShareSlug() {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(18)),
    (byte) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[byte & 63],
  ).join('')
}
