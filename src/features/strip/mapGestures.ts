import { clamp } from './geometry'

export interface ViewOffsets {
  zoom: number
  bearing: number
  pitch: number
  /** Screen pixels the reader dragged the view away from the car. */
  panX: number
  panY: number
}
export const defaultView = (): ViewOffsets => ({ zoom: 0, bearing: 0, pitch: 0, panX: 0, panY: 0 })

/** A plain mouse drag pans; modified drags and two-finger touches turn and zoom. The plain wheel and one-finger swipes stay with the page, since scrolling is what drives the car. */
export function bindMapGestures(element: HTMLElement, adjust: (delta: Partial<ViewOffsets>) => void) {
  const wheel = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1)
    adjust({ zoom: clamp(-pixels / 300, -1, 1) })
  }
  let suppressClick = false
  const click = (event: MouseEvent) => {
    if (!suppressClick) return
    event.preventDefault()
    event.stopImmediatePropagation()
    suppressClick = false
  }
  let mouse: { x: number; y: number; pan: boolean; moved: boolean } | undefined
  const down = (event: MouseEvent) => {
    suppressClick = false
    const turn = event.button === 2 || (event.button === 0 && (event.ctrlKey || event.metaKey))
    if (!turn && event.button !== 0) return
    if (turn) {
      event.preventDefault()
      suppressClick = true
    }
    mouse = { x: event.clientX, y: event.clientY, pan: !turn, moved: false }
    element.focus({ preventScroll: true })
  }
  const move = (event: MouseEvent) => {
    if (!mouse) return
    const dx = event.clientX - mouse.x,
      dy = event.clientY - mouse.y
    // A pan starts only past a few pixels, so a click on a pin is still a click.
    if (mouse.pan && !mouse.moved && Math.hypot(dx, dy) < 4) return
    event.preventDefault()
    if (mouse.pan) {
      mouse.moved = suppressClick = true
      adjust({ panX: dx, panY: dy })
    } else adjust({ bearing: dx * 0.5, pitch: -dy * 0.3 })
    mouse = { ...mouse, x: event.clientX, y: event.clientY }
  }
  const up = () => {
    mouse = undefined
  }
  const context = (event: MouseEvent) => event.preventDefault()
  const pair = (touches: TouchList) => {
    const x = touches[1].clientX - touches[0].clientX
    const y = touches[1].clientY - touches[0].clientY
    return { distance: Math.max(1, Math.hypot(x, y)), angle: Math.atan2(y, x) }
  }
  let touch: ReturnType<typeof pair> | undefined
  const start = (event: TouchEvent) => {
    suppressClick = event.touches.length === 2
    if (event.touches.length !== 2) {
      touch = undefined
      return
    }
    event.preventDefault()
    touch = pair(event.touches)
  }
  const drag = (event: TouchEvent) => {
    if (event.touches.length !== 2) {
      touch = undefined
      return
    }
    event.preventDefault()
    const next = pair(event.touches)
    if (touch) {
      const angle = next.angle - touch.angle
      adjust({ zoom: Math.log2(next.distance / touch.distance), bearing: (Math.atan2(Math.sin(angle), Math.cos(angle)) * 180) / Math.PI })
    }
    touch = next
  }
  const end = () => {
    touch = undefined
  }
  element.addEventListener('click', click, true)
  element.addEventListener('wheel', wheel, { passive: false })
  element.addEventListener('mousedown', down)
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
  window.addEventListener('blur', up)
  element.addEventListener('contextmenu', context)
  element.addEventListener('touchstart', start, { passive: false })
  element.addEventListener('touchmove', drag, { passive: false })
  element.addEventListener('touchend', end)
  element.addEventListener('touchcancel', end)
  return () => {
    element.removeEventListener('click', click, true)
    element.removeEventListener('wheel', wheel)
    element.removeEventListener('mousedown', down)
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
    window.removeEventListener('blur', up)
    element.removeEventListener('contextmenu', context)
    element.removeEventListener('touchstart', start)
    element.removeEventListener('touchmove', drag)
    element.removeEventListener('touchend', end)
    element.removeEventListener('touchcancel', end)
  }
}
