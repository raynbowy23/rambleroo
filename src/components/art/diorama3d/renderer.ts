import * as T from 'three'
import type { BuiltScene } from './scene'
import { SPIN_PER_SECOND } from './route'

interface Slot {
  element: HTMLElement
  built: BuiltScene
  angle: number
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
    camera.left = -5.7 * aspect
    camera.right = 5.7 * aspect
    camera.top = 5.7
    camera.bottom = -5.7
    camera.updateProjectionMatrix()
    renderer.setViewport(r.left, height - r.bottom, r.width, r.height)
    renderer.setScissor(
      Math.max(0, r.left),
      Math.max(0, height - r.bottom),
      Math.min(width, r.right) - Math.max(0, r.left),
      Math.min(height, r.bottom) - Math.max(0, r.top),
    )
    renderer.render(slot.built.scene, camera)
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
  document.body.append(renderer.domElement)
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
  const slot: Slot = { element, built, angle: 0, dragging: false, visible: false, elapsed: 0 }
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
    release() {
      slot.dragging = false
      wake()
    },
    dispose() {
      observer!.unobserve(element)
      slots.delete(slot)
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
