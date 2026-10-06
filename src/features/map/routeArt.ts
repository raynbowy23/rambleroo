import { loadCarPicture } from '../../lib/carPicture'
import type { Map } from './maplibre'
import { palette } from './style'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Vehicle } from '../../components/art/Vehicle'
import { useGarage } from '../../lib/garage'

// Power-of-two repeats keep the canvas textures seamless in MapLibre's image collection. Every motif has an unbroken line through the
// tile (32 × 16, centre line at y 8 to 10), so roads read as continuous at any zoom; the ornaments ride along it like an old
// pictorial map. `fill` holds closed shapes (tree crowns, desert stones) painted solid.
export const strokes = [
  { family: 'water', label: 'River / coast', color: 'route-water', path: 'M0 8Q4 4 8 8T16 8T24 8T32 8', fill: '' },
  { family: 'mountain', label: 'Mountain', color: 'route-mountain', path: 'M0 11L8 5L16 11L24 5L32 11', fill: '' },
  {
    family: 'forest',
    label: 'Forest',
    color: 'route-forest',
    path: 'M0 11H32M8 11V8M24 11V8',
    fill: 'M4.5 8.5L8 3L11.5 8.5ZM20.5 8.5L24 3L27.5 8.5Z',
  },
  {
    family: 'desert',
    label: 'Desert',
    color: 'route-desert',
    path: 'M0 10H32',
    fill: 'M6 5.6a2.2 2.2 0 1 0 0.01 0ZM16 4.8a1.7 1.7 0 1 0 0.01 0ZM26 5.6a2.2 2.2 0 1 0 0.01 0Z',
  },
  { family: 'stitch', label: 'Town', color: 'route-town', path: 'M0 8H32M4 5V11M12 5V11M20 5V11M28 5V11', fill: '' },
  {
    family: 'prairie',
    label: 'Prairie',
    color: 'route-prairie',
    path: 'M0 11H32M6 11L4.5 6M8 11L8 5.5M10 11L11.5 6M22 11L20.5 6M24 11L24 5.5M26 11L27.5 6',
    fill: '',
  },
] as const

function canvasImage(map: Map, id: string, width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width * 2
  canvas.height = height * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(2, 2)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  draw(ctx)
  map.addImage(id, ctx.getImageData(0, 0, canvas.width, canvas.height), { pixelRatio: 2 })
}

export function addRouteArt(map: Map) {
  const c = palette()
  for (const stroke of strokes) {
    canvasImage(map, `route-${stroke.family}`, 32, 16, (ctx) => {
      ctx.strokeStyle = c(stroke.color)
      ctx.fillStyle = c(stroke.color)
      ctx.lineWidth = 2
      ctx.stroke(new Path2D(stroke.path))
      if (stroke.fill) ctx.fill(new Path2D(stroke.fill))
    })
  }
  // Reserve dimensions immediately; decoded SVG replaces this transparent image.
  canvasImage(map, 'route-car', 30, 50, () => {})
  let generation = 0
  let disposed = false
  const refresh = async () => {
    const version = ++generation
    const garage = useGarage.getState()
    const pictureUrl = garage.usePicture && garage.picture ? await loadCarPicture(garage.picture).catch(() => undefined) : undefined
    if (disposed || version !== generation) return
    const host = document.createElement('div')
    const root = createRoot(host)
    flushSync(() => root.render(createElement(Vehicle, { ...garage, pictureUrl, view: 'top', size: 60 })))
    const svg = new XMLSerializer().serializeToString(host.querySelector('svg')!)
    root.unmount()
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      if (disposed || version !== generation) return
      const canvas = document.createElement('canvas')
      canvas.width = 60
      canvas.height = 100
      const context = canvas.getContext('2d')
      if (!context) return
      context.drawImage(image, 0, garage.usePicture && pictureUrl ? 20 : 0, 60, garage.usePicture && pictureUrl ? 60 : 100)
      if (map.getLayer('route-car')) {
        map.setLayoutProperty('route-car', 'icon-rotate', garage.usePicture ? 0 : ['get', 'bearing'])
        map.setLayoutProperty('route-car', 'icon-rotation-alignment', garage.usePicture ? 'viewport' : 'map')
        map.setLayoutProperty('route-car', 'icon-pitch-alignment', garage.usePicture ? 'viewport' : 'map')
      }
      const pixels = context.getImageData(0, 0, 60, 100)
      if (map.hasImage('route-car')) map.updateImage('route-car', pixels)
      else map.addImage('route-car', pixels, { pixelRatio: 2 })
    } catch {
      /* Keep the map usable if image decoding fails. */
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  void refresh()
  const unsubscribe = useGarage.subscribe(() => {
    void refresh()
  })
  map.once('remove', () => {
    disposed = true
    unsubscribe()
  })
  for (const finish of [false, true]) {
    canvasImage(map, finish ? 'route-finish' : 'route-start', 26, 30, (ctx) => {
      ctx.strokeStyle = c('ink')
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(5, 28)
      ctx.lineTo(5, 3)
      ctx.stroke()
      ctx.fillStyle = c(finish ? 'paper' : 'rust')
      ctx.fillRect(5, 3, 16, 12)
      if (finish) {
        ctx.fillStyle = c('ink')
        for (let x = 0; x < 4; x++) for (let y = 0; y < 3; y++) if ((x + y) % 2 === 0) ctx.fillRect(5 + x * 4, 3 + y * 4, 4, 4)
      }
      ctx.strokeRect(5, 3, 16, 12)
    })
  }
}

export function addMomentStamp(map: Map, number: number) {
  const id = `route-stamp-${number}`
  if (map.hasImage(id)) return id
  const c = palette()
  canvasImage(map, id, 30, 30, (ctx) => {
    ctx.fillStyle = c('paper')
    ctx.strokeStyle = c('rust')
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.arc(15, 15, 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.setLineDash([2, 1.5])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.arc(15, 15, 9.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = c('rust')
    ctx.font = 'bold 12px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(number), 15, 15.5, 18)
  })
  return id
}
