import { useEffect, useRef, useState } from 'react'
import maplibregl from './maplibre'
import type { GeoJSONSource, Map } from './maplibre'
import type { BywaySummary } from '../../lib/types'
import { useMotionEnabled } from '../../lib/motion'
import { createMapStyle, palette } from './style'
import { addBywayLayers, loadBywayGeometry } from './layers'
import { addDecor } from './decor'
import { useHover } from './hover'
import { Compass } from '../../components/art'
import { WaterLabels } from './WaterLabels'
import styles from './Map.module.css'
export { createMapStyle } from './style'
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
}: {
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
      const panelHeight = panel?.getBoundingClientRect().height ?? 270
      setPadding({
        top: mobile ? 70 : 100,
        bottom: mobile ? Math.min(panelHeight + 20, height - 120) : 170,
        left: mobile || (selected && window.innerWidth <= 1100) ? 25 : 390,
        right: mobile ? 25 : selected ? (panel?.offsetWidth ?? 320) + 130 : 40,
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
  const hovered = useHover((s) => s.id)
  const callbacks = useRef({ onSelect, onFailure })
  callbacks.current = { onSelect, onFailure }
  useEffect(() => {
    if (!container.current) return
    let disposed = false
    let loaded = false
    let map: Map
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: createMapStyle(),
        center: [-98, 38],
        zoom: 3,
        attributionControl: false,
      })
    } catch {
      callbacks.current.onFailure()
      return
    }
    ref.current = map
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Natural Earth · USDOT' }), 'bottom-left')
    const tooltip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 })
    map.on('error', () => {
      if (!loaded && !disposed) callbacks.current.onFailure()
    })
    map.on('load', () => {
      void loadBywayGeometry()
        .then((data) => {
          if (disposed) return
          addDecor(map)
          addBywayLayers(map, data, byways)
          loaded = true
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
          map.on('click', (e) => {
            const feature = map.queryRenderedFeatures(e.point, { layers: ['byway-hit', 'story-points'] })[0]
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
      map.remove()
      ref.current = null
      setReady(false)
    }
  }, [byways])
  useEffect(() => {
    const map = ref.current
    if (!ready || !map) return
    if (hovered) map.setFeatureState({ source: 'byways', id: hovered }, { hover: true })
    return () => {
      if (hovered && ref.current === map) map.setFeatureState({ source: 'byways', id: hovered }, { hover: false })
    }
  }, [hovered, ready])
  useEffect(() => {
    const map = ref.current
    if (!ready || !map) return
    for (const layer of ['byway-casing', 'byway-lines', 'byway-hit', 'story-points'])
      map.setFilter(layer, ids ? ['in', ['get', 'id'], ['literal', ids]] : null)
  }, [ids, ready])
  useEffect(() => {
    const map = ref.current
    if (!ready || !map) return
    let cancelled = false
    let frame = 0
    void loadBywayGeometry().then((data) => {
      if (cancelled) return
      const features = selected ? data.features.filter((f) => f.properties.id === selected.id) : []
      ;(map.getSource('selected') as GeoJSONSource).setData({ type: 'FeatureCollection', features })
      if (!selected) {
        map.fitBounds(regions['Lower 48'], { padding, duration: 0 })
        return
      }
      map.fitBounds(selected.bbox, {
        padding: {
          top: Math.max(64, padding.top),
          bottom: Math.max(64, padding.bottom),
          left: Math.max(64, padding.left),
          right: Math.max(64, padding.right),
        },
        maxZoom: 8,
        duration: enabled ? 800 : 0,
      })
      const gold = palette()('gold')
      const start = performance.now()
      const trace = (now: number) => {
        if (cancelled) return
        const progress = enabled ? Math.min(1, (now - start) / 800) : 1
        map.setPaintProperty('selected-line', 'line-gradient', [
          'step',
          ['line-progress'],
          gold,
          Math.max(0.00001, progress),
          'rgba(0,0,0,0)',
        ])
        if (progress < 1) frame = requestAnimationFrame(trace)
      }
      trace(start)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
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
        <button className="btn btn-ghost" aria-label="Zoom in" onClick={() => ref.current?.zoomIn({ duration: enabled ? 250 : 0 })}>
          +
        </button>
        <button className="btn btn-ghost" aria-label="Zoom out" onClick={() => ref.current?.zoomOut({ duration: enabled ? 250 : 0 })}>
          −
        </button>
        <select
          aria-label="Jump to region"
          value=""
          onChange={(event) => {
            const bounds = regions[event.target.value]
            if (bounds) ref.current?.fitBounds(bounds, { padding, duration: enabled ? 700 : 0 })
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
        <span>Lines by landscape</span>
        <i />
        River / coast <i />
        Mountain / forest <i />
        Desert <i />
        Town / prairie <b>●</b>Has a story
      </div>
    </>
  )
}
