import type { Visit } from './types'
export interface PassportData {
  version: 1
  saved: Record<string, string>
  visits: Visit[]
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const date = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))

/** Copy only known fields so imported objects never become store actions. */
export function parsePassport(value: unknown): PassportData {
  if (!record(value) || value.version !== 1 || !record(value.saved) || !Array.isArray(value.visits))
    throw new Error('Invalid passport format')
  const saved: Record<string, string> = Object.create(null)
  for (const [id, when] of Object.entries(value.saved)) {
    if (!id.trim() || !date(when)) throw new Error('Invalid saved road')
    saved[id] = when
  }
  const visits = value.visits.map((visit): Visit => {
    if (
      !record(visit) ||
      typeof visit.id !== 'string' ||
      !visit.id.trim() ||
      typeof visit.bywayId !== 'string' ||
      !visit.bywayId.trim() ||
      !date(visit.date) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(visit.date) ||
      new Date(visit.date).toISOString().slice(0, 10) !== visit.date ||
      !date(visit.createdAt) ||
      !['part', 'whole'].includes(String(visit.scope)) ||
      typeof visit.note !== 'string' ||
      visit.note.length > 500
    ) {
      throw new Error('Invalid visit')
    }
    return {
      id: visit.id,
      bywayId: visit.bywayId,
      date: visit.date,
      createdAt: visit.createdAt,
      scope: visit.scope as Visit['scope'],
      note: visit.note,
    }
  })
  return { version: 1, saved, visits }
}

export function mergePassport(current: Pick<PassportData, 'saved' | 'visits'>, incoming: PassportData) {
  const saved = { ...current.saved }
  let savedAdded = 0
  for (const [id, when] of Object.entries(incoming.saved)) {
    if (!Object.hasOwn(saved, id)) savedAdded++
    if (!Object.hasOwn(saved, id) || Date.parse(when) < Date.parse(saved[id])) {
      Object.defineProperty(saved, id, { value: when, enumerable: true, writable: true, configurable: true })
    }
  }
  const visits = [...current.visits]
  const ids = new Set(visits.map((visit) => visit.id))
  for (const visit of incoming.visits) {
    if (!ids.has(visit.id)) {
      visits.push(visit)
      ids.add(visit.id)
    }
  }
  return { saved, visits, savedAdded, visitsAdded: visits.length - current.visits.length }
}
