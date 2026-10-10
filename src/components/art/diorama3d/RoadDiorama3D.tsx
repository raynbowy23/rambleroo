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
  // A one-finger or left-button drag turns and tilts; shift or the right button pans instead.
  const drag = useRef<{ x: number; y: number; pan: boolean } | null>(null)
  // Pointers on the miniature, so two fingers pinch to zoom and move together to pan while one finger turns it.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number; x: number; y: number } | null>(null)
  const zoom = useRef(1)
  const [zoomLevel, setZoomLevel] = useState(1)
  const zoomBy = (factor: number) => {
    zoom.current = controller.current?.zoomBy(factor) ?? zoom.current
    setZoomLevel(zoom.current)
  }
  // The view as a picture, with the road's name on a paper band beneath it, like a postcard caption.
  const download = () => {
    const view = controller.current?.snapshot()
    if (!view) return
    const band = Math.round(view.width * 0.09)
    const picture = document.createElement('canvas')
    picture.width = view.width
    picture.height = view.height + band
    const ctx = picture.getContext('2d')!
    ctx.fillStyle = '#f6ead3'
    ctx.fillRect(0, 0, picture.width, picture.height)
    ctx.drawImage(view, 0, 0)
    ctx.fillStyle = '#354738'
    ctx.textBaseline = 'middle'
    ctx.font = `${Math.round(band * 0.36)}px 'Fraunces Variable', Georgia, serif`
    ctx.fillText(spec.title, band * 0.4, view.height + band / 2, picture.width * 0.7)
    ctx.textAlign = 'right'
    ctx.globalAlpha = 0.7
    ctx.font = `${Math.round(band * 0.2)}px Georgia, serif`
    ctx.fillText('rambleroo.app', picture.width - band * 0.4, view.height + band / 2)
    picture.toBlob((blob) => {
      if (!blob) return
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${spec.bywayId}-miniature.png`
      link.click()
      setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    }, 'image/png')
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
      aria-label={`${spec.title}. ${spec.landmarks.map((l) => l.name).join(', ')}. Drag or use the arrow keys to turn and tilt the miniature; pinch, the plus and minus keys, or the zoom buttons move in and out; shift-drag, a two-finger drag or shift and the arrow keys move around once zoomed in.`}
      onPointerDown={(e) => {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        e.currentTarget.setPointerCapture(e.pointerId)
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()]
          pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
          drag.current = null
          return
        }
        drag.current = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 2 }
        controller.current?.grab()
      }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId)) return
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (pinch.current !== null && pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()]
          const distance = Math.hypot(a.x - b.x, a.y - b.y),
            x = (a.x + b.x) / 2,
            y = (a.y + b.y) / 2
          if (pinch.current.distance > 0) zoomBy(distance / pinch.current.distance)
          controller.current?.panBy(x - pinch.current.x, y - pinch.current.y)
          pinch.current = { distance, x, y }
          return
        }
        if (drag.current === null) return
        if (drag.current.pan) controller.current?.panBy(e.clientX - drag.current.x, e.clientY - drag.current.y)
        else {
          controller.current?.rotateBy((e.clientX - drag.current.x) * DRAG_RADIANS_PER_PX)
          controller.current?.tiltBy((e.clientY - drag.current.y) * DRAG_RADIANS_PER_PX * 0.35)
        }
        drag.current = { ...drag.current, x: e.clientX, y: e.clientY }
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
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.shiftKey && e.key.startsWith('Arrow')) {
          e.preventDefault()
          const step = 40
          controller.current?.panBy(
            e.key === 'ArrowLeft' ? step : e.key === 'ArrowRight' ? -step : 0,
            e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0,
          )
          return
        }
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
        <button type="button" aria-label="Download a picture of this view" title="Download a picture of this view" onClick={download}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {error && <p role="status">This miniature needs WebGL. Its landmarks are listed below.</p>}
    </div>
  )
}
