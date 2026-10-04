import { usePassport } from './passport'
import { useTrip } from './store'
import { defaultGarage, useGarage } from './garage'
import { usePostcards } from './postcards'
import { dataKinds, parseDocument, type DataKind, type Documents } from './account-data'

export function readDocuments(): Documents {
  const passport = usePassport.getState()
  const garage = useGarage.getState()
  const postcards = usePostcards.getState()
  return {
    passport: parseDocument('passport', { ...passport, version: 1 }),
    trip: parseDocument('trip', { version: 1, roads: useTrip.getState().roads }),
    garage: parseDocument('garage', { version: 1, car: garage, updatedAt: garage.updatedAt }),
    postcards: parseDocument('postcards', { version: 1, cards: postcards.cards, updatedAt: postcards.updatedAt }),
  }
}
export const emptyDocuments = (): Documents => ({
  passport: { version: 1, saved: {}, visits: [], savedStretches: [], postcards: [] },
  trip: { version: 1, roads: [] },
  garage: parseDocument('garage', { version: 1, updatedAt: 0, car: defaultGarage }),
  postcards: { version: 1, updatedAt: 0, cards: {} },
})
export function applyDocument<K extends DataKind>(kind: K, value: Documents[K]) {
  if (kind === 'passport') {
    const { version: _version, ...data } = value as Documents['passport']
    usePassport.setState({ ...data, lastStampId: null })
  }
  if (kind === 'trip') useTrip.setState({ roads: (value as Documents['trip']).roads })
  if (kind === 'garage') {
    const data = value as Documents['garage']
    useGarage.setState({ ...data.car, updatedAt: data.updatedAt })
  }
  if (kind === 'postcards') {
    const data = value as Documents['postcards']
    usePostcards.setState({ cards: data.cards, updatedAt: data.updatedAt })
  }
}
export function applyDocuments(docs: Documents) {
  for (const kind of dataKinds) applyDocument(kind, docs[kind])
}
export function subscribeDocuments(callback: () => void) {
  const off = [
    usePassport.subscribe(callback),
    useTrip.subscribe(callback),
    useGarage.subscribe(callback),
    usePostcards.subscribe(callback),
  ]
  return () => off.forEach((unsubscribe) => unsubscribe())
}
export function hasLocalData(docs: Documents) {
  return (
    Object.keys(docs.passport.saved).length > 0 ||
    docs.passport.visits.length > 0 ||
    !!docs.passport.savedStretches?.length ||
    !!docs.passport.postcards?.length ||
    docs.trip.roads.length > 0 ||
    docs.garage.updatedAt > 0 ||
    JSON.stringify(docs.garage.car) !== JSON.stringify(parseDocument('garage', { version: 1, updatedAt: 0, car: defaultGarage }).car) ||
    Object.keys(docs.postcards.cards).length > 0
  )
}
