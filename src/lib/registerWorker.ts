// A new deploy installs in the background and is switched to quietly at a safe moment: the next page change, or when the visitor
// leaves the app. Saved roads, the passport and notes live in the browser and the account, so the reload never loses them; it only
// waits while someone is typing, so a half-written note survives.
const CHECK_EVERY_MS = 60 * 60 * 1000
let apply: (() => Promise<void>) | null = null

const typing = () => {
  const el = document.activeElement as HTMLElement | null
  return (
    !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'button'))
  )
}

/** Switch to a waiting new version now, if there is one and nobody is typing. Called on page changes. */
export function applyPendingUpdate() {
  if (!apply || typing()) return
  const run = apply
  apply = null
  void run()
}

export function registerWorker() {
  if (!import.meta.env.PROD) return
  let disposed = false
  // The first page can finish loading before the worker takes control. Replay
  // its local data/photo requests so that first visit is available offline too.
  const cacheOpenedResources = () => {
    if (!navigator.serviceWorker.controller) return
    const urls = new Set(['/data/catalog.json'])
    performance.getEntriesByType('resource').forEach(({ name }) => {
      const url = new URL(name, location.href)
      if (url.origin === location.origin && (url.pathname.startsWith('/data/') || url.pathname.startsWith('/photos/'))) urls.add(url.href)
    })
    void Promise.allSettled([...urls].map((url) => fetch(url)))
  }
  const onHidden = () => {
    if (document.visibilityState === 'hidden') applyPendingUpdate()
  }
  let timer: ReturnType<typeof setInterval> | undefined
  navigator.serviceWorker?.addEventListener('controllerchange', cacheOpenedResources)
  document.addEventListener('visibilitychange', onHidden)
  void import('virtual:pwa-register').then(({ registerSW }) => {
    if (disposed) return
    const reload = registerSW({
      onNeedRefresh() {
        if (!disposed) apply = () => reload(true)
      },
      // An installed app can stay open for days, so look for a new deploy now and then, not only at start-up.
      onRegisteredSW(_url, registration) {
        if (registration && !disposed) timer = setInterval(() => void registration.update(), CHECK_EVERY_MS)
      },
    })
  })
  return () => {
    disposed = true
    apply = null
    clearInterval(timer)
    navigator.serviceWorker?.removeEventListener('controllerchange', cacheOpenedResources)
    document.removeEventListener('visibilitychange', onHidden)
  }
}
