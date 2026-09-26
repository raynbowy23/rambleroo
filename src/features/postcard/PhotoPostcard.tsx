import { useId } from 'react'
import { PostcardType } from '../../components/art/PostcardFinish'
import { lookInks } from '../../components/art/looks'
import type { BywaySummary, Photo, PostcardLook, SceneFamily } from '../../lib/types'
import { PhotoImage } from '../photos/Photos'
import s from './PostcardArt.module.css'

export function PhotoLettering({ name, states, family, look }: { name: string; states?: string; family: SceneFamily; look: PostcardLook }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 400 267" aria-hidden="true" className={s.lettering}>
      <defs>
        <pattern id={`${id}-grain`} width="3" height="3" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".4" fill="#f7f4ed" />
        </pattern>
      </defs>
      <PostcardType lettering={{ title: name, subtitle: states }} look={look} height={267} inks={lookInks(family, look)} id={id} />
    </svg>
  )
}
export function PhotoPostcard({ photo, byway }: { photo: Photo; byway: BywaySummary }) {
  return (
    <div className={s.photoFace}>
      <PhotoImage photo={photo} />
      <PhotoLettering name={byway.name} states={byway.states.join(' · ')} family={byway.scene} look={byway.look} />
    </div>
  )
}
