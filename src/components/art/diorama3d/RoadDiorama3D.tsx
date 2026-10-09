import { useEffect, useRef, useState } from 'react'
import { useGarage } from '../../../lib/garage'
import type { DioramaSpec } from './spec'
import { buildScene, type Conditions } from './scene'
import { registerScene } from './renderer'
import { DRAG_RADIANS_PER_PX } from './route'
import './diorama3d.css'

export function RoadDiorama3D({ spec, conditions }: { spec: DioramaSpec; conditions: Conditions }) {
  const element = useRef<HTMLDivElement>(null),
    controller = useRef<ReturnType<typeof registerScene> | null>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const garage = useGarage()
  const [error, setError] = useState(false),
    [visible, setVisible] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    observer.observe(element.current!)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!visible) return
    const built = buildScene(spec, garage, conditions)
    try {
      controller.current = registerScene(element.current!, built)
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
      role="img"
      aria-label={`${spec.title}. ${spec.landmarks.map((l) => l.name).join(', ')}. Drag or use the arrow keys to turn and tilt the miniature.`}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY }
        controller.current?.grab()
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (drag.current === null) return
        controller.current?.rotateBy((e.clientX - drag.current.x) * DRAG_RADIANS_PER_PX)
        controller.current?.tiltBy((e.clientY - drag.current.y) * DRAG_RADIANS_PER_PX * 0.35)
        drag.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerUp={() => {
        drag.current = null
        controller.current?.release()
      }}
      onPointerCancel={() => {
        drag.current = null
        controller.current?.release()
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          controller.current?.tiltBy(((e.key === 'ArrowUp' ? -1 : 1) * Math.PI) / 60)
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault()
          controller.current?.rotateBy((e.key === 'ArrowLeft' ? -1 : 1) * (Math.PI / 12))
        }
      }}
    >
      {error && <p role="status">This miniature needs WebGL. Its landmarks are listed below.</p>}
    </div>
  )
}
