import { useEffect, useRef, useState } from 'react'
import { useGarage } from '../../../lib/garage'
import type { DioramaSpec } from './spec'
import { buildScene, type Conditions } from './scene'
import { registerScene, MAX_ZOOM, MIN_ZOOM } from './renderer'
import { DRAG_RADIANS_PER_PX, DRIVE_SECONDS } from './route'
import { canMakeVideo, canShareFiles, compose, makeClip, save, shareOrSave, CLIP_SECONDS, type ClipFormat } from './share'
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
  // Sharing: the car's drive along the road from the current view, held still, as a video or a looping GIF. Encoding takes a few seconds, and a
  // share sheet needs a fresh tap, so the finished file waits behind its own Share and Save buttons.
  const [share, setShare] = useState<
    | { step: 'closed' | 'choose' }
    | { step: 'making'; format: ClipFormat; progress: number }
    | { step: 'ready'; file: File }
    | { step: 'failed' }
  >({ step: 'closed' })
  const [video, setVideo] = useState(false)
  useEffect(() => {
    if (share.step === 'choose') void canMakeVideo().then(setVideo)
  }, [share.step])
  const make = async (format: ClipFormat) => {
    const miniature = controller.current
    if (!miniature) return
    setShare({ step: 'making', format, progress: 0 })
    const release = miniature.hold()
    const canvas = document.createElement('canvas')
    try {
      const blob = await makeClip(
        format,
        (i, count, width) => compose(miniature.snapshot(width, 0, (DRIVE_SECONDS * i) / count), spec.title, canvas),
        (progress) => setShare({ step: 'making', format, progress }),
      )
      setShare({ step: 'ready', file: new File([blob], `${spec.bywayId}-miniature.${format}`, { type: blob.type }) })
    } catch {
      setShare({ step: 'failed' })
    } finally {
      release()
    }
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
        <button
          type="button"
          aria-label="Share the drive as a video or GIF"
          title="Share the drive as a video or GIF"
          aria-expanded={share.step !== 'closed'}
          onClick={() => setShare(share.step === 'closed' ? { step: 'choose' } : { step: 'closed' })}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path
              d="M8 10V2M5 4.5 8 1.5l3 3M4.5 7H3.5v7h9V7h-1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {share.step !== 'closed' && (
        <div className="rr-mini-share" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {share.step === 'choose' && (
            <>
              <p>The drive along the road from this view, {CLIP_SECONDS} seconds.</p>
              {video && (
                <button type="button" onClick={() => void make('mp4')}>
                  Video (MP4)
                </button>
              )}
              <button type="button" onClick={() => void make('gif')}>
                Looping GIF
              </button>
            </>
          )}
          {share.step === 'making' && (
            <p role="status">
              Making the {share.format === 'mp4' ? 'video' : 'GIF'}… {Math.round(share.progress * 100)}%
            </p>
          )}
          {share.step === 'ready' && (
            <>
              <p role="status">Ready, {(share.file.size / 1e6).toFixed(1)} MB.</p>
              {canShareFiles(share.file) && (
                <button type="button" onClick={() => void shareOrSave(share.file, spec.title)}>
                  Share
                </button>
              )}
              <button type="button" onClick={() => save(share.file)}>
                Save
              </button>
            </>
          )}
          {share.step === 'failed' && <p role="status">That didn't work. Keep the miniature on screen while it records and try again.</p>}
          {share.step !== 'making' && (
            <button type="button" className="rr-mini-share-close" aria-label="Close" onClick={() => setShare({ step: 'closed' })}>
              ×
            </button>
          )}
        </div>
      )}
      {error && <p role="status">This miniature needs WebGL. Its landmarks are listed below.</p>}
    </div>
  )
}
