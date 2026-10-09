import * as T from 'three'
import type { Model } from './spec'

export interface Pigments {
  paper: string
  far: string
  mid: string
  dark: string
  accent: string
  water: string
  foliage: string
  night: boolean
  snow: boolean
}
export function buildModel(model: Model, ink: Pigments) {
  const group = new T.Group()
  group.name = model
  const mat = (color: string, glow = false) =>
    new T.MeshStandardMaterial({
      color,
      roughness: 1,
      flatShading: true,
      emissive: glow ? color : '#000000',
      emissiveIntensity: glow ? 0.85 : 0,
    })
  const materials = new Map<string, T.Material>()
  const mesh = (geo: T.BufferGeometry, color: string, x = 0, y = 0, z = 0, glow = false) => {
    const key = color + glow
    if (!materials.has(key)) materials.set(key, mat(color, glow))
    const m = new T.Mesh(geo, materials.get(key))
    m.position.set(x, y, z)
    group.add(m)
    return m
  }
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color = ink.dark, glow = false) =>
    mesh(new T.BoxGeometry(w, h, d), color, x, y, z, glow)
  const cone = (x: number, y: number, z: number, r: number, h: number, color: string, n = 5) =>
    mesh(new T.ConeGeometry(r, h, n), color, x, y, z)
  const bar = (a: T.Vector3, b: T.Vector3, width = 0.035, color = ink.dark) => {
    const m = box(0, 0, 0, width, a.distanceTo(b), width, color)
    m.position.copy(a).add(b).multiplyScalar(0.5)
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize())
    return m
  }
  const patch = (color: string, w = 1, d = 0.6) => {
    const m = mesh(new T.CircleGeometry(1, 7), color, 0, 0.018, 0)
    m.rotation.x = -Math.PI / 2
    m.scale.set(w, d, 1)
    return m
  }
  const roof = (x: number, y: number, z: number, w: number, d: number) => {
    const shape = new T.Shape()
    shape.moveTo(-w * 0.75, -0.14)
    shape.lineTo(w * 0.75, -0.14)
    shape.lineTo(0, 0.14)
    shape.closePath()
    const g = new T.ExtrudeGeometry(shape, { depth: d + 0.1, bevelEnabled: false, steps: 1 })
    g.translate(0, 0, -(d + 0.1) / 2)
    return mesh(g, ink.dark, x, y, z)
  }
  const window = (x: number, y: number, z: number) => box(x, y, z, 0.075, 0.095, 0.012, ink.night ? '#f7c76a' : ink.water, ink.night)
  switch (model) {
    case 'town-blocks':
      for (let i = 0; i < 3; i++) box((i - 1) * 0.3, 0.13, 0, 0.24, 0.26 + (i % 2) * 0.12, 0.3, i % 2 ? ink.paper : ink.accent)
      break
    case 'field':
      box(0, 0.015, 0, 0.85, 0.03, 0.65, ink.accent)
      for (let i = 0; i < 2; i++) box(-0.24 + i * 0.48, 0.035, 0, 0.025, 0.015, 0.63, ink.foliage)
      break
    case 'sandbar':
      patch(ink.accent, 0.8, 0.3)
      break
    case 'ridge':
    case 'mesa':
    case 'ledge':
      mesh(new T.CylinderGeometry(model === 'ridge' ? 0.05 : 0.5, 0.7, 0.55, 4), model === 'ridge' ? ink.mid : ink.accent, 0, 0.27)
      break
    case 'hoodoo':
      for (const x of [-0.3, 0, 0.3]) {
        mesh(new T.CylinderGeometry(0.09, 0.16, 0.75, 5), ink.accent, x, 0.37)
        mesh(new T.OctahedronGeometry(0.18), ink.far, x, 0.8)
      }
      break
    case 'snow-peak':
      cone(0, 0.45, 0, 0.7, 0.9, ink.far, 4)
      cone(0, 0.8, 0, 0.2, 0.3, ink.paper, 4)
      break
    case 'bald':
      patch(ink.foliage, 0.8, 0.6)
      for (const x of [-0.3, 0, 0.3]) mesh(new T.OctahedronGeometry(0.13), ink.accent, x, 0.1)
      break
    case 'aspen':
    case 'orchard':
      for (const x of [-0.3, 0, 0.3]) {
        box(x, 0.2, 0, 0.035, 0.4, 0.035, ink.paper)
        const crown = mesh(new T.OctahedronGeometry(0.22), ink.foliage, x, 0.48)
        crown.scale.y = model === 'aspen' ? 1.6 : 0.8
      }
      break
    case 'switchback':
      // A schematic hairpin on a rock slope, only authorized by this motif.
      cone(0, 0.18, 0, 0.6, 0.36, ink.far, 4)
      for (const z of [-0.18, 0.18]) box(0, 0.3, z, 0.65, 0.035, 0.1, ink.dark)
      box(0.28, 0.3, 0, 0.1, 0.035, 0.45, ink.dark)
      break
    case 'dam':
      patch(ink.water, 0.85, 0.6)
      box(0, 0.18, 0, 1.2, 0.36, 0.16, ink.paper)
      for (const x of [-0.4, 0, 0.4]) box(x, 0.2, 0.09, 0.14, 0.25, 0.02, ink.water)
      break
    case 'viaduct':
      box(0, 0.65, 0, 0.35, 0.08, 1.4, ink.paper)
      for (const z of [-0.55, 0, 0.55]) box(0, 0.3, z, 0.15, 0.6, 0.12, ink.paper)
      break
    case 'steeple-town':
      box(0, 0.2, 0, 0.5, 0.4, 0.5, ink.paper)
      roof(0, 0.5, 0, 0.4, 0.5)
      box(0, 0.6, 0.17, 0.16, 0.6, 0.16, ink.paper)
      cone(0, 1, 0.17, 0.16, 0.35, ink.dark, 4)
      break
    case 'harbor':
      patch(ink.water, 0.9, 0.65)
      box(0, 0.06, 0, 1.1, 0.1, 0.12, ink.accent)
      for (const x of [-0.35, 0.35]) box(x, 0.1, -0.3, 0.3, 0.2, 0.3, ink.paper)
      break
    case 'paddlewheeler':
      box(0, 0.08, 0, 0.4, 0.16, 0.9, ink.dark)
      box(0, 0.25, 0, 0.32, 0.2, 0.65, ink.paper)
      box(0, 0.4, 0, 0.38, 0.07, 0.7, ink.accent)
      for (const x of [-0.1, 0.1]) box(x, 0.56, 0.18, 0.06, 0.3, 0.06, ink.dark)
      {
        const wheel = mesh(new T.CylinderGeometry(0.2, 0.2, 0.48, 8), ink.accent, 0, 0.17, -0.33)
        wheel.rotation.z = Math.PI / 2
      }
      break
    case 'gristmill':
      box(0, 0.25, 0, 0.5, 0.5, 0.45, ink.accent)
      roof(0, 0.58, 0, 0.4, 0.5)
      {
        const wheel = mesh(new T.CylinderGeometry(0.26, 0.26, 0.08, 8), ink.dark, 0.31, 0.24, 0)
        wheel.rotation.z = Math.PI / 2
      }
      for (const z of [-0.16, 0.16]) box(0.36, 0.24, z, 0.025, 0.36, 0.025, ink.paper)
      break
    case 'conifer':
      cone(0, 0.37, 0, 0.23, 0.74, ink.snow ? ink.paper : ink.dark, 4)
      break
    case 'hardwood': {
      const m = mesh(new T.OctahedronGeometry(0.28), ink.foliage, 0, 0.4)
      m.scale.y = 1.2
      const g = new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, 0), new T.Vector3(0, 0.35, 0)])
      group.add(new T.Line(g, new T.LineBasicMaterial({ color: ink.dark })))
      break
    }
    case 'cypress':
      box(0, 0.22, 0, 0.055, 0.44, 0.055)
      {
        const m = mesh(new T.OctahedronGeometry(0.38), ink.mid, 0, 0.48)
        m.scale.set(1.35, 0.45, 0.75)
      }
      break
    case 'sea-stack':
      cone(0, 0.35, 0, 0.3, 0.7, ink.dark, 5)
      break
    case 'snowfield':
      patch(ink.paper, 0.7, 0.38)
      break
    case 'alpine-lake':
      patch(ink.water, 0.55, 0.28)
      break
    case 'surf': {
      const m = patch(ink.paper, 0.5, 0.035)
      m.position.y = 0.03
      break
    }
    case 'fog-bank': {
      const fog = mesh(new T.OctahedronGeometry(1), ink.paper, 0, 0.25)
      fog.scale.set(1.4, 0.15, 0.5)
      const material = fog.material as T.MeshStandardMaterial
      material.transparent = true
      material.opacity = 0.22
      material.depthWrite = false
      break
    }
    case 'river':
      patch(ink.water, 0.5, 0.12)
      break
    case 'overlook-pullout':
      box(0, 0.025, 0, 0.65, 0.05, 0.4, ink.accent)
      for (const x of [-0.29, 0.29]) box(x, 0.11, 0.16, 0.025, 0.18, 0.025)
      box(0, 0.19, 0.16, 0.61, 0.025, 0.025)
      box(0, 0.14, 0, 0.15, 0.05, 0.09)
      break
    case 'farmhouse':
      box(0, 0.2, 0, 0.55, 0.4, 0.4, ink.paper)
      roof(0, 0.5, 0, 0.43, 0.4)
      box(0.14, 0.59, 0, 0.065, 0.23, 0.065, ink.accent)
      window(-0.15, 0.24, 0.207)
      window(0.15, 0.24, 0.207)
      box(0, 0.12, 0.21, 0.085, 0.24, 0.02, ink.dark)
      break
    case 'false-front-town':
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 0.46
        box(x, 0.17, 0, 0.37, 0.34, 0.4, i % 2 ? ink.accent : '#986e4e')
        box(x, 0.27, 0.21, 0.4, 0.54, 0.045, i % 2 ? ink.accent : '#986e4e')
        box(x, 0.47, 0.24, 0.32, 0.06, 0.025, ink.paper)
        window(x - 0.09, 0.2, 0.24)
        window(x + 0.09, 0.2, 0.24)
      }
      break
    case 'covered-bridge':
      box(0, 0.03, 0, 0.4, 0.06, 1.1, ink.accent)
      for (const x of [-0.21, 0.21]) {
        box(x, 0.22, 0, 0.055, 0.38, 1.1, '#a34e3d')
        for (const z of [-0.38, 0, 0.38]) box(x, 0.28, z, 0.065, 0.05, 0.15, ink.dark)
      }
      roof(0, 0.53, 0, 0.37, 1.15)
      for (const z of [-0.46, 0.46]) box(0, -0.12, z, 0.42, 0.26, 0.13, ink.far)
      break
    case 'open-spandrel-arch-bridge':
      box(0, -0.045, 0, 0.29, 0.09, 1.25, ink.paper)
      for (const x of [-0.16, 0.16]) {
        box(x, 0.035, 0, 0.025, 0.07, 1.3, ink.paper)
        for (let i = 0; i < 8; i++) {
          const z = -0.6 + i * 0.15,
            zz = z + 0.15
          const y = -0.85 + 0.7 * Math.sin(((z + 0.6) / 1.2) * Math.PI),
            yy = -0.85 + 0.7 * Math.sin(((zz + 0.6) / 1.2) * Math.PI)
          bar(new T.Vector3(x, y, z), new T.Vector3(x, yy, zz), 0.06, ink.paper)
          if (i % 2 === 0) box(x, y / 2, z, 0.035, -y, 0.035, ink.paper)
        }
      }
      break
    case 'lighthouse-on-rock':
      cone(0, 0.42, 0, 0.5, 0.84, ink.dark, 5)
      mesh(new T.CylinderGeometry(0.12, 0.17, 0.48, 6), ink.paper, 0, 0.95)
      box(0, 1.24, 0, 0.21, 0.12, 0.21, ink.night ? '#f7c76a' : ink.water, ink.night)
      cone(0, 1.37, 0, 0.19, 0.15, ink.dark, 6)
      if (ink.night) {
        const beam = new T.Mesh(
          new T.ConeGeometry(0.4, 2.6, 8, 1, true),
          new T.MeshBasicMaterial({ color: '#ffe0a0', transparent: true, opacity: 0.12, depthWrite: false, side: T.DoubleSide }),
        )
        beam.rotation.z = Math.PI / 2
        beam.position.set(1.3, 1.24, 0)
        const pivot = new T.Group()
        pivot.name = 'lighthouse-beam'
        pivot.add(beam)
        group.add(pivot)
      }
      break
    case 'cove-waterfall':
      patch(ink.accent, 0.55, 0.4)
      box(0.12, 0.42, -0.18, 0.7, 0.84, 0.3, ink.mid)
      box(0, 0.42, 0, 0.045, 0.82, 0.025, ink.paper)
      {
        const m = patch(ink.paper, 0.13, 0.08)
        m.position.z = 0.06
      }
      break
    case 'ski-lift':
      patch(ink.paper, 0.85, 0.42)
      for (const z of [-0.5, 0, 0.5]) {
        box(0, 0.35 + z * 0.3, z, 0.035, 0.7, 0.035)
        box(0, 0.69 + z * 0.3, z, 0.32, 0.03, 0.03)
      }
      bar(new T.Vector3(-0.12, 0.54, -0.5), new T.Vector3(-0.12, 0.84, 0.5), 0.015)
      for (const z of [-0.3, 0.15, 0.4]) {
        box(-0.12, 0.47 + z * 0.3, z, 0.015, 0.32, 0.015)
        box(-0.12, 0.31 + z * 0.3, z, 0.17, 0.02, 0.02)
      }
      break
  }
  return group
}
