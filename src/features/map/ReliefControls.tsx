import { useEffect, useRef, useState } from 'react'
import type { GeoJSONSource, Map } from './maplibre'
import { useMotionEnabled } from '../../lib/motion'
import { toast } from '../../components/ui/Toast'
import { loadBywayGeometry } from './layers'
import { bearing, journeyPoint, longestPart, type RoutePart } from './routeJourney'
import { setRelief, isTerrainError } from './terrain'

const preference = 'rambleroo.relief.v1'
function savedPreference() {
  try {
    return localStorage.getItem(preference) === 'true'
  } catch {
    return false
  }
}
export function ReliefControls({ map, roadId, fly = false }: { map: Map; roadId?: string; fly?: boolean }) {
  const [enabled, setEnabled] = useState(savedPreference)
  const [part, setPart] = useState<RoutePart>()
  const [flight, setFlight] = useState<'idle' | 'running' | 'paused'>('idle')
  const progress = useRef(0)
  const wasEnabled = useRef(false)
  const motion = useMotionEnabled()
  useEffect(() => {
    let active = true
    setPart(undefined)
    setFlight('idle')
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
    if (!enabled) setFlight('idle')
    return () => {
      map.off('error', fail)
      map.off('moveend', orient)
    }
  }, [map, enabled, motion, part])
  useEffect(() => {
    if (!motion || !enabled) setFlight('idle')
    if (!motion || !enabled || !part || flight !== 'running') return
    let frame = 0
    let previous: number | undefined
    const duration = Math.min(20000, 12000 + part.groundLength * 3959 * 20)
    const tick = (now: number) => {
      if (previous !== undefined) progress.current = Math.min(1, progress.current + (now - previous) / duration)
      previous = now
      const point = journeyPoint(part, progress.current)
      // Look a little ahead to soften changes between short source segments.
      const ahead = journeyPoint(part, Math.min(1, progress.current + 0.003))
      const heading = progress.current < 0.997 ? bearing(point.coordinates, ahead.coordinates) : point.bearing
      map.jumpTo({ center: point.coordinates, bearing: heading, pitch: 65, zoom: 12 })
      ;(map.getSource('route-car') as GeoJSONSource).setData({
        type: 'Feature',
        properties: { bearing: heading },
        geometry: { type: 'Point', coordinates: point.coordinates },
      })
      if (progress.current < 1) frame = requestAnimationFrame(tick)
      else setFlight('idle')
    }
    map.stop()
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [map, enabled, motion, part, flight])
  useEffect(() => {
    const stop = () => setFlight('idle')
    const canvas = map.getCanvas()
    canvas.addEventListener('pointerdown', stop)
    canvas.addEventListener('wheel', stop, { passive: true })
    canvas.addEventListener('keydown', stop)
    return () => {
      canvas.removeEventListener('pointerdown', stop)
      canvas.removeEventListener('wheel', stop)
      canvas.removeEventListener('keydown', stop)
    }
  }, [map])
  return (
    <>
      <button className="btn btn-ghost" aria-pressed={enabled} onClick={() => setEnabled(!enabled)}>
        3D
      </button>
      {enabled &&
        fly &&
        part &&
        (motion ? (
          <>
            {flight === 'idle' ? (
              <button
                className="btn btn-ghost"
                onClick={() => {
                  progress.current = 0
                  setFlight('running')
                }}
              >
                Fly this road
              </button>
            ) : (
              <>
                <button className="btn btn-ghost" onClick={() => setFlight(flight === 'paused' ? 'running' : 'paused')}>
                  {flight === 'paused' ? 'Resume' : 'Pause'}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setFlight('idle')
                    map.stop()
                  }}
                >
                  Skip
                </button>
              </>
            )}
          </>
        ) : (
          <span role="status">Still 3D view · reduced motion</span>
        ))}
    </>
  )
}
