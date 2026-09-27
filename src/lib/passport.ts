import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { BywaySummary, Visit } from './types'
import { safeStorage } from './storage'
export interface SavedStretch {
  bywayId: string
  stretchId: string
  savedAt: string
}
export interface KeptPostcard {
  bywayId: string
  milestoneId: string
  keptAt: string
}
export interface PassportState {
  postcards: KeptPostcard[]
  keepPostcard: (bywayId: string, milestoneId: string) => void
  removePostcard: (bywayId: string, milestoneId: string) => void
  savedStretches: SavedStretch[]
  saveStretch: (bywayId: string, stretchId: string) => void
  removeStretch: (bywayId: string, stretchId: string) => void
  saved: Record<string, string>
  visits: Visit[]
  lastStampId: string | null
  toggleSave: (id: string) => void
  isSaved: (id: string) => boolean
  addVisit: (input: Pick<Visit, 'bywayId' | 'date' | 'scope' | 'note'>) => Visit
  updateVisit: (id: string, patch: Partial<Pick<Visit, 'date' | 'scope' | 'note'>>) => void
  deleteVisit: (id: string) => void
  clearLastStamp: () => void
}
export const usePassport = create<PassportState>()(
  persist(
    (set, get) => ({
      postcards: [],
      keepPostcard: (bywayId, milestoneId) =>
        set((state) => ({
          postcards: state.postcards.some((card) => card.bywayId === bywayId && card.milestoneId === milestoneId)
            ? state.postcards
            : [...state.postcards, { bywayId, milestoneId, keptAt: new Date().toISOString() }],
        })),
      removePostcard: (bywayId, milestoneId) =>
        set((state) => ({ postcards: state.postcards.filter((card) => card.bywayId !== bywayId || card.milestoneId !== milestoneId) })),
      savedStretches: [],
      saveStretch: (bywayId, stretchId) =>
        set((s) => ({
          savedStretches: s.savedStretches.some((entry) => entry.bywayId === bywayId && entry.stretchId === stretchId)
            ? s.savedStretches
            : [...s.savedStretches, { bywayId, stretchId, savedAt: new Date().toISOString() }],
        })),
      removeStretch: (bywayId, stretchId) =>
        set((s) => ({ savedStretches: s.savedStretches.filter((entry) => entry.bywayId !== bywayId || entry.stretchId !== stretchId) })),
      saved: {},
      visits: [],
      lastStampId: null,
      toggleSave: (id) =>
        set((s) => {
          const saved = { ...s.saved }
          if (saved[id]) delete saved[id]
          else saved[id] = new Date().toISOString()
          return { saved }
        }),
      isSaved: (id) => Boolean(get().saved[id]),
      addVisit: (input) => {
        const visit: Visit = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
        set((s) => ({ visits: [...s.visits, visit], lastStampId: visit.id }))
        return visit
      },
      updateVisit: (id, patch) => set((s) => ({ visits: s.visits.map((v) => (v.id === id ? { ...v, ...patch } : v)) })),
      deleteVisit: (id) =>
        set((s) => ({ visits: s.visits.filter((v) => v.id !== id), lastStampId: s.lastStampId === id ? null : s.lastStampId })),
      clearLastStamp: () => set({ lastStampId: null }),
    }),
    {
      name: 'rambleroo.passport.v1',
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ saved: s.saved, visits: s.visits, savedStretches: s.savedStretches, postcards: s.postcards }),
    },
  ),
)
export const visitedBywayIds = (s: Pick<PassportState, 'visits'>) => new Set(s.visits.map((v) => v.bywayId))
export function passportCounts(s: Pick<PassportState, 'saved' | 'visits'>, byways: BywaySummary[] = []) {
  const visited = visitedBywayIds(s)
  return {
    saved: Object.keys(s.saved).length,
    visits: s.visits.length,
    distinctVisited: visited.size,
    states: new Set(byways.filter((b) => visited.has(b.id)).flatMap((b) => b.states)).size,
  }
}
