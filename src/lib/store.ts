import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { safeStorage } from './storage'

export interface TripEntry {
  bywayId: string
  addedAt: string
}
interface TripState {
  roads: TripEntry[]
  add: (bywayId: string) => void
  remove: (bywayId: string) => void
  move: (bywayId: string, direction: -1 | 1) => void
}
export const useTrip = create<TripState>()(
  persist(
    (set) => ({
      roads: [],
      add: (bywayId) =>
        set((s) => ({
          roads: s.roads.some((r) => r.bywayId === bywayId) ? s.roads : [...s.roads, { bywayId, addedAt: new Date().toISOString() }],
        })),
      remove: (bywayId) => set((s) => ({ roads: s.roads.filter((r) => r.bywayId !== bywayId) })),
      move: (bywayId, direction) =>
        set((s) => {
          const roads = [...s.roads]
          const from = roads.findIndex((r) => r.bywayId === bywayId)
          const to = from + direction
          if (from < 0 || to < 0 || to >= roads.length) return s
          ;[roads[from], roads[to]] = [roads[to], roads[from]]
          return { roads }
        }),
    }),
    { name: 'rambleroo.trip.v1', version: 1, storage: createJSONStorage(() => safeStorage), partialize: (s) => ({ roads: s.roads }) },
  ),
)
