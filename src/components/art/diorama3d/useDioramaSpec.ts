import { useEffect, useState } from 'react'
import type { DioramaSpec } from './spec'

export function useDioramaSpec(id: string) {
  const [loaded, setLoaded] = useState<DioramaSpec | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    setLoaded(null)
    fetch(`/data/dioramas/${encodeURIComponent(id)}.json`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('Missing miniature')
        return r.json() as Promise<DioramaSpec>
      })
      .then((spec) => {
        if (!controller.signal.aborted && spec.bywayId === id) setLoaded(spec)
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoaded(null)
      })
    return () => controller.abort()
  }, [id])
  return loaded?.bywayId === id ? loaded : null
}
