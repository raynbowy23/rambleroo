import { useEffect, useState, type ReactNode } from 'react'
import type { StreetView } from '../../lib/types'
import s from './Photos.module.css'

// Street-level frames from Mapillary contributors, served through our Worker (/api/street/:id) so the image URL never expires
// and visitors never load anything from Meta. Mapillary's terms ask for its logo and a link to the image page on every frame.
let road: Promise<StreetView[]> | undefined
let moments: Promise<StreetView[]> | undefined
const loadRoad = () => (road ??= import('../../../content/streetview.json').then((m) => m.default as StreetView[]))
const loadMoments = () => (moments ??= import('../../../content/streetview-moments.json').then((m) => m.default as StreetView[]))

function useViews(load: () => Promise<StreetView[]>, bywayId?: string) {
  const [views, setViews] = useState<StreetView[]>([])
  useEffect(() => {
    let live = true
    setViews([])
    if (bywayId) void load().then((list) => live && setViews(list.filter((v) => v.bywayId === bywayId)))
    return () => {
      live = false
    }
  }, [load, bywayId])
  return views
}
/** Frames along the whole road, for the strip. */
export const useStreetViews = (bywayId?: string) => useViews(loadRoad, bywayId)
/** Frames picked near story moments that have no photograph. */
export const useMomentViews = (bywayId?: string) => useViews(loadMoments, bywayId)

export function StreetFrame({ view, near, fallback = null }: { view: StreetView; near?: string; fallback?: ReactNode }) {
  const [failed, setFailed] = useState(false)
  if (failed) return fallback
  const page = `https://www.mapillary.com/app/?pKey=${view.id}`
  return (
    <figure className={s.figure}>
      <a href={page} className={s.street} aria-label={`Open this view on Mapillary, taken ${view.captured} by ${view.creator}`}>
        <img
          className={s.image}
          src={`/api/street/${view.id}`}
          alt={
            near
              ? `The road near ${near}, from a street-level photo taken ${view.captured}.`
              : `The road ahead, from a street-level photo taken ${view.captured}.`
          }
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
        <span className={s.mapillary} aria-hidden="true" />
      </a>
      <figcaption className={s.credit}>
        {near && <>Near {near}, from the road · </>}
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

/** A moment card's picture: the street frame near it when there is one, else the illustration passed as children. */
export function MomentFrame({ view, near, children }: { view?: StreetView; near: string; children: ReactNode }) {
  return view ? <StreetFrame view={view} near={near} fallback={children} /> : children
}
