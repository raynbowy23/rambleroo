import * as THREE from 'three'
import type { Garage } from '../../lib/garage'

/** Toy proportions, facing north (+Y), with Z up. */
export function buildVehicle(garage: Garage) {
  const group = new THREE.Group()
  const material = (color: string) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 })
  const body = material(garage.body),
    cream = material('#f5e6c8'),
    tyre = material('#262923')
  const accent = material(garage.accentColor),
    wood = material('#aa794b')
  const box = (x: number, y: number, z: number, w: number, l: number, h: number, ink = body) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, l, h), ink)
    mesh.position.set(x, y, z)
    group.add(mesh)
    return mesh
  }
  const wheel = (x: number, y: number, z = 0.45, radius = 0.45) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.28, 10), tyre)
    mesh.rotation.z = Math.PI / 2
    mesh.position.set(x, y, z)
    group.add(mesh)
  }
  const bike = garage.model === 'motorcycle'
  const bus = garage.model === 'camper'
  const pickup = garage.model === 'pickup'
  const open = garage.model === 'convertible'
  if (bike) {
    wheel(0, -1.25, 0.55, 0.55)
    wheel(0, 1.25, 0.55, 0.55)
    box(0, 0, 0.85, 0.5, 2.1, 0.45)
    box(0, -0.4, 1.15, 0.55, 0.9, 0.18, tyre)
    box(0, 0.95, 1.45, 1.1, 0.12, 0.12, cream)
  } else {
    box(0, 0, 0.85, 1.9, 4, 0.8)
    for (const x of [-0.98, 0.98]) for (const y of [-1.25, 1.25]) wheel(x, y)
    if (open) {
      box(0, -0.1, 1.28, 1.5, 1.7, 0.12, tyre)
      for (const x of [-0.42, 0.42]) box(x, -0.5, 1.45, 0.55, 0.35, 0.45, wood)
      box(0, 0.85, 1.65, 1.65, 0.12, 0.7, cream)
    } else {
      const length = bus ? 3.6 : pickup ? 1.4 : garage.model === 'wagon' ? 2.8 : 2.1
      const y = pickup ? 0.65 : bus ? 0 : -0.15
      const height = bus ? 1.2 : 0.8
      box(0, y, 1.3 + height / 2, 1.65, length, height, cream)
      box(0, y, 1.3 + height, 1.85, length + 0.15, 0.18)
      for (const x of [-0.84, 0.84]) box(x, y, 1.7, 0.1, 0.15, height)
      if (bus) box(0, 1.82, 1.85, 0.12, 0.08, 1.2)
      if (pickup) {
        box(0, -1.1, 1.28, 1.55, 1.5, 0.1, wood)
        for (const x of [-0.87, 0.87]) box(x, -1.1, 1.45, 0.16, 1.6, 0.5)
      }
    }
    if (garage.accent !== 'none') {
      if (garage.accent === 'stripe') box(0, 1.5, 1.26, 0.3, 0.9, 0.025, accent)
      else for (const x of [-0.96, 0.96]) box(x, 0, 0.9, 0.025, 3.9, 0.38, accent)
    }
    if (garage.model === 'wagon') for (const x of [-0.98, 0.98]) box(x, -0.15, 1, 0.03, 3.4, 0.38, wood)
    for (const x of [-0.6, 0.6]) box(x, 2.02, 0.95, 0.38, 0.08, 0.3, cream)
    box(0, 2.05, 0.6, 1.95, 0.15, 0.16, cream)
  }
  const roof = bus ? 2.8 : bike ? 1.7 : 2.35
  if (garage.roof === 'luggage') {
    box(0, -0.2, roof, 1.4, 1.4, 0.5, wood)
    for (const x of [-0.45, 0.45]) box(x, -0.2, roof + 0.26, 0.1, 1.42, 0.03, tyre)
  } else if (garage.roof === 'surfboard' || garage.roof === 'canoe') {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), garage.roof === 'canoe' ? wood : cream)
    mesh.scale.set(0.5, 2.5, garage.roof === 'canoe' ? 0.35 : 0.09)
    mesh.position.z = roof
    group.add(mesh)
  } else if (garage.roof === 'bikes') {
    wheel(0, -0.8, roof, 0.45)
    wheel(0, 0.8, roof, 0.45)
    box(0, 0, roof + 0.2, 0.12, 1.6, 0.12, accent)
    box(0, 0, roof + 0.45, 0.12, 0.12, 0.6, accent)
  }
  // Materials unused by a particular model do not need GPU resources.
  const used = new Set(group.children.map((child) => (child as THREE.Mesh).material))
  for (const ink of [body, cream, tyre, accent, wood]) if (!used.has(ink)) ink.dispose()
  return group
}

export function disposeVehicle(group: THREE.Object3D) {
  const materials = new Set<THREE.Material>()
  group.traverse((object) => {
    const mesh = object as THREE.Mesh
    mesh.geometry?.dispose()
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material)
  })
  for (const material of materials) {
    const texture = (material as THREE.SpriteMaterial).map
    texture?.dispose()
    material.dispose()
  }
}
