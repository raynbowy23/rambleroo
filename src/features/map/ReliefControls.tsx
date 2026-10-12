import { useEffect, useRef, useState } from 'react'
import type { Map } from './maplibre'
import { useMotionEnabled } from '../../lib/motion'
import { toast } from '../../components/ui/Toast'
import { loadRoadGeometry } from './layers'
import { bearing, longestPart, type RoutePart } from './routeJourney'
import { useGarage } from '../../lib/garage'
import { setRelief, isTerrainError } from './terrain'
import type { GeoJSONSource } from './maplibre'
import type { Position } from 'geojson'
import { loadRoadCountry } from './roadCountry'

const preference = 'rambleroo.relief.v1'
function savedPreference() {
  try {
    return localStorage.getItem(preference) === 'true'
  } catch {
    return false
  }
}
/** `onDrive`: called when 3D turns on with a road picked, so the map replays the drive in 3D. */
export function ReliefControls({ map, roadId, onDrive }: { map: Map; roadId?: string; onDrive?: () => void }) {
  const [enabled, setEnabled] = useState(savedPreference)
  const [route, setRoute] = useState<{ id: string; parts: Position[][]; part?: RoutePart; ship: boolean; scene: string }>()
  const selectedRoute = route?.id === roadId ? route : undefined
  const part = selectedRoute?.part
  const garage = useGarage()
  const drive = useRef(onDrive)
  drive.current = onDrive
  const wasEnabled = useRef(false)
  const previousRoad = useRef<string | undefined>(undefined)
  const motion = useMotionEnabled()
  useEffect(() => {
    let active = true
    setRoute(undefined)
    if (roadId)
      void loadRoadGeometry(roadId)
        .then((data) => {
          const features = data.features.filter((f) => f.properties.id === roadId)
          const parts = features.flatMap((f) => f.geometry.coordinates)
          if (active)
            setRoute({
              scene: features[0]?.properties.scene ?? 'town',
              id: roadId,
              parts,
              part: longestPart(parts),
              ship: features.some((f) => /marine highway/i.test(f.properties.name)),
            })
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
    const reliefChanged = enabled !== wasEnabled.current
    if (enabled || wasEnabled.current) setRelief(map, enabled)
    wasEnabled.current = enabled
    const deselected = !!previousRoad.current && !roadId
    previousRoad.current = roadId
    const camera = {
      pitch: part ? 45 : enabled && !deselected ? 60 : 0,
      bearing: part ? bearing(part.coordinates[0], part.coordinates[1]) : 0,
    }
    const orient = () => {
      if (motion) map.easeTo({ ...camera, duration: 800 })
      else map.jumpTo(camera)
    }
    // Let the parent finish framing the selected road before changing its angle.
    if (part && map.isMoving()) map.once('moveend', orient)
    else if (part || (!roadId && (enabled || deselected || reliefChanged))) orient()
    return () => {
      map.off('error', fail)
      map.off('moveend', orient)
    }
  }, [map, enabled, motion, part, roadId])
  useEffect(() => {
    if (enabled && part) drive.current?.()
  }, [enabled, part])
  useEffect(() => {
    if (!part || !selectedRoute) return
    let active = true
    let remove = () => {}
    void import('./car3d')
      .then(({ createCarLayer, carLayerId }) => {
        if (!active) return
        let ready = false
        let failed = false
        const visibility = () => {
          if (active && map.getLayer('route-car'))
            map.setLayoutProperty('route-car', 'visibility', ready && !failed && map.getPitch() >= 20 ? 'none' : 'visible')
        }
        const fallback = () => {
          failed = true
          if (active && map.getLayer('route-car')) map.setLayoutProperty('route-car', 'visibility', 'visible')
        }
        const car = createCarLayer(
          garage,
          part.coordinates[0] as [number, number],
          bearing(part.coordinates[0], part.coordinates[1]),
          selectedRoute.ship,
          {
            onReady: () => {
              ready = true
              visibility()
            },
            onFailure: fallback,
            road: !selectedRoute.ship,
          },
        )
        remove = () => {
          if (map.getLayer(carLayerId)) map.removeLayer(carLayerId)
          fallback()
        }
        map.addLayer(car.layer)
        map.on('pitch', visibility)
        visibility()
        // The 3D car rides where the flat car would be: it follows every step of the drive animation (and stays parked after it).
        const follow = () => {
          const data = (map.getSource('route-car') as GeoJSONSource | undefined)?.serialize().data as
            { type?: string; geometry?: { coordinates: [number, number] }; properties?: { bearing?: number } } | undefined
          if (data?.type === 'Feature' && data.geometry) car.update(data.geometry.coordinates, data.properties?.bearing ?? 0)
        }
        const onData = (event: { sourceId?: string }) => {
          if (event.sourceId === 'route-car') follow()
        }
        map.on('sourcedata', onData)
        follow()
        remove = () => {
          map.off('sourcedata', onData)
          map.off('pitch', visibility)
          if (map.getLayer(carLayerId)) map.removeLayer(carLayerId)
          if (map.getLayer('route-car')) map.setLayoutProperty('route-car', 'visibility', 'visible')
        }
      })
      .catch(() => {
        if (active) {
          remove()
          if (map.getLayer('route-car')) map.setLayoutProperty('route-car', 'visibility', 'visible')
        }
      })
    return () => {
      active = false
      remove()
    }
  }, [map, part, selectedRoute, garage])
  useEffect(() => {
    if (!selectedRoute || selectedRoute.ship || !part) return
    let active = true
    let remove = () => {}
    void Promise.all([import('./road3d'), loadRoadCountry(selectedRoute.id)])
      .then(([{ createRoadLayer, roadLayerId }, country]) => {
        if (!active) return
        // Keep the styled route visible, including while terrain and custom shaders load.
        const layer = createRoadLayer(
          selectedRoute.parts,
          () => {},
          () => {},
          selectedRoute.scene,
          country,
        )
        remove = () => {
          if (map.getLayer(roadLayerId)) map.removeLayer(roadLayerId)
        }
        map.addLayer(layer, map.getLayer('garage-car-3d') ? 'garage-car-3d' : 'route-flags')
      })
      .catch(() => remove())
    return () => {
      active = false
      remove()
    }
  }, [map, selectedRoute, part])
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
