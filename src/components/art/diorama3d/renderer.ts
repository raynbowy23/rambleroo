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
  /** The point the camera looks at, on the tile's ground in the tile's own coordinates, so it turns with the turntable. */
  focus: T.Vector2
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
export const MAX_ZOOM = 4
/** How far from the middle a reader can pan at full zoom; at zoom 1 the tile stays centred. */
const PAN_LIMIT = 4.5
const panLimit = (zoom: number) => Math.max(0, PAN_LIMIT * (1 - 1 / zoom))
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
    const camera = slot.built.camera
    aim(slot, camera, r.width / r.height)
    renderer.setViewport(r.left, height - r.bottom, r.width, r.height)
    renderer.setScissor(
      Math.max(0, r.left),
      Math.max(0, height - r.bottom),
      Math.min(width, r.right) - Math.max(0, r.left),
      Math.min(height, r.bottom) - Math.max(0, r.top),
    )
    paint(slot, camera)
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
/** Frames the tile: the turntable angle, the reader's tilt, zoom and pan. */
function aim(slot: Slot, camera: T.OrthographicCamera, aspect: number) {
  const azimuth = Math.PI / 4 - slot.angle
  const elevation = Math.PI / 5.3 + slot.tilt
  // Projected square width / 85%: fill consistently throughout the turntable.
  const half = (4 * (Math.abs(Math.cos(azimuth)) + Math.abs(Math.sin(azimuth)))) / 0.85
  const span = Math.max(half / aspect, 5.6) / slot.zoom
  const focus = new T.Vector3(slot.focus.x, 0.7, slot.focus.y).applyAxisAngle(new T.Vector3(0, 1, 0), slot.angle)
  camera.position.set(
    focus.x + Math.cos(Math.PI / 4) * 20 * Math.cos(elevation),
    focus.y + 20 * Math.sin(elevation),
    focus.z + Math.sin(Math.PI / 4) * 20 * Math.cos(elevation),
  )
  camera.lookAt(focus)
  camera.left = -span * aspect
  camera.right = span * aspect
  camera.top = span
  camera.bottom = -span
  camera.updateProjectionMatrix()
}
/** The scene, then the car in a second pass over a cleared depth buffer so ridges never hide it. */
function paint(slot: Slot, camera: T.OrthographicCamera) {
  camera.layers.set(0)
  renderer!.render(slot.built.scene, camera)
  // Scissor is still set to this miniature: neighbouring tiles retain their depth.
  renderer!.clearDepth()
  const background = slot.built.scene.background
  slot.built.scene.background = null
  camera.layers.set(1)
  renderer!.render(slot.built.scene, camera)
  camera.layers.set(0)
  slot.built.scene.background = background
}
/** A still of the miniature as the reader sees it now, `width` pixels wide, with its town names. */
function snapshot(slot: Slot, width: number) {
  const r = slot.element.getBoundingClientRect()
  const aspect = r.width / r.height || 1
  const height = Math.round(width / aspect)
  const camera = slot.built.camera.clone()
  aim(slot, camera, aspect)
  // Drawn on the shared canvas and copied before the browser presents it; the next frame puts the page's miniatures back.
  const ratio = renderer!.getPixelRatio()
  renderer!.setPixelRatio(1)
  renderer!.setSize(width, height, false)
  renderer!.setScissorTest(false)
  renderer!.setViewport(0, 0, width, height)
  renderer!.setClearColor(0, 0)
  renderer!.clear()
  paint(slot, camera)
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d')!
  ctx.drawImage(renderer!.domElement, 0, 0, width, height, 0, 0, width, height)
  renderer!.setPixelRatio(ratio)
  canvasWidth = 0
  canvasHeight = 0
  slot.built.world.updateMatrixWorld(true)
  const size = Math.round(width / 36)
  ctx.font = `${size}px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  for (const town of slot.built.townAnchors) {
    const point = town.point.clone().applyMatrix4(slot.built.world.matrixWorld).project(camera)
    if (Math.abs(point.x) > 0.94 || Math.abs(point.y) > 0.94) continue
    const x = ((point.x + 1) / 2) * width,
      y = ((1 - point.y) / 2) * height
    const w = ctx.measureText(town.name).width + size * 0.8
    ctx.fillStyle = '#f6ead3'
    ctx.fillRect(x - w / 2, y - size * 1.4, w, size * 1.4)
    ctx.fillStyle = '#354738'
    ctx.fillText(town.name, x, y - size * 0.2)
  }
  wake()
  return out
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
  renderer.autoClear = false
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
  const slot: Slot = {
    element,
    built,
    labels,
    angle: 0,
    tilt: 0,
    zoom: 1,
    focus: new T.Vector2(),
    dragging: false,
    visible: false,
    elapsed: 0,
  }
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
      // Pulling back draws the view home to the middle.
      if (slot.focus.length() > panLimit(slot.zoom)) slot.focus.setLength(panLimit(slot.zoom))
      wake()
      return slot.zoom
    },
    /** Moves the view with a drag of (dx, dy) pixels on the tile, so the ground follows the finger. */
    panBy(dx: number, dy: number) {
      const r = element.getBoundingClientRect()
      if (!Number.isFinite(dx) || !Number.isFinite(dy) || !r.height) return
      const aspect = r.width / r.height
      const azimuth = Math.PI / 4 - slot.angle
      const half = (4 * (Math.abs(Math.cos(azimuth)) + Math.abs(Math.sin(azimuth)))) / 0.85
      const perPixel = (2 * Math.max(half / aspect, 5.6)) / slot.zoom / r.height
      const elevation = Math.PI / 5.3 + slot.tilt
      // On screen, right runs along (1, 0, -1) and up runs into the scene along (-1, 0, -1), foreshortened by the elevation.
      const right = (-dx * perPixel) / Math.SQRT2,
        away = (dy * perPixel) / Math.sin(elevation) / Math.SQRT2
      const move = new T.Vector3(right - away, 0, -right - away).applyAxisAngle(new T.Vector3(0, 1, 0), -slot.angle)
      slot.focus.x += move.x
      slot.focus.y += move.z
      if (slot.focus.length() > panLimit(slot.zoom)) slot.focus.setLength(panLimit(slot.zoom))
      wake()
    },
    snapshot(width = 1600) {
      return snapshot(slot, width)
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
