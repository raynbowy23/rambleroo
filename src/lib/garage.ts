import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { safeStorage } from './storage'

export const models = ['coupe', 'pickup', 'camper', 'wagon', 'convertible', 'motorcycle'] as const
export const roofs = ['none', 'surfboard', 'canoe', 'bikes', 'luggage'] as const
export const accents = ['none', 'stripe', 'two-tone'] as const
export const swatches = [
  ['Sage olive', '#5a6844'],
  ['Rescue orange', '#ee7430'],
  ['Cream', '#f5e6c8'],
  ['Sky blue', '#86b9d4'],
  ['Cherry red', '#be3838'],
  ['Mustard', '#d5a635'],
  ['Black', '#262923'],
  ['White', '#faf9f0'],
  ['Teal', '#328b87'],
  ['Lilac', '#af96ca'],
] as const
export interface Garage {
  model: (typeof models)[number]
  body: string
  accent: (typeof accents)[number]
  accentColor: string
  roof: (typeof roofs)[number]
  plate: string
}
export const defaultGarage: Garage = {
  model: 'coupe',
  body: '#ee7430',
  accent: 'none',
  accentColor: '#f5e6c8',
  roof: 'none',
  plate: 'RAMBLE',
}
export function validateGarage(input: Partial<Garage>): Garage {
  return {
    model: models.includes(input.model!) ? input.model! : defaultGarage.model,
    body: /^#[0-9a-f]{6}$/i.test(input.body ?? '') ? input.body! : defaultGarage.body,
    accent: accents.includes(input.accent!) ? input.accent! : 'none',
    accentColor: swatches.some(([, color]) => color === input.accentColor) ? input.accentColor! : defaultGarage.accentColor,
    roof: roofs.includes(input.roof!) ? input.roof! : 'none',
    plate:
      typeof input.plate === 'string'
        ? input.plate
            .toUpperCase()
            .replace(/[^A-Z0-9 ]/g, '')
            .slice(0, 7)
        : 'RAMBLE',
  }
}
export const useGarage = create<Garage & { update: (patch: Partial<Garage>) => void }>()(
  persist((set, get) => ({ ...defaultGarage, update: (patch) => set(validateGarage({ ...get(), ...patch })) }), {
    name: 'rambleroo.garage.v1',
    storage: createJSONStorage(() => safeStorage),
    partialize: (state) => validateGarage(state),
    merge: (saved, current) => ({ ...current, ...validateGarage((saved ?? {}) as Partial<Garage>) }),
  }),
)
