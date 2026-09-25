import { useEffect } from 'react'
import { create } from 'zustand'
import styles from './Toast.module.css'
const useToast = create<{ message: string; serial: number; show: (message: string) => void; clear: () => void }>((set) => ({
  message: '',
  serial: 0,
  show: (message) => set((s) => ({ message, serial: s.serial + 1 })),
  clear: () => set({ message: '' }),
}))
export const toast = (message: string) => useToast.getState().show(message)
export function Toast() {
  const { message, serial, clear } = useToast()
  useEffect(() => {
    const timer = setTimeout(clear, 4500)
    return () => clearTimeout(timer)
  }, [serial, clear])
  return (
    <div className={styles.toast} role="status" aria-live="polite">
      {message}
    </div>
  )
}
