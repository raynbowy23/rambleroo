import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Photo } from '../../lib/types'
import { Dialog } from '../../components/ui/Dialog'
import s from './Photos.module.css'

export function photoPath(photo: Photo, thumbnail = false) {
  const file = thumbnail ? (photo.thumb ?? photo.file) : photo.file
  return file.startsWith('/') ? file : `/photos/${photo.bywayId}/${file}`
}
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
/** Use full resolution for heroes and lightboxes; cards request the registry thumbnail. */
export function PhotoImage({ photo, full = false, hero = false }: { photo: Photo; full?: boolean; hero?: boolean }) {
  return (
    <img
      className={s.image}
      src={photoPath(photo, !full && !hero)}
      srcSet={
        !full && !hero && photo.thumb
          ? `${photoPath(photo, true)} ${Math.min(480, photo.width)}w, ${photoPath(photo)} ${photo.width}w`
          : undefined
      }
      sizes={!full && !hero && photo.thumb ? 'auto, (max-width: 759px) 100vw, 480px' : undefined}
      width={photo.width}
      height={photo.height}
      alt={photo.alt}
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
