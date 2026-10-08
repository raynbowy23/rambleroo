import { useEffect, useState } from 'react'
import type { StreetView } from '../../lib/types'
import s from './Photos.module.css'

// Street-level frames from Mapillary contributors, served through our Worker (/api/street/:id) so the image URL never expires
// and visitors never load anything from Meta. Mapillary's terms ask for its logo and a link to the image page on every frame.
let all: Promise<StreetView[]> | undefined
const load = () => (all ??= import('../../../content/streetview.json').then((m) => m.default as StreetView[]))

export function useStreetViews(bywayId?: string) {
  const [views, setViews] = useState<StreetView[]>([])
  useEffect(() => {
    let live = true
    setViews([])
    if (bywayId) void load().then((list) => live && setViews(list.filter((v) => v.bywayId === bywayId)))
    return () => {
      live = false
    }
  }, [bywayId])
  return views
}

export function StreetFrame({ view }: { view: StreetView }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  const page = `https://www.mapillary.com/app/?pKey=${view.id}`
  return (
    <figure className={s.figure}>
      <a href={page} className={s.street} aria-label={`Open this view on Mapillary, taken ${view.captured} by ${view.creator}`}>
        <img
          className={s.image}
          src={`/api/street/${view.id}`}
          alt={`The road ahead, from a street-level photo taken ${view.captured}.`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
        <span className={s.mapillary} aria-hidden="true" />
      </a>
      <figcaption className={s.credit}>
        {view.creator} · {view.captured.slice(0, 4)} · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> ·{' '}
        <a href={page}>Mapillary</a>
      </figcaption>
    </figure>
  )
}

export function StreetGallery({ bywayId }: { bywayId: string }) {
  const views = useStreetViews(bywayId)
  if (!views.length) return null
  return (
    <section className={s.section}>
      <h2>From the driver’s seat</h2>
      <p className={s.note}>Street-level photos shared by Mapillary contributors who drove this road.</p>
      <div className={s.streetGallery}>
        {views.map((v) => (
          <StreetFrame key={v.id} view={v} />
        ))}
      </div>
    </section>
  )
}
