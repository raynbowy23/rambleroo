import { mergePassport, parsePassport, type PassportData } from './passport-transfer'
import type { Garage } from './garage'
import type { PostcardChoices } from './postcards'

export const dataKinds = ['passport', 'trip', 'garage', 'postcards'] as const
export type DataKind = (typeof dataKinds)[number]
export const MAX_DOCUMENT_BYTES = 256 * 1024
export interface Documents {
  passport: Omit<PassportData, 'trip'>
  trip: NonNullable<PassportData['trip']>
  garage: { version: 1; updatedAt: number; car: Omit<Garage, 'picture' | 'usePicture'> }
  postcards: { version: 1; updatedAt: number; cards: Record<string, Omit<PostcardChoices, 'userPhotoId'>> }
}
export type DocumentMap = { [K in DataKind]: { json: Documents[K]; updatedAt: number } | null }
export const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const validTime = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const member = <T extends string>(value: unknown, choices: readonly T[]): T => {
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new Error('Invalid choice')
  return value as T
}
const color = (value: unknown): string => {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error('Invalid color')
  return value
}
export function parseDocument<K extends DataKind>(kind: K, value: unknown): Documents[K] {
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_DOCUMENT_BYTES) throw new Error('Document exceeds 256 KB')
  if (!isRecord(value) || value.version !== 1) throw new Error('Invalid document')
  let result: Documents[DataKind]
  if (kind === 'passport') {
    const { trip: _trip, ...passport } = parsePassport(value)
    result = passport
  } else if (kind === 'trip') {
    result = parsePassport({ version: 1, saved: {}, visits: [], trip: value }).trip!
  } else {
    if (!validTime(value.updatedAt)) throw new Error('Invalid updatedAt')
    if (kind === 'garage') {
      const car = value.car
      if (!isRecord(car) || typeof car.plate !== 'string' || !/^[A-Z0-9 ]{0,7}$/.test(car.plate)) throw new Error('Invalid car')
      result = {
        version: 1,
        updatedAt: value.updatedAt,
        car: {
          model: member(car.model, ['coupe', 'pickup', 'camper', 'wagon', 'convertible', 'motorcycle']),
          body: color(car.body),
          accent: member(car.accent, ['none', 'stripe', 'two-tone']),
          accentColor: color(car.accentColor),
          roof: member(car.roof, ['none', 'surfboard', 'canoe', 'bikes', 'luggage']),
          plate: car.plate,
        },
      }
    } else {
      if (!isRecord(value.cards)) throw new Error('Invalid postcards')
      const cards: Documents['postcards']['cards'] = Object.create(null)
      for (const [id, card] of Object.entries(value.cards)) {
        if (
          !id.trim() ||
          !isRecord(card) ||
          typeof card.route !== 'boolean' ||
          typeof card.car !== 'boolean' ||
          typeof card.note !== 'string' ||
          card.note.length > 500
        )
          throw new Error('Invalid postcard')
        cards[id] = {
          front: member(card.front, ['photo', 'illustration', 'own']),
          route: card.route,
          car: card.car,
          lettering: member(card.lettering, ['greetings', 'ribbon', 'block', 'script', 'banner', 'off']),
          note: card.note,
        }
      }
      result = { version: 1, updatedAt: value.updatedAt, cards }
    }
  }
  return result as Documents[K]
}
export function parsePut<K extends DataKind>(kind: K, value: unknown) {
  if (!isRecord(value) || !(value.baseUpdatedAt === null || validTime(value.baseUpdatedAt))) throw new Error('Invalid baseUpdatedAt')
  return { json: parseDocument(kind, value.json), baseUpdatedAt: value.baseUpdatedAt as number | null }
}
export function mergeDocument<K extends DataKind>(kind: K, local: Documents[K], server: Documents[K]): Documents[K] {
  if (kind === 'passport')
    return parseDocument(kind, { version: 1, ...mergePassport(local as Documents['passport'], server as Documents['passport']) })
  if (kind === 'trip') {
    const roads = [...(local as Documents['trip']).roads]
    const ids = new Set(roads.map((road) => road.bywayId))
    for (const road of (server as Documents['trip']).roads)
      if (!ids.has(road.bywayId)) {
        roads.push(road)
        ids.add(road.bywayId)
      }
    return { version: 1, roads } as Documents[K]
  }
  return (local as Documents['garage'] | Documents['postcards']).updatedAt >
    (server as Documents['garage'] | Documents['postcards']).updatedAt
    ? local
    : server
}
