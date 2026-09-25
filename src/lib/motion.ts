import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { safeStorage } from './storage'
type Preference = 'system' | 'on' | 'off'
export const useMotion = create<{ preference: Preference; setPreference: (p: Preference) => void }>()(
  persist((set) => ({ preference: 'system', setPreference: (preference) => set({ preference }) }), {
    name: 'rambleroo.motion.v1',
    storage: createJSONStorage(() => safeStorage),
  }),
)
export function useMotionEnabled() {
  const preference = useMotion((s) => s.preference)
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const q = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(q.matches)
    update()
    q.addEventListener('change', update)
    return () => q.removeEventListener('change', update)
  }, [])
  const enabled = preference !== 'off' && !reduced
  useEffect(() => {
    document.documentElement.dataset.motion = enabled ? 'on' : 'off'
  }, [enabled])
  return enabled
}
