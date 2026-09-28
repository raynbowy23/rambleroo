import { useEffect, useMemo, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import maplibregl, { type Map } from '../map/maplibre'
import { LandmarkIcon, landmarkKind } from '../../components/art'
import type { BywaySummary } from '../../lib/types'
import { milestones } from '../postcard/cardData'
import { MilestoneToken } from '../postcard/MilestonePostcard'
import { photoPath } from '../photos/Photos'
import type { StripData } from './types'
import s from './Strip.module.css'

export interface PinPosition {
  on: 'main' | 'branch'
  mile: number
}
export function MapPins({
  map,
  data,
  byway,
  position,
  updatePins,
}: {
  map: Map
  data: StripData
  byway: BywaySummary
  position: RefObject<PinPosition>
  updatePins: RefObject<() => void>
}) {
  const places = useMemo(() => {
    const cards = milestones(data)
    return [...data.towns, ...data.moments].map((place, i) => ({
      at: place.at,
      card: cards[i],
      // Stops carry a moment kind; towns are 'town', and park landmarks get a roadside icon chosen by scene and motifs.
      icon:
        'title' in place
          ? landmarkKind(place.kind, cards[i].scene, cards[i].motifs)
          : place.kind === 'landmark'
            ? landmarkKind(place.name, '', []) // the landmark's name picks the icon (Tenaya Lake, Tioga Pass)
            : landmarkKind('town', cards[i].scene, cards[i].motifs),
    }))
  }, [data])
  const [hosts, setHosts] = useState<HTMLDivElement[]>([])
  useEffect(() => {
    const elements = places.map(() => document.createElement('div'))
    const markers = places.map((place, i) => {
      elements[i].className = s.pinAnchor
      return new maplibregl.Marker({ element: elements[i], anchor: 'bottom' }).setLngLat(place.at).addTo(map)
    })
    const update = () => {
      elements.forEach((element, i) => {
        const card = places[i].card
        const near = String(card.on === position.current.on && Math.abs(card.mile - position.current.mile) <= 8)
        if (element.dataset.near !== near) element.dataset.near = near
      })
    }
    updatePins.current = update
    update()
    setHosts(elements)
    return () => {
      updatePins.current = () => {}
      markers.forEach((marker) => marker.remove())
    }
  }, [map, places, position, updatePins])
  return hosts.map((host, i) => {
    const { card, icon } = places[i]
    return createPortal(
      <MilestoneToken byway={byway} milestone={card} className={s.mapPin} label="Map pin: postcard from">
        <span className={s.pinPicture} data-photo-pin={card.photo ? card.name : undefined}>
          {card.photo ? <img src={photoPath(card.photo, true)} alt="" loading="lazy" /> : <LandmarkIcon kind={icon} />}
        </span>
        <span className={s.pinLabel}>{card.name}</span>
      </MilestoneToken>,
      host,
      card.id,
    )
  })
}
