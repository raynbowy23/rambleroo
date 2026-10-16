import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Photo } from '../../lib/types'
import { Dialog } from '../../components/ui/Dialog'
import s from './Photos.module.css'
import { PHOTO_ORIGIN } from '../../lib/photoOrigin'
import { photoPathAt, photoSources } from '../../lib/photoSources'

export function photoPath(photo: Photo, thumbnail = false) {
  return photoPathAt(thumbnail ? (photo.thumb ?? photo.file) : photo.file, photo.bywayId, PHOTO_ORIGIN)
}
/** A road's lead photo for its hero and postcard: the road or one of its places, like its cover on cards, and a town photo only when it has nothing else. */
export const leadPhoto = (photos: Photo[]) => photos.find((photo) => !photo.town) ?? photos[0]
/** The 960px copy when there is one: enough for a postcard face, which is drawn 840px wide even in the downloaded PNG. */
export const postcardPhotoPath = (photo: Photo) => photoPathAt(photo.medium ?? photo.file, photo.bywayId, PHOTO_ORIGIN)
export function photoSource(photo: Photo) {
  return photo.source === 'nara' && !photo.sourceUrl.includes('commons.wikimedia.org')
    ? 'U.S. DOT / National Archives'
    : 'Wikimedia Commons'
}
export function photoCredit(photo: Photo) {
  return `Photo: ${photo.author} · ${photo.license} (${photo.licenseUrl}) · ${photoSource(photo)} (${photo.sourceUrl})`
}
export function PhotoCredit({ photo }: { photo: Photo }) {
  return (
    <span className={s.credit}>
      Photo: {photo.author} · <a href={photo.licenseUrl}>{photo.license}</a> · <a href={photo.sourceUrl}>{photoSource(photo)}</a>
    </span>
  )
}
/** Lightboxes use full resolution; heroes and cards let the browser pick a size for the screen (src/lib/photoSources.ts). */
export function PhotoImage({ photo, full = false, hero = false }: { photo: Photo; full?: boolean; hero?: boolean }) {
  const { src, srcSet, sizes } = photoSources(photo, PHOTO_ORIGIN, full ? 'full' : hero ? 'hero' : 'card')
  return (
    <img
      className={s.image}
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      width={photo.width}
      height={photo.height}
      alt={photo.alt}
      // Fetched with CORS, so the offline cache stores a readable copy rather than an opaque one.
      crossOrigin="anonymous"
      loading={hero ? 'eager' : 'lazy'}
      fetchPriority={hero ? 'high' : undefined}
      decoding="async"
    />
  )
}
export function PhotoChip({ photo }: { photo: Photo }) {
  const [position, setPosition] = useState<{ left: number; top: number }>()
  const anchor = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const show = () => {
    const rect = anchor.current?.getBoundingClientRect()
    if (rect)
      setPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 296)),
        top: Math.max(8, Math.min(rect.bottom, window.innerHeight - 250)),
      })
  }
  return (
    <div
      className={s.chip}
      onMouseEnter={show}
      onMouseLeave={() => setPosition(undefined)}
      onFocus={show}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget) && !panel.current?.contains(event.relatedTarget)) setPosition(undefined)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          setPosition(undefined)
        }
      }}
    >
      <button ref={anchor} type="button" aria-label={`Photo credit: ${photo.title}`} aria-expanded={!!position} onClick={show}>
        <span className={s.chipLabel}>ⓘ Photo</span>
      </button>
      {position &&
        createPortal(
          <div ref={panel} className={s.popover} style={position}>
            <PhotoCredit photo={photo} />
            <button type="button" onClick={() => setPosition(undefined)}>
              Close credit
            </button>
          </div>,
          anchor.current?.closest('dialog') ?? document.body,
        )}
    </div>
  )
}
export function RoadPhoto({ photo }: { photo: Photo }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <figure className={s.figure}>
        <button className={s.open} onClick={() => setOpen(true)} aria-label={`Enlarge ${photo.title}`}>
          <PhotoImage photo={photo} />
        </button>
        <PhotoChip photo={photo} />
      </figure>
      {open && (
        <Dialog title={photo.title} onClose={() => setOpen(false)}>
          <div className={s.lightbox}>
            <PhotoImage photo={photo} full />
            <PhotoCredit photo={photo} />
          </div>
        </Dialog>
      )}
    </>
  )
}
export function PhotoGallery({ photos }: { photos: Photo[] }) {
  if (!photos.length) return null
  return (
    <section className={s.section}>
      <h2>From the road</h2>
      <div className={s.gallery}>
        {photos.map((photo) => (
          <RoadPhoto key={photo.file} photo={photo} />
        ))}
      </div>
    </section>
  )
}
export function MomentPhoto({ photo, children }: { photo?: Photo; children: ReactNode }) {
  return photo ? <RoadPhoto photo={photo} /> : children
}
