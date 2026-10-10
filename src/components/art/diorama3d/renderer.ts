import * as T from 'three'
import type { BuiltScene } from './scene'
import { SPIN_PER_SECOND } from './route'

interface Slot {
  element: HTMLElement
  built: BuiltScene
  angle: number
  tilt: number
  /** 1 frames the whole tile; larger values move in on the middle of it. */
  zoom: number
  labels: HTMLSpanElement[]
  dragging: boolean
  visible: boolean
  elapsed: number
}
let renderer: T.WebGLRenderer | undefined
let observer: IntersectionObserver | undefined
let canvasWidth = 0,
  canvasHeight = 0
let frame = 0,
  last = 0
const slots = new Set<Slot>()
/** How far a reader can pull back from, or move in on, the tile. */
export const MIN_ZOOM = 0.8
export const MAX_ZOOM = 3
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
function draw(now: number) {
  frame = 0
  if (!renderer || document.hidden) return
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now
  const width = window.innerWidth,
    height = window.innerHeight
  if (width !== canvasWidth || height !== canvasHeight) {
    renderer.setSize(width, height, false)
    canvasWidth = width
    canvasHeight = height
  }
  renderer.setScissorTest(false)
  renderer.setClearColor(0, 0)
  renderer.clear()
  renderer.setScissorTest(true)
  let active = false
  for (const slot of slots) {
    if (!slot.visible) continue
    const r = slot.element.getBoundingClientRect()
    if (r.bottom <= 0 || r.top >= height || r.right <= 0 || r.left >= width) continue
    active = true
    if (!reduced()) slot.elapsed += dt
    // A slow turntable; a drag takes over, and the turning resumes from wherever the reader let go.
    if (!reduced() && !slot.dragging) slot.angle += SPIN_PER_SECOND * dt
    slot.built.world.rotation.y = slot.angle
    slot.built.update(slot.elapsed)
    const camera = slot.built.camera,
      aspect = r.width / r.height
    const azimuth = Math.PI / 4 - slot.angle
    const elevation = Math.PI / 5.3 + slot.tilt
    // Projected square width / 85%: fill consistently throughout the turntable.
    const half = (4 * (Math.abs(Math.cos(azimuth)) + Math.abs(Math.sin(azimuth)))) / 0.85
    const span = Math.max(half / aspect, 5.6) / slot.zoom
    camera.position.set(
      Math.cos(Math.PI / 4) * 20 * Math.cos(elevation),
      0.7 + 20 * Math.sin(elevation),
      Math.sin(Math.PI / 4) * 20 * Math.cos(elevation),
    )
    camera.lookAt(0, 0.7, 0)
    camera.left = -span * aspect
    camera.right = span * aspect
    camera.top = span
    camera.bottom = -span
    camera.updateProjectionMatrix()
    renderer.setViewport(r.left, height - r.bottom, r.width, r.height)
    renderer.setScissor(
      Math.max(0, r.left),
      Math.max(0, height - r.bottom),
      Math.min(width, r.right) - Math.max(0, r.left),
      Math.min(height, r.bottom) - Math.max(0, r.top),
    )
    renderer.render(slot.built.scene, camera)
    slot.built.world.updateMatrixWorld(true)
    slot.built.townAnchors.forEach((town, i) => {
      const point = town.point.clone().applyMatrix4(slot.built.world.matrixWorld).project(camera)
      const label = slot.labels[i]
      label.style.left = `${(point.x + 1) * 50}%`
      label.style.top = `${(1 - point.y) * 50}%`
      label.hidden = Math.abs(point.x) > 0.94 || Math.abs(point.y) > 0.94
    })
  }
  if (active && !reduced()) frame = requestAnimationFrame(draw)
}
function wake() {
  if (!frame && renderer && !document.hidden) {
    last = performance.now()
    frame = requestAnimationFrame(draw)
  }
}
function createRenderer() {
  canvasWidth = 0
  canvasHeight = 0
  renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.domElement.className = 'rr-mini-canvas'
  renderer.domElement.setAttribute('aria-hidden', 'true')
  // Inside #root, not after it: #root is its own stacking context (z-index 1), so a canvas outside it would cover the town labels,
  // the zoom buttons and the sticky header that live inside it.
  ;(document.getElementById('root') ?? document.body).append(renderer.domElement)
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) for (const slot of slots) if (slot.element === entry.target) slot.visible = entry.isIntersecting
    wake()
  })
  window.addEventListener('scroll', wake, true)
  window.addEventListener('resize', wake)
  document.addEventListener('visibilitychange', wake)
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', wake)
}
export function registerScene(element: HTMLElement, built: BuiltScene) {
  if (!renderer) createRenderer()
  const labels = built.townAnchors.map((town) => {
    const label = document.createElement('span')
    label.className = 'rr-mini-town'
    label.textContent = town.name
    element.append(label)
    return label
  })
  const slot: Slot = { element, built, labels, angle: 0, tilt: 0, zoom: 1, dragging: false, visible: false, elapsed: 0 }
  slots.add(slot)
  observer!.observe(element)
  wake()
  return {
    grab() {
      slot.dragging = true
    },
    rotateBy(delta: number) {
      if (Number.isFinite(delta)) slot.angle += delta
      wake()
    },
    tiltBy(delta: number) {
      if (Number.isFinite(delta)) slot.tilt = T.MathUtils.clamp(slot.tilt + delta, -Math.PI / 12, Math.PI / 12)
      wake()
    },
    zoomBy(factor: number) {
      if (Number.isFinite(factor) && factor > 0) slot.zoom = T.MathUtils.clamp(slot.zoom * factor, MIN_ZOOM, MAX_ZOOM)
      wake()
      return slot.zoom
    },
    release() {
      slot.dragging = false
      wake()
    },
    dispose() {
      observer!.unobserve(element)
      slots.delete(slot)
      labels.forEach((label) => label.remove())
      built.dispose()
      wake()
      if (!slots.size) {
        cancelAnimationFrame(frame)
        frame = 0
        observer!.disconnect()
        observer = undefined
        renderer!.dispose()
        renderer!.forceContextLoss()
        renderer!.domElement.remove()
        renderer = undefined
        window.removeEventListener('scroll', wake, true)
        window.removeEventListener('resize', wake)
        document.removeEventListener('visibilitychange', wake)
        window.matchMedia('(prefers-reduced-motion: reduce)').removeEventListener('change', wake)
      }
    },
  }
}
