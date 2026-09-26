export function registerWorker(onUpdate: (reload: () => Promise<void>) => void) {
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
  navigator.serviceWorker?.addEventListener('controllerchange', cacheOpenedResources)
  void import('virtual:pwa-register').then(({ registerSW }) => {
    if (disposed) return
    const reload = registerSW({
      onNeedRefresh() {
        if (!disposed) onUpdate(() => reload(true))
      },
    })
  })
  return () => {
    disposed = true
    navigator.serviceWorker?.removeEventListener('controllerchange', cacheOpenedResources)
  }
}
