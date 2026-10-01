import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource, type Map } from '../map/maplibre'
import { setRelief, isTerrainError, terrainSource } from '../map/terrain'
import { bearing } from '../map/routeJourney'
import { useGarage } from '../../lib/garage'
import { useMotionEnabled } from '../../lib/motion'
import type { createCarLayer } from '../map/car3d'
import { createMapStyle, palette } from '../map/style'
import { bindBasemapFallback, basemapService, placeFont } from '../map/basemap'
import { clamp, coordinateAtMile, mappedIntervals } from './geometry'
import type { Coordinate, StripData, StripPath } from './types'
import s from './Strip.module.css'
import type { BywaySummary } from '../../lib/types'
import { bindMapGestures, defaultView, type ViewOffsets } from './mapGestures'
import { MapPins, type PinPosition } from './MapPins'
import { applySeasonStyle, seasonalTerrain, seasonProfile, seasonLabel, seasons, type Season } from './seasonStyle'
import { SeasonalWeather } from './SeasonalWeather'

export type PositionSink = (point: Coordinate, inGap: boolean, route: StripPath, mile: number) => void

declare global {
  interface Window {
    __rambleroo3d?: {
      center: () => number[]
      car: () => boolean
      zoom: () => number
      bearing: () => number
      offsets: () => ViewOffsets
      season: () => Season
      climate: () => string
      landColor: () => unknown
    }
  }
}
export function InsetMap({
  data,
  byway,
  registerPosition,
  relief,
  scene,
  onFailure,
  season,
  onSeasonChange,
}: {
  data: StripData
  byway: BywaySummary
  registerPosition: (sink: PositionSink | undefined) => void
  relief: boolean
  scene: string
  season: Season
  onSeasonChange: (season: Season) => void
  onFailure: () => void
}) {
  const [elevation, setElevation] = useState<number>()
  const profile = useMemo(() => seasonProfile(season, byway, elevation), [season, byway, elevation])
  const currentProfile = useRef(profile)
  currentProfile.current = profile
  const offsets = useRef(defaultView())
  const [adjusted, setAdjusted] = useState(false)
  const [hint, setHint] = useState(true)
  const surface = useRef<HTMLElement>(null)
  const pinPosition = useRef<PinPosition>({ on: 'main', mile: 0 })
  const updatePins = useRef<() => void>(() => {})
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
      map = new maplibregl.Map({
        container: container.current,
        style: createMapStyle(),
        interactive: false,
        attributionControl: false,
        maxPitch: 75,
      })
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
    bindBasemapFallback(map)
    map.addControl(
      new maplibregl.AttributionControl({ compact: true, customAttribution: `USDOT · Natural Earth · ${basemapService.attribution}` }),
    )
    // In a small panel (phones, the 2D inset beside the ribbon) the credits start collapsed to one ⓘ; MapLibre opens them on load, which covered a third of the map.
    map.once('load', () => {
      if ((container.current?.clientWidth ?? 0) < 520)
        container.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
    })
    const points = [...data.main.path, ...(data.branch?.path ?? [])]
    const bounds = points.reduce((bounds, point) => bounds.extend(point), new maplibregl.LngLatBounds(points[0], points[0]))
    const fit = () => {
      const offset = offsets.current
      if (settings.current.relief)
        map.jumpTo({
          center: currentPosition.current.point,
          bearing: currentPosition.current.heading + offset.bearing,
          pitch: clamp(62 + offset.pitch, 30, 75),
          zoom: clamp((data.main.miles > 100 ? 13 : 13.7) + offset.zoom, map.getMinZoom(), map.getMaxZoom()),
        })
      else {
        const camera = map.cameraForBounds(bounds, { padding: 18 })
        if (camera)
          map.jumpTo({
            center: offset.zoom || offset.bearing ? currentPosition.current.point : camera.center,
            zoom: clamp((camera.zoom ?? map.getZoom()) + offset.zoom, map.getMinZoom(), map.getMaxZoom()),
            pitch: 0,
            bearing: offset.bearing,
          })
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
      pinPosition.current = { on: route === data.branch ? 'branch' : 'main', mile }
      updatePins.current()
      if (settings.current.relief || offsets.current.zoom || offsets.current.bearing) fit()
      if (settings.current.relief) {
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
    fit()
    map.once('style.load', () => {
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
      map.addLayer({
        id: 'road-edge',
        type: 'line',
        source: 'road',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': palette()('paper'), 'line-width': 9 },
      })
      map.addLayer({
        id: 'road',
        type: 'line',
        source: 'road',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': palette()(`route-${scene === 'coast' || scene === 'river' ? 'water' : scene}`), 'line-width': 5 },
      })
      map.addSource('strip-towns', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: data.towns
            .filter((town) => town.kind !== 'landmark')
            .map((town) => ({
              type: 'Feature',
              properties: { name: town.name },
              geometry: { type: 'Point', coordinates: town.at },
            })),
        },
      })
      map.addLayer({
        id: 'strip-town-labels',
        type: 'symbol',
        source: 'strip-towns',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': placeFont,
          'text-size': 14,
          'text-anchor': 'top',
          'text-offset': [0, 1.2],
          'text-padding': 8,
        },
        paint: { 'text-color': palette()('ink'), 'text-halo-color': palette()('paper'), 'text-halo-width': 2 },
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
          zoom: () => map.getZoom(),
          bearing: () => map.getBearing(),
          offsets: () => ({ ...offsets.current }),
          season: () => currentProfile.current.season,
          climate: () => currentProfile.current.climate,
          landColor: () => landColor(map),
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
    if (!relief && ready.getLayer(seasonalTerrain)) ready.removeLayer(seasonalTerrain)
    setRelief(ready, relief)
    ready.setLayoutProperty('car', 'visibility', relief ? 'none' : 'visible')
    ready.resize()
    frameView.current()
  }, [ready, relief])
  useEffect(() => {
    if (!ready) return
    applySeasonStyle(ready, profile, relief)
    car3d.current?.setSnow(profile.snowy)
  }, [ready, profile, relief])
  useEffect(() => {
    if (!ready || !relief) return
    const sample = () => {
      if (!ready.isSourceLoaded(terrainSource)) return
      const height = ready.queryTerrainElevation(currentPosition.current.point)
      if (height !== null) setElevation(Math.round(height / (ready.getTerrain()?.exaggeration ?? 1)))
    }
    ready.on('idle', sample)
    return () => {
      ready.off('idle', sample)
    }
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
        car.setSnow(currentProfile.current.snowy)
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
  const adjust = (delta: Partial<ViewOffsets>) => {
    const previous = offsets.current
    offsets.current = {
      zoom: clamp(previous.zoom + (delta.zoom ?? 0), -6, 6),
      bearing: ((((previous.bearing + (delta.bearing ?? 0)) % 360) + 540) % 360) - 180,
      pitch: relief ? clamp(previous.pitch + (delta.pitch ?? 0), -32, 13) : previous.pitch,
    }
    setAdjusted(Object.values(offsets.current).some((value) => value !== 0))
    setHint(false)
    frameView.current()
  }
  const gestureAdjust = useRef(adjust)
  gestureAdjust.current = adjust
  useEffect(() => {
    if (!surface.current || !available) return
    return bindMapGestures(surface.current, (delta) => gestureAdjust.current(delta))
  }, [available])
  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => setHint(false), 6000)
    return () => clearTimeout(timer)
  }, [ready])
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
      ref={surface}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget && event.target !== ready?.getCanvas()) return
        const delta =
          event.key === '+' || event.key === '='
            ? { zoom: 0.5 }
            : event.key === '-'
              ? { zoom: -0.5 }
              : event.key === '['
                ? { bearing: -15 }
                : event.key === ']'
                  ? { bearing: 15 }
                  : undefined
        if (delta) {
          event.preventDefault()
          adjust(delta)
        }
      }}
      className={`${s.inset} ${expanded ? s.expanded : ''} ${relief ? s.reliefMap : ''}`}
      aria-label={relief ? '3D scroll-to-drive map' : 'Real road map'}
      data-testid={relief ? 'strip-3d' : 'strip-inset'}
    >
      <div ref={container} className={s.map} />
      {relief && motion && profile.weather && <SeasonalWeather kind={profile.weather} />}
      {relief && (
        <button
          className={s.seasonChip}
          aria-label={`Change map season: ${seasonLabel(profile, byway.region)}`}
          onClick={() => onSeasonChange(seasons[(seasons.indexOf(season) + 1) % seasons.length])}
        >
          {seasonLabel(profile, byway.region)}
        </button>
      )}
      {ready && <MapPins map={ready} data={data} byway={byway} position={pinPosition} updatePins={updatePins} />}
      <div className={s.mapControls} role="group" aria-label="Map view controls">
        <button aria-label="Zoom in" onClick={() => adjust({ zoom: 0.5 })}>
          +
        </button>
        <button aria-label="Zoom out" onClick={() => adjust({ zoom: -0.5 })}>
          −
        </button>
        <button aria-label="Rotate left" onClick={() => adjust({ bearing: -15 })}>
          ↶
        </button>
        <button aria-label="Rotate right" onClick={() => adjust({ bearing: 15 })}>
          ↷
        </button>
        {adjusted && (
          <button
            className={s.resetView}
            onClick={() => {
              offsets.current = defaultView()
              setAdjusted(false)
              frameView.current()
            }}
          >
            Reset view
          </button>
        )}
      </div>
      <div className={`${s.mapHint} ${hint ? '' : s.hintHidden}`} aria-hidden="true">
        Ctrl + scroll to zoom · Ctrl + drag to rotate
      </div>
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
      {/* MapLibre's attribution control credits the live map; this line is only for the flat fallback without WebGL. */}
      {!available && <small className={s.mapCredit}>USDOT · Natural Earth</small>}
    </aside>
  )
}

function landColor(map: Map) {
  const paint = map.getPaintProperty('land', 'fill-color')
  return Array.isArray(paint) ? paint[3] : paint
}
