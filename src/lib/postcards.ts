import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { safeStorage } from './storage'
import type { Photo, PostcardLook } from './types'
export const letteringStyles = ['greetings', 'ribbon', 'block', 'script', 'banner', 'off'] as const
export interface PostcardChoices {
  front: 'photo' | 'illustration' | 'own'
  userPhotoId?: string
  route: boolean
  car: boolean
  lettering: PostcardLook['lettering'] | 'off'
  note: string
}
export const cardKey = (bywayId: string, milestoneId?: string) => (milestoneId ? `${bywayId}#${milestoneId}` : bywayId)
export function postcardDefaults(photo?: Photo, lettering: PostcardLook['lettering'] = 'greetings'): PostcardChoices {
  return { front: photo ? 'photo' : 'illustration', route: true, car: true, lettering, note: '' }
}
export function validatePostcard(value: Partial<PostcardChoices>, defaults = postcardDefaults()): PostcardChoices {
  return {
    front: ['photo', 'illustration', 'own'].includes(value.front!) ? value.front! : defaults.front,
    userPhotoId: typeof value.userPhotoId === 'string' ? value.userPhotoId : undefined,
    route: typeof value.route === 'boolean' ? value.route : defaults.route,
    car: typeof value.car === 'boolean' ? value.car : defaults.car,
    lettering: letteringStyles.includes(value.lettering!) ? value.lettering! : defaults.lettering,
    note: typeof value.note === 'string' ? value.note.slice(0, 500) : defaults.note,
  }
}
/** Source, never a cosmetic toggle, decides whether attribution is mandatory. */
export const creditedPhoto = (choices: Pick<PostcardChoices, 'front'>, photo?: Photo) => (choices.front === 'photo' ? photo : undefined)
export const usePostcards = create<{
  cards: Record<string, PostcardChoices>
  update: (key: string, patch: Partial<PostcardChoices>, defaults?: PostcardChoices) => void
  clear: () => void
}>()(
  persist(
    (set) => ({
      cards: {},
      update: (key, patch, defaults) =>
        set((state) => ({ cards: { ...state.cards, [key]: validatePostcard({ ...(state.cards[key] ?? defaults), ...patch }, defaults) } })),
      clear: () => set({ cards: {} }),
    }),
    {
      name: 'rambleroo.postcards.v1',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ cards: state.cards }),
      merge: (saved, current) => {
        const cards = (saved as { cards?: Record<string, PostcardChoices> } | undefined)?.cards
        return {
          ...current,
          cards: Object.fromEntries(
            Object.entries(cards ?? {})
              .filter(([, value]) => value && typeof value === 'object')
              .map(([key, value]) => [key, validatePostcard(value)]),
          ),
        }
      },
    },
  ),
)
