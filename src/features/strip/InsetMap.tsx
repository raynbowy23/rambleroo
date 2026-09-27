import { useEffect, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource, type Map } from '../map/maplibre'
import { createMapStyle } from '../map/style'
import { coordinateAtMile, mappedIntervals } from './geometry'
import type { Coordinate, StripData, StripPath } from './types'
import s from './Strip.module.css'

export type PositionSink = (point: Coordinate, inGap: boolean) => void
export function InsetMap({ data, registerPosition }: { data: StripData; registerPosition: (sink: PositionSink | undefined) => void }) {
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
    map.on('webglcontextlost', () => setAvailable(false))
    const points = [...data.main.path, ...(data.branch?.path ?? [])]
    const bounds = points.reduce((bounds, point) => bounds.extend(point), new maplibregl.LngLatBounds(points[0], points[0]))
    const fit = () => map.fitBounds(bounds, { padding: 18, duration: 0 })
    const resize = new ResizeObserver(() => {
      map.resize()
      fit()
    })
    resize.observe(container.current)
    let current = data.main.path[0]
    let gap = false
    const pointFeature = () => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: current } })
    const update = (point: Coordinate, inGap: boolean) => {
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
      map.addLayer({ id: 'road', type: 'line', source: 'road', paint: { 'line-color': '#d95f1e', 'line-width': 2 } })
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
    })
    return () => {
      resize.disconnect()
      registerPosition(undefined)
      map.remove()
    }
  }, [data, registerPosition])
  if (!available) return null
  return (
    <aside className={`${s.inset} ${expanded ? s.expanded : ''}`} aria-label="Real road map">
      <div ref={container} className={s.map} aria-hidden="true" />
      <button
        className={s.mapToggle}
        aria-expanded={expanded}
        aria-label={expanded ? 'Shrink road map' : 'Expand road map'}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Close map ↙' : 'Real road ↗'}
      </button>
      <small className={s.mapCredit}>USDOT · Natural Earth</small>
    </aside>
  )
}
