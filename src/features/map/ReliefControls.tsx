import { useEffect, useRef, useState } from 'react'
import type { Map } from './maplibre'
import { useMotionEnabled } from '../../lib/motion'
import { toast } from '../../components/ui/Toast'
import { loadBywayGeometry } from './layers'
import { bearing, longestPart, type RoutePart } from './routeJourney'
import { useGarage } from '../../lib/garage'
import { setRelief, isTerrainError } from './terrain'

const preference = 'rambleroo.relief.v1'
function savedPreference() {
  try {
    return localStorage.getItem(preference) === 'true'
  } catch {
    return false
  }
}
export function ReliefControls({ map, roadId }: { map: Map; roadId?: string }) {
  const [enabled, setEnabled] = useState(savedPreference)
  const [part, setPart] = useState<RoutePart>()
  const garage = useGarage()
  const wasEnabled = useRef(false)
  const motion = useMotionEnabled()
  useEffect(() => {
    let active = true
    setPart(undefined)
    if (roadId)
      void loadBywayGeometry()
        .then((data) => {
          if (active) setPart(longestPart(data.features.filter((f) => f.properties.id === roadId).flatMap((f) => f.geometry.coordinates)))
        })
        .catch(() => {})
    return () => {
      active = false
    }
  }, [roadId])
  useEffect(() => {
    try {
      localStorage.setItem(preference, String(enabled))
    } catch {
      /* Session-only preference. */
    }
    let failed = false
    const fail = (event: unknown) => {
      if (failed || !isTerrainError(event)) return
      failed = true
      setEnabled(false)
      toast("3D terrain isn't available right now")
    }
    if (enabled) map.on('error', fail)
    if (!enabled && !wasEnabled.current)
      return () => {
        map.off('error', fail)
      }
    wasEnabled.current = enabled
    setRelief(map, enabled)
    const camera = { pitch: enabled ? 60 : 0, bearing: enabled && part ? bearing(part.coordinates[0], part.coordinates.at(-1)!) : 0 }
    const orient = () => {
      if (motion) map.easeTo({ ...camera, duration: 800 })
      else map.jumpTo(camera)
    }
    // Let the parent finish framing the selected road before changing its angle.
    if (enabled && map.isMoving()) map.once('moveend', orient)
    else orient()
    return () => {
      map.off('error', fail)
      map.off('moveend', orient)
    }
  }, [map, enabled, motion, part])
  useEffect(() => {
    if (!enabled || !part) return
    let active = true
    let remove = () => {}
    void import('./car3d')
      .then(({ createCarLayer, carLayerId }) => {
        if (!active) return
        const car = createCarLayer(garage, part.coordinates[0] as [number, number], bearing(part.coordinates[0], part.coordinates[1]))
        map.addLayer(car.layer)
        if (map.getLayer('route-car')) map.setLayoutProperty('route-car', 'visibility', 'none')
        remove = () => {
          if (map.getLayer(carLayerId)) map.removeLayer(carLayerId)
          if (map.getLayer('route-car')) map.setLayoutProperty('route-car', 'visibility', 'visible')
        }
      })
      .catch(() => {
        if (active) {
          setEnabled(false)
          toast("3D terrain isn't available right now")
        }
      })
    return () => {
      active = false
      remove()
    }
  }, [map, enabled, part, garage])
  return (
    <button
      className="btn btn-ghost"
      aria-pressed={enabled}
      title="Heights raised about 1.6× for a raised-relief look. Terrain: Mapzen Terrain Tiles on AWS Open Data."
      onClick={() => setEnabled(!enabled)}
    >
      3D
    </button>
  )
}
