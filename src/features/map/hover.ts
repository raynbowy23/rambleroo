import { create } from 'zustand'
export const useHover = create<{ id: string | null; setId: (id: string | null) => void }>((set) => ({
  id: null,
  setId: (id) => set({ id }),
}))
