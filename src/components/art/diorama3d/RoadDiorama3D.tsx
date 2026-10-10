import { useEffect, useRef, useState } from 'react'
import { useGarage } from '../../../lib/garage'
import type { DioramaSpec } from './spec'
import { buildScene, type Conditions } from './scene'
import { registerScene, MAX_ZOOM, MIN_ZOOM } from './renderer'
import { DRAG_RADIANS_PER_PX } from './route'
import './diorama3d.css'

export function RoadDiorama3D({ spec, conditions }: { spec: DioramaSpec; conditions: Conditions }) {
  const element = useRef<HTMLDivElement>(null),
    controller = useRef<ReturnType<typeof registerScene> | null>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  // Pointers on the miniature, so two fingers pinch to zoom while one finger turns it.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<number | null>(null)
  const zoom = useRef(1)
  const [zoomLevel, setZoomLevel] = useState(1)
  const zoomBy = (factor: number) => {
    zoom.current = controller.current?.zoomBy(factor) ?? zoom.current
    setZoomLevel(zoom.current)
  }
  const garage = useGarage()
  const [error, setError] = useState(false),
    [visible, setVisible] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    observer.observe(element.current!)
    return () => observer.disconnect()
  }, [])
  // The wheel zooms only once the reader has picked up the miniature (clicked or tabbed to it), so scrolling past it still scrolls
  // the page; a trackpad pinch (a wheel event with ctrlKey) zooms straight away. React's wheel handler is passive, hence the listener.
  useEffect(() => {
    const el = element.current!
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && document.activeElement !== el) return
      e.preventDefault()
      zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])
  useEffect(() => {
    if (!visible) return
    const built = buildScene(spec, garage, conditions)
    try {
      controller.current = registerScene(element.current!, built)
      controller.current.zoomBy(zoom.current)
      setError(false)
    } catch {
      built.dispose()
      setError(true)
    }
    return () => {
      controller.current?.dispose()
      controller.current = null
    }
  }, [visible, spec, garage, conditions.hour, conditions.season, conditions.weather])
  return (
    <div
      ref={element}
      className="rr-mini-view"
      tabIndex={0}
      role="group"
      aria-label={`${spec.title}. ${spec.landmarks.map((l) => l.name).join(', ')}. Drag or use the arrow keys to turn and tilt the miniature; pinch, the plus and minus keys, or the zoom buttons move in and out.`}
      onPointerDown={(e) => {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        e.currentTarget.setPointerCapture(e.pointerId)
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()]
          pinch.current = Math.hypot(a.x - b.x, a.y - b.y)
          drag.current = null
          return
        }
        drag.current = { x: e.clientX, y: e.clientY }
        controller.current?.grab()
      }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId)) return
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (pinch.current !== null && pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()]
          const distance = Math.hypot(a.x - b.x, a.y - b.y)
          if (pinch.current > 0) zoomBy(distance / pinch.current)
          pinch.current = distance
          return
        }
        if (drag.current === null) return
        controller.current?.rotateBy((e.clientX - drag.current.x) * DRAG_RADIANS_PER_PX)
        controller.current?.tiltBy((e.clientY - drag.current.y) * DRAG_RADIANS_PER_PX * 0.35)
        drag.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId)
        pinch.current = null
        drag.current = null
        controller.current?.release()
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId)
        pinch.current = null
        drag.current = null
        controller.current?.release()
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          controller.current?.tiltBy(((e.key === 'ArrowUp' ? -1 : 1) * Math.PI) / 60)
        }
        if (e.key === '+' || e.key === '=' || e.key === '-') {
          e.preventDefault()
          zoomBy(e.key === '-' ? 1 / 1.25 : 1.25)
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault()
          controller.current?.rotateBy((e.key === 'ArrowLeft' ? -1 : 1) * (Math.PI / 12))
        }
      }}
    >
      <div className="rr-mini-zoom" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Zoom in" disabled={zoomLevel >= MAX_ZOOM} onClick={() => zoomBy(1.25)}>
          +
        </button>
        <button type="button" aria-label="Zoom out" disabled={zoomLevel <= MIN_ZOOM} onClick={() => zoomBy(1 / 1.25)}>
          −
        </button>
      </div>
      {error && <p role="status">This miniature needs WebGL. Its landmarks are listed below.</p>}
    </div>
  )
}
