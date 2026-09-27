import { useEffect, useState } from 'react'
import { Scene, Vehicle } from '../../components/art'
import type { Garage } from '../../lib/garage'
import type { BywaySummary, BywayStory, Photo } from '../../lib/types'
import { creditedPhoto, type PostcardChoices } from '../../lib/postcards'
import { userPhotos } from '../../lib/userPhotos'
import { PhotoLettering } from './PhotoPostcard'
import { photoPath } from '../photos/Photos'
import { cardTitle, loadCardRoute, routeInset, type CardRoute, type Milestone } from './cardData'
import '../garage/studio.css'
export function useCardAssets(id: string, choices: PostcardChoices, milestone?: Milestone) {
  const [route, setRoute] = useState<CardRoute>()
  const [own, setOwn] = useState<{ id: string; url: string }>()
  const [photoError, setPhotoError] = useState('')
  useEffect(() => {
    let active = true
    setRoute(undefined)
    void loadCardRoute(id, milestone)
      .then((value) => {
        if (active) setRoute(value)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [id, milestone])
  useEffect(() => {
    let active = true
    let url: string | undefined
    setPhotoError('')
    if (choices.front === 'own' && choices.userPhotoId) {
      const photoId = choices.userPhotoId
      void userPhotos
        .get(photoId)
        .then((blob) => {
          if (!active) return
          if (!blob) throw new Error('This photo is no longer in this browser. Choose another photo.')
          url = URL.createObjectURL(blob)
          setOwn({ id: photoId, url })
        })
        .catch(() => {
          if (active) setPhotoError('Your photo could not be loaded. Choose another photo in Customize.')
        })
    }
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [choices.front, choices.userPhotoId])
  return { route, ownUrl: own && own.id === choices.userPhotoId ? own.url : undefined, photoError }
}
export interface CardFrontProps {
  byway: BywaySummary
  story?: BywayStory | null
  photo?: Photo
  choices: PostcardChoices
  garage: Garage
  milestone?: Milestone
  route?: CardRoute
  ownUrl?: string
}
/** One SVG composition is used both live and in the exported PNG. */
export function CardFront({ byway, story, photo, choices, garage, milestone, route, ownUrl }: CardFrontProps) {
  const credit = creditedPhoto(choices, photo)
  const url = credit ? photoPath(credit) : choices.front === 'own' ? ownUrl : undefined
  const look = { ...byway.look, lettering: choices.lettering === 'off' ? byway.look.lettering : choices.lettering }
  const title = cardTitle(byway, milestone)
  const inset = choices.route && route ? routeInset(route) : undefined
  const family = byway.scene === 'river' || byway.scene === 'coast' ? 'water' : byway.scene
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 267"
      role="img"
      aria-label={credit ? `${title} postcard: ${credit.alt}` : `${title} postcard`}
      data-card-front
    >
      {url ? (
        <image href={url} width="400" height="267" preserveAspectRatio="xMidYMid slice" />
      ) : (
        <Scene
          family={milestone?.scene ?? byway.scene}
          region={byway.region}
          motifs={milestone?.motifs ?? story?.motifs}
          look={look}
          seed={byway.seed}
          variant="postcard"
        />
      )}
      {choices.lettering !== 'off' && (
        <PhotoLettering
          name={title}
          states={milestone ? `Mile ${milestone.mile.toFixed(1)} · ${byway.states.join(' · ')}` : byway.states.join(' · ')}
          family={byway.scene}
          look={look}
        />
      )}
      {inset && (
        <g>
          <rect x="269" y="161" width="122" height="98" rx="8" fill="#f5e6c8" fillOpacity=".94" stroke="#252b22" />
          <path
            d={inset.path}
            fill="none"
            stroke={`var(--map-route-${family})`}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {[inset.start, inset.end].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="4" fill="#f5e6c8" stroke="#252b22" />
          ))}
          {milestone && <circle cx={inset.position[0]} cy={inset.position[1]} r="7" fill="#ee7430" stroke="#252b22" />}
        </g>
      )}
      {choices.car &&
        (milestone && inset ? (
          <g transform={`translate(${inset.position[0] - 7} ${inset.position[1] - 12})`}>
            <Vehicle {...garage} view="top" size={14} />
          </g>
        ) : (
          <g transform="translate(20 191)">
            <Vehicle {...garage} view="side" size={110} />
          </g>
        ))}
    </svg>
  )
}
