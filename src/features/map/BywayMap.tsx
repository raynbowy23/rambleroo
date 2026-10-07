import { ReliefControls } from './ReliefControls'
import { useEffect, useRef, useState } from 'react'
import maplibregl from './maplibre'
import type { Map } from './maplibre'
import type { BywaySummary } from '../../lib/types'
import { useMotionEnabled } from '../../lib/motion'
import { createMapStyle } from './style'
import { bindBasemapFallback, basemapService } from './basemap'
import { addBywayLayers, filteredLayers, loadBywayGeometry } from './layers'
import { addDecor } from './decor'
import { strokes } from './routeArt'
import { animateSelection, setMomentPins } from './selection'
import type { StoryMoment } from './selection'
import { profileRouteFrames } from './profile'
import { useHover } from './hover'
import { Compass } from '../../components/art'
import { WaterLabels } from './WaterLabels'
import styles from './Map.module.css'
export { createMapStyle } from './style'
/** Gentle ease for the zoom buttons: slow off the mark, slow into place. */
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const regions: Record<string, [number, number, number, number]> = {
  'Lower 48': [-125, 24, -66, 50],
  Alaska: [-179, 51, -129, 72],
  Hawaii: [-161, 18, -154, 23],
}
export function BywayMap({
  byways,
  selected,
  ids,
  onSelect,
  onFailure,
  moments,
}: {
  moments?: StoryMoment[]
  byways: BywaySummary[]
  selected?: BywaySummary
  ids: string[] | null
  onSelect: (id: string | null) => void
  onFailure: () => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const ref = useRef<Map | null>(null)
  const [ready, setReady] = useState(false)
  const [padding, setPadding] = useState({ top: 100, bottom: 260, left: 390, right: 40 })
  useEffect(() => {
    const root = container.current?.parentElement
    if (!root) return
    const measure = () => {
      const mobile = window.innerWidth < 760
      const panel = root.querySelector<HTMLElement>(`[data-map-panel="${selected ? 'postcard' : 'search'}"]`)
      const height = root.clientHeight
      const width = root.clientWidth
      const panelHeight = panel?.getBoundingClientRect().height ?? 270
      // Reserve the space actually covered by the search panel (left) and the postcard (right), measured rather than assumed.
      const search = root.querySelector<HTMLElement>('[data-map-panel="search"]')
      const searchRight = search && search.offsetParent ? search.getBoundingClientRect().right - root.getBoundingClientRect().left : 0
      let left = mobile ? 25 : Math.max(40, searchRight + 30)
      let right = mobile ? 25 : selected ? (panel?.offsetWidth ?? 320) + (width > 1100 ? 130 : 40) : 40
      // Always leave at least 180px of open map for the road, shrinking both sides proportionally if needed.
      const overflow = left + right - (width - 180)
      if (overflow > 0) {
        const k = (width - 180) / (left + right)
        left = Math.round(left * k)
        right = Math.round(right * k)
      }
      setPadding({
        top: mobile ? 70 : 100,
        bottom: mobile ? Math.min(panelHeight + 20, height - 120) : 170,
        left,
        right,
      })
      root.style.setProperty('--sheet-height', `${panelHeight}px`)
      root.style.setProperty('--mobile-controls', panelHeight > height - 70 ? 'none' : 'flex')
    }
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    root.querySelectorAll('[data-map-panel]').forEach((panel) => observer.observe(panel))
    measure()
    return () => observer.disconnect()
  }, [selected])
  const enabled = useMotionEnabled()
  // Phones: the road card covers the map when it opens, so the car's first run goes unseen. Scrolling or swiping the card replays
  // the drive (at most every 2.5 s, never mid-run) while the road shows above the card.
  const [replay, setReplay] = useState(0)
  useEffect(() => {
    const root = container.current?.parentElement
    if (!root || !selected || !enabled) return
    let last = performance.now()
    const again = () => {
      if (window.innerWidth >= 760 || performance.now() - last < 2500) return
      last = performance.now()
      setReplay((n) => n + 1)
    }
    root.addEventListener('scroll', again, { capture: true, passive: true })
    root.addEventListener('touchmove', again, { passive: true })
    return () => {
      root.removeEventListener('scroll', again, { capture: true })
      root.removeEventListener('touchmove', again)
    }
  }, [selected, enabled])
  const hovered = useHover((s) => s.id)
  const callbacks = useRef({ onSelect, onFailure })
  const goHome = useRef(false)
  callbacks.current = { onSelect, onFailure }
  useEffect(() => {
    if (!container.current) return
    const started = performance.mark('byways:map-start')
    let disposed = false
    const geometry = loadBywayGeometry()
    // Attach a rejection handler immediately while the style initializes.
    void geometry.catch(() => {})
    let stopProfile = () => {}
    let map: Map
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: createMapStyle(),
        center: [-98, 38],
        zoom: 3,
        maxPitch: 70,
        attributionControl: false,
      })
    } catch {
      callbacks.current.onFailure()
      return
    }
    bindBasemapFallback(map)
    // Development-only handle for debugging map layers from the browser console.
    if (import.meta.env.DEV) (window as unknown as { __rambleMap?: Map }).__rambleMap = map
    ref.current = map
    map.addControl(
      new maplibregl.AttributionControl({ compact: true, customAttribution: `Natural Earth · USDOT · ${basemapService.attribution}` }),
      'bottom-left',
    )
    const tooltip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 })
    map.on('webglcontextlost', () => {
      if (!disposed) callbacks.current.onFailure()
    })
    // Source errors (including offline vector tiles) must not replace the local map.
    map.on('error', (event) => {
      if (import.meta.env.DEV) console.warn('[map]', event.error?.message ?? event)
    })
    map.once('style.load', () => {
      performance.mark('byways:style-ready')
      void geometry
        .then((data) => {
          if (disposed) return
          addDecor(map)
          addBywayLayers(map, data, byways)
          performance.mark('byways:attached')
          const firstRoutes = () => {
            if (!map.queryRenderedFeatures({ layers: ['byway-lines', 'byway-art'] }).length) return
            performance.mark('byways:first-render')
            performance.measure('byways:visible', { start: started.startTime, end: 'byways:first-render' })
            map.off('render', firstRoutes)
          }
          map.on('render', firstRoutes)
          stopProfile = profileRouteFrames(map)
          setReady(true)
          map.fitBounds(regions['Lower 48'], {
            padding:
              window.innerWidth < 760 ? { top: 80, bottom: 260, left: 25, right: 25 } : { top: 100, bottom: 260, left: 390, right: 60 },
            duration: 0,
          })
          map.on('mousemove', 'byway-hit', (e) => {
            const f = e.features?.[0]
            if (!f) return
            const id = String(f.properties.id)
            useHover.getState().setId(id)
            map.getCanvas().style.cursor = 'pointer'
            tooltip.setLngLat(e.lngLat).setText(String(f.properties.name)).addTo(map)
          })
          map.on('mouseleave', 'byway-hit', () => {
            useHover.getState().setId(null)
            tooltip.remove()
            map.getCanvas().style.cursor = ''
          })
          map.on('mousemove', 'route-moments', (e) => {
            const moment = e.features?.[0]
            if (!moment) return
            map.getCanvas().style.cursor = 'pointer'
            tooltip.setLngLat(e.lngLat).setText(String(moment.properties.title)).addTo(map)
          })
          map.on('mouseleave', 'route-moments', () => {
            tooltip.remove()
            map.getCanvas().style.cursor = ''
          })
          map.on('click', (e) => {
            const feature = map.queryRenderedFeatures(e.point, { layers: ['byway-hit', 'byway-marks', 'story-points', 'route-moments'] })[0]
            // A click on open map (not a road) goes back to the whole country; the card's close button keeps the view instead.
            if (!feature) goHome.current = true
            callbacks.current.onSelect(feature ? String(feature.properties.id) : null)
          })
        })
        .catch(() => {
          if (!disposed) callbacks.current.onFailure()
        })
    })
    return () => {
      disposed = true
      tooltip.remove()
      stopProfile()
      map.remove()
      ref.current = null
      setReady(false)
    }
  }, [byways])
  useEffect(() => {
    const map = ref.current
    if (!ready || !map) return
    let frame = 0
    if (hovered) {
      map.setFeatureState({ source: 'byways', id: hovered }, { hover: true })
      const start = performance.now()
      const pulse = (now: number) => {
        const progress = Math.min(1, (now - start) / 260)
        map.setPaintProperty('byway-hover', 'line-width', 4 + Math.sin(progress * Math.PI) * 2)
        if (progress < 1) frame = requestAnimationFrame(pulse)
      }
      if (enabled) pulse(start)
      else map.setPaintProperty('byway-hover', 'line-width', 4)
    }
    return () => {
      cancelAnimationFrame(frame)
      if (hovered && ref.current === map) map.setFeatureState({ source: 'byways', id: hovered }, { hover: false })
    }
  }, [hovered, ready, enabled])
  useEffect(() => {
    const map = ref.current
    if (!ready || !map) return
    for (const layer of filteredLayers) map.setFilter(layer, ids ? ['in', ['get', 'id'], ['literal', ids]] : null)
  }, [ids, ready])
  useEffect(() => {
    const map = ref.current
    if (!ready || !map) return
    // Closing the card leaves the last road drawn, with its car parked at the end, until another road is picked. A click on open
    // map clears it and flies back to the whole country.
    if (!selected) {
      if (!goHome.current) return
      goHome.current = false
      animateSelection(map, [], enabled)
      map.fitBounds(regions['Lower 48'], {
        padding: window.innerWidth < 760 ? { top: 80, bottom: 260, left: 25, right: 25 } : { top: 100, bottom: 260, left: 390, right: 60 },
        linear: false,
        curve: 1.3,
        maxDuration: 2200,
        ...(enabled ? {} : { duration: 0 }),
      })
      return
    }
    let cancelled = false
    let stop = () => {}
    void loadBywayGeometry().then((data) => {
      if (cancelled) return
      const features = data.features.filter((f) => f.properties.id === selected.id)
      // Drive only once the camera has arrived, so the whole run is on screen.
      const run = () => {
        if (!cancelled) stop = animateSelection(map, features, enabled)
      }
      // The card's size is measured a moment after it opens and the camera may re-frame once, so wait until it is truly still.
      let timer = 0
      const settle = () => {
        timer = window.setTimeout(() => (map.isMoving() ? map.once('moveend', settle) : run()), 120)
      }
      if (map.isMoving()) map.once('moveend', settle)
      else settle()
      const previous = stop
      stop = () => {
        window.clearTimeout(timer)
        map.off('moveend', settle)
        previous()
      }
    })
    return () => {
      cancelled = true
      stop()
    }
  }, [selected, enabled, ready, replay])
  useEffect(() => {
    const map = ref.current
    if (!ready || !map) return
    setMomentPins(map, selected && selected.status !== 'listing' ? selected.id : undefined, moments ?? [])
  }, [selected, moments, ready])
  // Frame a road only when a different road is picked. Closing the card, or dragging the sheet (which changes the padding), keeps
  // whatever view the reader has zoomed to.
  const framed = useRef<string | undefined>(undefined)
  const framedAt = useRef(0)
  useEffect(() => {
    const map = ref.current
    if (!ready || !map) return
    if (!selected) {
      framed.current = undefined
      return
    }
    if (framed.current !== selected.id) {
      framed.current = selected.id
      framedAt.current = performance.now()
    } else if (performance.now() - framedAt.current > 700) return
    map.fitBounds(selected.bbox, {
      padding: {
        top: Math.max(64, padding.top),
        bottom: Math.max(64, padding.bottom),
        left: Math.max(64, padding.left),
        right: Math.max(64, padding.right),
      },
      maxZoom: 8,
      // Fly rather than slide: zoom out, glide over, zoom back in, like turning to another page of the atlas.
      linear: false,
      curve: 1.3,
      speed: 1.1,
      maxDuration: 2200,
      ...(enabled ? {} : { duration: 0 }),
    })
  }, [selected, enabled, ready, padding])
  return (
    <>
      <div ref={container} className={styles.map} aria-label="Scenic byways map" />
      {ready && ref.current && <WaterLabels map={ref.current} />}
      <div data-map-decoration className={`${styles.cartouche} ${selected ? styles.selectedCartouche : ''}`}>
        <span className="kicker">Rambleroo · Est. 2026</span>
        <h2>America’s scenic byways</h2>
      </div>
      <div data-map-decoration className={`${styles.compass} ${selected ? styles.selectedCompass : ''}`}>
        <Compass size={70} />
      </div>
      <div data-map-decoration className={`${styles.controls} ${selected ? styles.selectedControls : ''}`}>
        {ready && ref.current && <ReliefControls map={ref.current} roadId={selected?.id} />}
        <button
          className="btn btn-ghost"
          aria-label="Zoom in"
          onClick={() => ref.current?.zoomIn({ duration: enabled ? 600 : 0, easing: easeInOut })}
        >
          +
        </button>
        <button
          className="btn btn-ghost"
          aria-label="Zoom out"
          onClick={() => ref.current?.zoomOut({ duration: enabled ? 600 : 0, easing: easeInOut })}
        >
          −
        </button>
        <select
          aria-label="Jump to region"
          value=""
          onChange={(event) => {
            const bounds = regions[event.target.value]
            if (bounds)
              ref.current?.fitBounds(bounds, { padding, linear: false, curve: 1.3, maxDuration: 2200, ...(enabled ? {} : { duration: 0 }) })
          }}
        >
          <option value="" disabled>
            Jump to
          </option>
          {Object.keys(regions).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div data-map-decoration className={styles.legend}>
        {strokes.map((stroke) => (
          <span className={styles.legendItem} key={stroke.family}>
            <svg
              width="32"
              height="16"
              viewBox="0 0 32 16"
              aria-hidden="true"
              style={{ color: `var(--map-${stroke.color}, var(--${stroke.color}))` }}
            >
              {/* The same motif the map draws on each road, so the key matches what you see when zoomed in. */}
              <path d={stroke.path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {stroke.fill && <path d={stroke.fill} fill="currentColor" />}
            </svg>
            {stroke.label}
          </span>
        ))}
        <span className={styles.legendItem}>
          <b aria-hidden="true">●</b>Has a story
        </span>
      </div>
    </>
  )
}
