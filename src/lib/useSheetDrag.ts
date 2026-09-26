import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'

/** Capture only the handle, leaving the sheet's content free to scroll. */
export function useSheetDrag(snap: number, onSnap: (snap: number) => void, dismiss = false) {
  const ref = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ y: number; height: number; lastY: number; time: number; velocity: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const [offset, setOffset] = useState<number | null>(null)
  const stops = () => {
    const height = ref.current?.parentElement?.clientHeight ?? window.innerHeight
    return [150, height * 0.5, height * 0.88]
  }
  const finish = (event: PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const drag = gesture.current
    if (!drag) return
    suppressClick.current = drag.moved
    if (!cancelled && drag.moved) {
      const distance = event.clientY - drag.y
      const velocity = performance.now() - drag.time < 100 ? drag.velocity : 0
      if (dismiss) {
        if (distance > 80 || (distance > 20 && velocity > 0.45)) onSnap(0)
      } else {
        const projected = drag.height - distance - velocity * 180
        const heights = stops()
        onSnap(
          heights.reduce(
            (nearest, height, index) => (Math.abs(height - projected) < Math.abs(heights[nearest] - projected) ? index : nearest),
            snap,
          ),
        )
      }
    }
    gesture.current = null
    setOffset(null)
  }
  return {
    ref,
    style: (offset === null
      ? undefined
      : dismiss
        ? { transform: `translateY(${offset}px)`, transition: 'none' }
        : { height: offset, transition: 'none' }) as CSSProperties | undefined,
    handlers: {
      onPointerDown(event: PointerEvent<HTMLButtonElement>) {
        if (event.button !== 0) return
        suppressClick.current = false
        gesture.current = {
          y: event.clientY,
          height: ref.current?.getBoundingClientRect().height ?? 150,
          lastY: event.clientY,
          time: performance.now(),
          velocity: 0,
          moved: false,
        }
        event.currentTarget.setPointerCapture(event.pointerId)
      },
      onPointerMove(event: PointerEvent<HTMLButtonElement>) {
        const drag = gesture.current
        if (!drag) return
        const now = performance.now()
        drag.velocity = (event.clientY - drag.lastY) / Math.max(1, now - drag.time)
        drag.lastY = event.clientY
        drag.time = now
        const distance = event.clientY - drag.y
        drag.moved ||= Math.abs(distance) > 5
        const [min, , max] = stops()
        const height = drag.height - distance
        setOffset(
          dismiss ? Math.max(0, distance) : height < min ? min + (height - min) * 0.2 : height > max ? max + (height - max) * 0.2 : height,
        )
      },
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => finish(event),
      onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => finish(event, true),
      onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => finish(event, true),
      onClick() {
        if (!suppressClick.current) onSnap(dismiss ? 0 : (snap + 1) % 3)
        suppressClick.current = false
      },
    },
  }
}
