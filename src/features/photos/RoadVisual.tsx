import { PhotoLettering } from '../postcard/PhotoPostcard'
import { Scene } from '../../components/art'
import type { SceneProps } from '../../components/art'
import { useCovers } from '../../lib/data'
import { PhotoChip, PhotoImage } from './Photos'
import s from './Photos.module.css'

/** All road surfaces show the road's cover photo, including future reviewed additions, and the illustration until it loads. */
export function RoadVisual({ bywayId, ...scene }: SceneProps & { bywayId?: string }) {
  const covers = useCovers()
  const photo = bywayId ? covers?.[bywayId] : undefined
  // Thumbnails are too small for an on-image chip; they carry the credit (or the illustration note) as a tooltip, and the full credit sits on the road's page.
  const thumb = scene.variant === 'thumb'
  const note = photo ? `Photo: ${photo.author} · ${photo.license} · Wikimedia Commons` : 'Illustration · no photo yet'
  return (
    <div className={s.visual} title={thumb ? note : undefined}>
      {photo ? (
        <>
          <PhotoImage photo={photo} />
          {scene.lettering && scene.look && (
            <PhotoLettering name={scene.lettering.title} states={scene.lettering.subtitle} family={scene.family} look={scene.look} />
          )}
          {!thumb && <PhotoChip photo={photo} />}
        </>
      ) : (
        <>
          <Scene {...scene} />
          {thumb ? <span className="visually-hidden">{note}</span> : <span className={s.fallback}>Illustration · no photo yet</span>}
        </>
      )}
    </div>
  )
}
