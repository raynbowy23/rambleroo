import { useState, type ReactNode } from 'react'
import type { Photo } from '../../lib/types'
import { Dialog } from '../../components/ui/Dialog'
import s from './Photos.module.css'

export function photoPath(photo: Photo) {
  return photo.file.startsWith('/photos/') ? photo.file : `/photos/${photo.bywayId}/${photo.file}`
}
export function photoCredit(photo: Photo) {
  return `Photo: ${photo.author} · ${photo.license} (${photo.licenseUrl}) · via Wikimedia Commons (${photo.sourceUrl})`
}
export function PhotoCredit({ photo }: { photo: Photo }) {
  return (
    <span className={s.credit}>
      Photo: {photo.author} · <a href={photo.licenseUrl}>{photo.license}</a> · via <a href={photo.sourceUrl}>Wikimedia Commons</a>
    </span>
  )
}
export function PhotoImage({ photo }: { photo: Photo }) {
  return <img className={s.image} src={photoPath(photo)} width={photo.width} height={photo.height} alt={photo.alt} loading="lazy" />
}
export function RoadPhoto({ photo }: { photo: Photo }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <figure className={s.figure}>
        <button className={s.open} onClick={() => setOpen(true)} aria-label={`Enlarge ${photo.title}`}>
          <PhotoImage photo={photo} />
        </button>
        <figcaption>
          <PhotoCredit photo={photo} />
        </figcaption>
      </figure>
      {open && (
        <Dialog title={photo.title} onClose={() => setOpen(false)}>
          <div className={s.lightbox}>
            <PhotoImage photo={photo} />
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
  const [illustration, setIllustration] = useState(false)
  if (!photo) return children
  return (
    <div>
      {illustration ? children : <RoadPhoto photo={photo} />}
      <button className={s.toggle} onClick={() => setIllustration(!illustration)}>
        {illustration ? 'Photo' : 'Illustration'}
      </button>
    </div>
  )
}
