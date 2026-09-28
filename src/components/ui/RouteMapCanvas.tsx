import { ReliefControls } from '../../features/map/ReliefControls'
import { isTerrainError } from '../../features/map/terrain'
import { useEffect, useRef, useState } from 'react'
import maplibre from '../../features/map/maplibre'
import { createMapStyle, palette } from '../../features/map/style'
import { addBywayLayers, loadBywayGeometry } from '../../features/map/layers'
import type { BywaySummary, StoryMoment } from '../../lib/types'
import s from './Content.module.css'
import { useMotionEnabled } from '../../lib/motion'
const emptyIds: string[] = []
const emptyMoments: StoryMoment[] = []
function unionBounds(byways: BywaySummary[]): [number, number, number, number] {
  return [
    Math.min(...byways.map((b) => b.bbox[0])),
    Math.min(...byways.map((b) => b.bbox[1])),
    Math.max(...byways.map((b) => b.bbox[2])),
    Math.max(...byways.map((b) => b.bbox[3])),
  ]
}
/** A scroll-safe, optional map. All road links and story content live outside it. */
export function RouteMap({
  byways,
  bbox,
  emphasized = emptyIds,
  visited,
  saved = emptyIds,
  moments = emptyMoments,
  activeMoment,
  onMoment,
  label = 'Byway map',
}: {
  byways: BywaySummary[]
  bbox?: [number, number, number, number]
  emphasized?: string[]
  visited?: string[]
  saved?: string[]
  moments?: StoryMoment[]
  activeMoment?: number | null
  onMoment?: (index: number) => void
  label?: string
}) {
  const motion = useMotionEnabled()
  const motionRef = useRef(motion)
  motionRef.current = motion
  const container = useRef<HTMLDivElement>(null)
  const markers = useRef<{ button: HTMLButtonElement; index: number }[]>([])
  const callback = useRef(onMoment)
  callback.current = onMoment
  const wholeRouteRef = useRef(false)
  const storyBounds = useRef<[number, number, number, number] | null>(null)
  const mapRef = useRef<maplibre.Map | null>(null)
  const [wholeRoute, setWholeRoute] = useState(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  // Value keys keep maps alive when unrelated form/store state changes.
  const key = JSON.stringify({ ids: byways.map((b) => b.id), bbox, emphasized, visited, saved, moments })
  useEffect(() => {
    if (failed || !container.current || !byways.length) return
    wholeRouteRef.current = false
    setWholeRoute(false)
    let map: maplibre.Map | undefined
    let disposed = false
    let frame = 0
    const fail = () => {
      if (!disposed) setFailed(true)
    }
    try {
      map = new maplibre.Map({
        container: container.current,
        style: createMapStyle(),
        interactive: true,
        maxPitch: 70,
        cooperativeGestures: navigator.maxTouchPoints > 0,
        scrollZoom: false,
        attributionControl: false,
      })
      const current = map
      mapRef.current = current
      // Start over the requested chapter before asynchronous sources finish loading.
      current.fitBounds(bbox ?? unionBounds(byways), { padding: 40, maxZoom: 11, duration: 0 })
      current.addControl(new maplibre.AttributionControl({ compact: true, customAttribution: 'Natural Earth · USDOT' }))
      current.on('error', (event) => {
        if (!isTerrainError(event)) fail()
      })
      current.on('load', () => {
        void loadBywayGeometry()
          .then((data) => {
            if (disposed) return
            const ids = new Set(byways.map((b) => b.id))
            addBywayLayers(current, { ...data, features: data.features.filter((f) => ids.has(f.properties.id)) }, byways)
            const c = palette()
            if (visited) {
              current.setPaintProperty('byway-lines', 'line-color', c('forest'))
              current.setFilter('byway-lines', ['in', ['get', 'id'], ['literal', visited]])
              current.addLayer({
                id: 'saved-roads',
                type: 'line',
                source: 'byways',
                filter: ['all', ['in', ['get', 'id'], ['literal', saved]], ['!', ['in', ['get', 'id'], ['literal', visited]]]],
                paint: { 'line-color': c('rust'), 'line-width': 3, 'line-dasharray': [3, 2] },
              })
            } else if (emphasized.length) {
              current.setPaintProperty('byway-lines', 'line-opacity', ['case', ['in', ['get', 'id'], ['literal', emphasized]], 1, 0.35])
              current.setPaintProperty('byway-lines', 'line-width', ['case', ['in', ['get', 'id'], ['literal', emphasized]], 4, 2])
            }
            current.setLayoutProperty('story-points', 'visibility', 'none')
            if (byways.length === 1 && !visited) {
              ;(current.getSource('selected') as maplibre.GeoJSONSource).setData({
                ...data,
                features: data.features.filter((f) => ids.has(f.properties.id)),
              })
              current.setPaintProperty('selected-glow', 'line-opacity', 0)
              const start = performance.now()
              const color = c('forest')
              const trace = (now: number) => {
                if (disposed) return
                const progress = motionRef.current ? Math.min(1, (now - start) / 800) : 1
                current.setPaintProperty('selected-line', 'line-gradient', [
                  'step',
                  ['line-progress'],
                  color,
                  Math.max(0.00001, progress),
                  'rgba(0,0,0,0)',
                ])
                if (progress < 1) frame = requestAnimationFrame(trace)
              }
              trace(start)
            }
            const points = moments.flatMap((moment) => (moment.at ? [moment.at] : []))
            const coordinates = data.features
              .filter((feature) => ids.has(feature.properties.id))
              .flatMap((feature) => feature.geometry.coordinates.flat())
            const nearbyRoute = points.flatMap((point) => {
              let nearest: number[] | undefined
              let distance = Infinity
              for (const coordinate of coordinates) {
                const squared = (coordinate[0] - point[0]) ** 2 + (coordinate[1] - point[1]) ** 2
                if (squared < distance) {
                  nearest = coordinate
                  distance = squared
                }
              }
              return nearest ? [nearest] : []
            })
            const localPoints = [...points, ...nearbyRoute]
            let bounds = bbox ?? unionBounds(byways)
            if (points.length) {
              // A modest geographic margin includes the road around the story stops.
              bounds = [
                Math.min(...localPoints.map((p) => p[0])) - 0.08,
                Math.min(...localPoints.map((p) => p[1])) - 0.08,
                Math.max(...localPoints.map((p) => p[0])) + 0.08,
                Math.max(...localPoints.map((p) => p[1])) + 0.08,
              ]
            }
            storyBounds.current = bounds
            current.resize()
            current.fitBounds(bounds, { padding: 50, maxZoom: 11, duration: 0 })
            setReady(true)
            markers.current = []
            moments.forEach((moment, index) => {
              if (!moment.at) return
              const button = document.createElement('button')
              button.type = 'button'
              button.className = s.marker
              button.textContent = String(index + 1)
              button.setAttribute('aria-label', `Read moment ${index + 1}: ${moment.title}`)
              button.setAttribute('aria-pressed', 'false')
              button.onclick = () => callback.current?.(index)
              new maplibre.Marker({ element: button }).setLngLat(moment.at).addTo(current)
              markers.current.push({ button, index })
            })
          })
          .catch(fail)
      })
    } catch {
      fail()
    }
    const resize = () => {
      map?.resize()
      if (storyBounds.current)
        map?.fitBounds(wholeRouteRef.current ? (bbox ?? unionBounds(byways)) : storyBounds.current, {
          padding: 50,
          maxZoom: 11,
          duration: 0,
        })
    }
    const mountFrame = requestAnimationFrame(resize)
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize)
    if (container.current) observer?.observe(container.current)
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      cancelAnimationFrame(mountFrame)
      setReady(false)
      mapRef.current = null
      storyBounds.current = null
      observer?.disconnect()
      map?.remove()
      markers.current = []
    }
    // All geometry-affecting values are included in key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, failed])
  useEffect(() => {
    markers.current.forEach(({ button, index }) => button.setAttribute('aria-pressed', String(index === activeMoment)))
  }, [activeMoment])
  if (failed || !byways.length) return null
  return (
    <div>
      <div className={s.map} role="region" aria-label={label}>
        <div className={s.mapCanvas} ref={container} />
        {moments.some((moment) => moment.at) && (
          <button
            className={`btn btn-ghost ${s.mapToggle}`}
            aria-pressed={wholeRoute}
            onClick={() => {
              const next = !wholeRoute
              setWholeRoute(next)
              wholeRouteRef.current = next
              const bounds = next ? (bbox ?? unionBounds(byways)) : storyBounds.current
              if (bounds) mapRef.current?.fitBounds(bounds, { padding: 50, maxZoom: 11, duration: motion ? 500 : 0 })
            }}
          >
            {wholeRoute ? 'Story stops' : 'Whole route'}
          </button>
        )}
      </div>
      {ready && mapRef.current && (
        <div className={s.reliefControls}>
          <ReliefControls map={mapRef.current} roadId={byways.length === 1 && !visited ? byways[0].id : undefined} />
        </div>
      )}
      {visited && (
        <div className={s.legend}>
          <span>
            <i />
            Visited · solid green
          </span>
          <span>
            <i className={s.savedLine} />
            Saved · dashed rust (unless visited)
          </span>
        </div>
      )}
    </div>
  )
}
