import { useEffect, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource, type Map } from '../map/maplibre'
import { setRelief, isTerrainError } from '../map/terrain'
import { bearing } from '../map/routeJourney'
import { useGarage } from '../../lib/garage'
import { useMotionEnabled } from '../../lib/motion'
import type { createCarLayer } from '../map/car3d'
import { createMapStyle, palette } from '../map/style'
import { coordinateAtMile, mappedIntervals } from './geometry'
import type { Coordinate, StripData, StripPath } from './types'
import s from './Strip.module.css'

export type PositionSink = (point: Coordinate, inGap: boolean, route: StripPath, mile: number) => void

declare global {
  interface Window {
    __rambleroo3d?: { center: () => number[]; car: () => boolean }
  }
}
export function InsetMap({
  data,
  registerPosition,
  relief,
  scene,
  onFailure,
}: {
  data: StripData
  registerPosition: (sink: PositionSink | undefined) => void
  relief: boolean
  scene: string
  onFailure: () => void
}) {
  const garage = useGarage()
  const motion = useMotionEnabled()
  const settings = useRef({ relief, motion, onFailure })
  settings.current = { relief, motion, onFailure }
  const [ready, setReady] = useState<Map>()
  const car3d = useRef<ReturnType<typeof createCarLayer> | undefined>(undefined)
  const currentPosition = useRef({ point: data.main.path[0], heading: 0 })
  const frameView = useRef<() => void>(() => {})
  const container = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState(true)
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    if (!container.current) return
    let map: Map
    try {
      map = new maplibregl.Map({ container: container.current, style: createMapStyle(), interactive: false, attributionControl: false })
    } catch {
      setAvailable(false)
      return
    }
    map.on('webglcontextlost', () => {
      setAvailable(false)
    })
    map.on('error', (event) => {
      if (settings.current.relief && isTerrainError(event)) settings.current.onFailure()
    })
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'USDOT · Natural Earth' }))
    // On phones the credits start collapsed (one ⓘ); MapLibre opens them on load, which covered a third of the small 3D panel.
    map.once('load', () => {
      if (window.innerWidth < 760) container.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
    })
    const points = [...data.main.path, ...(data.branch?.path ?? [])]
    const bounds = points.reduce((bounds, point) => bounds.extend(point), new maplibregl.LngLatBounds(points[0], points[0]))
    const fit = () => {
      if (settings.current.relief)
        map.jumpTo({
          center: currentPosition.current.point,
          bearing: currentPosition.current.heading,
          pitch: 62,
          zoom: data.main.miles > 100 ? 13 : 13.7,
        })
      else {
        map.jumpTo({ pitch: 0, bearing: 0 })
        map.fitBounds(bounds, { padding: 18, duration: 0 })
      }
    }
    frameView.current = fit
    const resize = new ResizeObserver(() => {
      map.resize()
      fit()
    })
    resize.observe(container.current)
    let current = data.main.path[0]
    let gap = false
    const pointFeature = () => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: current } })
    const update: PositionSink = (point, inGap, route, mile) => {
      const ahead = coordinateAtMile(route, Math.min(route.miles, mile + 0.3))
      const behind = coordinateAtMile(route, Math.max(0, mile - 0.3))
      const target = bearing(mile >= route.miles ? behind : point, ahead)
      const previous = currentPosition.current.heading
      const heading = settings.current.motion
        ? previous +
          ((Math.atan2(Math.sin(((target - previous) * Math.PI) / 180), Math.cos(((target - previous) * Math.PI) / 180)) * 180) / Math.PI) *
            0.15
        : target
      currentPosition.current = { point, heading }
      if (settings.current.relief) {
        fit()
        car3d.current?.update(point, target)
      }
      current = point
      gap = inGap
      const source = map.getSource('car') as GeoJSONSource | undefined
      if (source) {
        source.setData(pointFeature())
        map.setPaintProperty('car', 'circle-opacity', gap ? 0.3 : 1)
      }
    }
    registerPosition(update)
    map.on('load', () => {
      const lines = (route: StripPath) =>
        mappedIntervals(route).map(([from, to]) => [
          coordinateAtMile(route, from),
          ...route.path.filter((_, i) => route.cumMiles[i] > from && route.cumMiles[i] < to),
          coordinateAtMile(route, to),
        ])
      map.addSource('road', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'MultiLineString',
            coordinates: [...lines(data.main), ...(data.branch ? lines(data.branch) : [])],
          },
        },
      })
      map.addLayer({ id: 'road-edge', type: 'line', source: 'road', paint: { 'line-color': '#202925', 'line-width': 4 } })
      map.addLayer({
        id: 'road',
        type: 'line',
        source: 'road',
        paint: { 'line-color': palette()(`route-${scene === 'coast' || scene === 'river' ? 'water' : scene}`), 'line-width': 2 },
      })
      map.addSource('car', { type: 'geojson', data: pointFeature() })
      map.addLayer({
        id: 'car',
        type: 'circle',
        source: 'car',
        paint: {
          'circle-radius': 5,
          'circle-color': '#3f4b30',
          'circle-stroke-color': '#fffdf8',
          'circle-stroke-width': 2,
          'circle-opacity': gap ? 0.3 : 1,
        },
      })
      fit()
      setReady(map)
      if (import.meta.env.DEV)
        window.__rambleroo3d = {
          center: () => map.getCenter().toArray(),
          car: () => !!map.getLayer('garage-car-3d'),
        }
    })
    return () => {
      setReady(undefined)
      if (import.meta.env.DEV) delete window.__rambleroo3d
      resize.disconnect()
      registerPosition(undefined)
      map.remove()
    }
  }, [data, registerPosition, scene])
  useEffect(() => {
    if (!ready) return
    setRelief(ready, relief)
    ready.setLayoutProperty('car', 'visibility', relief ? 'none' : 'visible')
    ready.resize()
    frameView.current()
  }, [ready, relief])
  useEffect(() => {
    if (!ready || !relief || !available) return
    let active = true
    let remove = () => {}
    void import('../map/car3d')
      .then(({ createCarLayer, carLayerId }) => {
        if (!active) return
        const { point, heading } = currentPosition.current
        const car = createCarLayer(garage, point, heading)
        ready.addLayer(car.layer)
        car3d.current = car
        remove = () => {
          car3d.current = undefined
          if (ready.getLayer(carLayerId)) ready.removeLayer(carLayerId)
        }
      })
      .catch(() => {
        if (active) settings.current.onFailure()
      })
    return () => {
      active = false
      remove()
    }
  }, [ready, relief, garage, available])
  useEffect(() => {
    if (relief && !available) onFailure()
  }, [relief, available, onFailure])
  if (!available) {
    const points = [...data.main.path, ...(data.branch?.path ?? [])]
    const west = Math.min(...points.map((p) => p[0])),
      east = Math.max(...points.map((p) => p[0]))
    const south = Math.min(...points.map((p) => p[1])),
      north = Math.max(...points.map((p) => p[1]))
    const project = (p: Coordinate) =>
      `${10 + ((p[0] - west) / (east - west || 1)) * 100},${110 - ((p[1] - south) / (north - south || 1)) * 100}`
    return (
      <aside className={s.inset} aria-label="Real road map" data-testid="strip-inset">
        <svg viewBox="0 0 120 120" role="img" aria-label="Flat road overview">
          {[data.main, ...(data.branch ? [data.branch] : [])].map((route, i) => (
            <polyline key={i} points={route.path.map(project).join(' ')} fill="none" stroke="var(--forest)" strokeWidth="2" />
          ))}
        </svg>
      </aside>
    )
  }
  return (
    <aside
      className={`${s.inset} ${expanded ? s.expanded : ''} ${relief ? s.reliefMap : ''}`}
      aria-label={relief ? '3D scroll-to-drive map' : 'Real road map'}
      data-testid={relief ? 'strip-3d' : 'strip-inset'}
    >
      <div ref={container} className={s.map} aria-hidden="true" />
      {!relief && (
        <button
          className={s.mapToggle}
          aria-expanded={expanded}
          aria-label={expanded ? 'Shrink road map' : 'Expand road map'}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Close map ↙' : 'Real road ↗'}
        </button>
      )}
      <small className={s.mapCredit}>USDOT · Natural Earth</small>
    </aside>
  )
}
