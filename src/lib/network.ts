import { useSyncExternalStore } from 'react'
import { toast } from '../components/ui/Toast'

function subscribe(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}
export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
}
export function requireNetwork(event: { preventDefault(): void }) {
  if (navigator.onLine) return true
  event.preventDefault()
  toast('This action needs an internet connection. Please try again when you’re online.')
  return false
}
