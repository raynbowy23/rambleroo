import * as THREE from 'three'
import type { Garage } from '../../lib/garage'

/** All geometry is Z up, nose +Y. Pigments are matte, opaque toy enamel. */
function workshop(group: THREE.Group, bevelSize = 0.045) {
  const inks = new Map<string, THREE.MeshStandardMaterial>()
  const ink = (color: string) => {
    if (!inks.has(color)) inks.set(color, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1, metalness: 0 }))
    return inks.get(color)!
  }
  const mesh = (geometry: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0) => {
    const object = new THREE.Mesh(geometry, ink(color))
    object.position.set(x, y, z)
    group.add(object)
    return object
  }
  const box = (x: number, y: number, z: number, w: number, l: number, h: number, color: string) =>
    mesh(new THREE.BoxGeometry(w, l, h), color, x, y, z)
  // Extrude a side elevation across X; one bevel segment gives die-cast shoulders.
  const profile = (points: number[][], width: number, color: string, x = 0, bevel = bevelSize) => {
    const shape = new THREE.Shape(points.map(([y, z]) => new THREE.Vector2(y, z)))
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: width - bevel * 2,
      bevelEnabled: bevel > 0,
      bevelSegments: 1,
      steps: 1,
      bevelSize: bevel,
      bevelThickness: bevel,
      curveSegments: 1,
    })
    geometry.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, x - width / 2 + bevel, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1))
    return mesh(geometry, color)
  }
  const rod = (a: number[], b: number[], radius: number, color: string, segments = 6) => {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b),
      delta = end.clone().sub(start)
    const object = mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), segments), color)
    object.position.copy(start.add(end).multiplyScalar(0.5))
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize())
    return object
  }
  const oval = (x: number, y: number, z: number, w: number, l: number, h: number, color: string) => {
    const object = mesh(new THREE.SphereGeometry(1, 8, 4), color, x, y, z)
    object.scale.set(w / 2, l / 2, h / 2)
    return object
  }
  return { mesh, box, profile, rod, oval }
}
const cream = '#f5e6c8',
  rubber = '#252b22',
  glass = '#3f5a57',
  wood = '#b18655',
  leather = '#493e30'

/** Body footprint <= 1.95 × 4.3; long roof cargo <= 4.9. */
export function buildVehicle(garage: Garage) {
  return vehicleModel(garage)
}

function vehicleModel(garage: Garage, aboard = false) {
  const group = new THREE.Group()
  const { mesh, box, profile, rod, oval } = workshop(group, aboard ? 0 : 0.045)
  const { body, accentColor: accent } = garage
  const bike = garage.model === 'motorcycle',
    bus = garage.model === 'camper',
    pickup = garage.model === 'pickup',
    open = garage.model === 'convertible',
    wagon = garage.model === 'wagon'
  const wheel = (x: number, y: number, radius = 0.43, z = radius, width = 0.22) => {
    rod([x - width / 2, y, z], [x + width / 2, y, z], radius, rubber, aboard ? 6 : 8)
    for (const side of [-1, 1]) {
      const cap = mesh(new THREE.CircleGeometry(radius * 0.53, aboard ? 6 : 8), cream, x + side * (width / 2 + 0.012), y, z)
      cap.rotation.y = (side * Math.PI) / 2
    }
  }
  let roof = bus ? 2.66 : 2.22
  if (bike) {
    wheel(0, -1.22, 0.53, 0.53, 0.25)
    wheel(0, 1.22, 0.53, 0.53, 0.25)
    for (const x of [-0.14, 0.14]) {
      rod([x, -1.22, 0.53], [x, -0.35, 1.12], 0.055, body)
      rod([x, -0.35, 1.12], [x, 0.55, 0.5], 0.055, body)
      rod([x, 0.55, 0.5], [x, -1.22, 0.53], 0.055, body)
      rod([x, 1.22, 0.53], [x, 0.8, 1.55], 0.055, cream)
    }
    oval(0, 0.15, 1.22, 0.62, 1.1, 0.57, body)
    oval(0, -0.6, 1.26, 0.57, 0.86, 0.18, leather)
    box(0, -0.1, 0.67, 0.48, 0.6, 0.4, leather)
    for (const z of [0.58, 0.69, 0.8]) box(0, -0.1, z, 0.52, 0.46, 0.035, cream)
    rod([-0.34, -0.95, 0.35], [-0.34, 0.45, 0.35], 0.065, cream)
    rod([-0.53, 0.83, 1.63], [0.53, 0.83, 1.63], 0.045, rubber)
    rod([0, 0.88, 1.43], [0, 1.03, 1.43], 0.17, cream, 8)
    if (garage.accent !== 'none') oval(0, 0.14, 1.46, garage.accent === 'stripe' ? 0.12 : 0.42, 0.7, 0.08, accent)
  } else {
    // Recessed dark underbody; the body sides have actual semicircular wheel cutouts.
    box(0, 0, 0.65, 1.35, 3.65, 0.35, rubber)
    const lower = [
      [-1.9, 1.05],
      [-1.65, 1.22],
      [1.62, 1.22],
      [1.93, 1.02],
      [1.94, 0.48],
    ]
    for (const y of [1.25, -1.25]) {
      for (let i = 0; i <= 6; i++) {
        const a = (i * Math.PI) / 6
        lower.push([y + 0.49 * Math.cos(a), 0.45 + 0.49 * Math.sin(a)])
      }
    }
    lower.push([-1.94, 0.48])
    profile(lower, 1.74, body)
    for (const x of [-0.84, 0.84]) for (const y of [-1.25, 1.25]) wheel(x, y)
    if (bus) {
      profile(
        [
          [-1.87, 1.23],
          [-1.87, 2.22],
          [-1.65, 2.52],
          [1.47, 2.52],
          [1.83, 2.28],
          [1.9, 1.23],
        ],
        1.65,
        garage.accent === 'two-tone' ? accent : body,
      )
      box(0, 0, 2.59, 1.67, 3.52, 0.1, cream)
      for (const x of [-0.831, 0.831])
        for (const y of [-1.15, -0.22, 0.77])
          profile(
            [
              [y - 0.35, 1.63],
              [y - 0.35, 2.25],
              [y + 0.32, 2.25],
              [y + 0.37, 1.63],
            ],
            0.012,
            glass,
            x,
            0,
          )
      // Two separate front panes leave the unmistakable centre mullion.
      for (const x of [-0.405, 0.405])
        profile(
          [
            [1.945, 1.7],
            [1.905, 2.24],
            [1.925, 2.24],
            [1.965, 1.7],
          ],
          0.68,
          glass,
          x,
          0,
        )
      box(0, -1.919, 2, 1.15, 0.02, 0.5, glass)
      rod([0, 1.965, 1.3], [0, 1.985, 1.3], 0.12, cream, 8)
    } else if (open) {
      box(0, -0.15, 1.278, 1.3, 1.8, 0.025, leather)
      for (const x of [-0.36, 0.36]) {
        box(x, -0.45, 1.3, 0.53, 0.6, 0.13, wood)
        profile(
          [
            [-0.84, 1.29],
            [-0.86, 1.72],
            [-0.68, 1.74],
            [-0.62, 1.29],
          ],
          0.52,
          leather,
          x,
        )
      }
      for (const x of [-0.71, 0.71]) rod([x, 0.76, 1.29], [x, 0.54, 1.94], 0.04, cream)
      rod([-0.71, 0.54, 1.94], [0.71, 0.54, 1.94], 0.04, cream)
      profile(
        [
          [0.72, 1.38],
          [0.54, 1.91],
          [0.57, 1.91],
          [0.75, 1.38],
        ],
        1.34,
        glass,
        0,
        0,
      )
      rod([-0.37, 0.27, 1.42], [-0.37, 0.43, 1.55], 0.16, rubber, 8)
    } else {
      const rear = pickup ? -0.04 : wagon ? -1.49 : -1.12
      const front = pickup ? 1.37 : 1.12
      profile(
        [
          [rear, 1.25],
          [rear + 0.3, 2.06],
          [front - 0.44, 2.06],
          [front, 1.25],
        ],
        1.48,
        body,
      )
      // Insets sit just inside the outer bevel, leaving enamel pillars and sills.
      for (const x of [-0.743, 0.743]) {
        const middle = pickup ? 0.62 : -0.12
        profile(
          [
            [rear + 0.14, 1.42],
            [rear + 0.35, 1.96],
            [middle - 0.08, 1.96],
            [middle - 0.08, 1.42],
          ],
          0.012,
          glass,
          x,
          0,
        )
        profile(
          [
            [middle + 0.05, 1.42],
            [middle + 0.05, 1.96],
            [front - 0.48, 1.96],
            [front - 0.17, 1.42],
          ],
          0.012,
          glass,
          x,
          0,
        )
        box(x, middle - 0.16, 1.31, 0.025, 0.2, 0.04, cream)
      }
      profile(
        [
          [front - 0.39, 2.0],
          [front - 0.06, 1.39],
          [front - 0.025, 1.4],
          [front - 0.355, 2.01],
        ],
        1.23,
        glass,
        0,
        0,
      )
      profile(
        [
          [rear - 0.02, 1.4],
          [rear + 0.19, 1.98],
          [rear + 0.23, 1.99],
          [rear + 0.02, 1.4],
        ],
        1.23,
        glass,
        0,
        0,
      )
      box(0, (rear + front) / 2 - 0.05, 2.16, 1.48, front - rear - 0.6, 0.1, body)
      if (pickup) {
        box(0, -1.02, 1.24, 1.35, 1.6, 0.07, wood)
        for (const x of [-0.79, 0.79]) box(x, -1.02, 1.43, 0.13, 1.65, 0.37, body)
        box(0, -1.86, 1.43, 1.6, 0.1, 0.37, body)
        for (const x of [-0.45, 0, 0.45]) box(x, -1.02, 1.285, 0.025, 1.5, 0.015, leather)
      }
    }
    for (const x of [-0.59, 0.59]) {
      rod([x, 1.95, 1.02], [x, 2, 1.02], 0.16, cream, 8)
      box(x, -1.975, 1.04, 0.19, 0.04, 0.14, '#9c4b40')
    }
    box(0, 1.978, 0.83, 0.61, 0.04, 0.18, rubber)
    for (const y of [-2.04, 2.04]) box(0, y, 0.57, 1.83, 0.13, 0.13, cream)
    if (garage.accent !== 'none') {
      for (const x of [-0.879, 0.879]) box(x, 0, 1.08, 0.012, 3.25, garage.accent === 'stripe' ? 0.065 : 0.17, accent)
      if (garage.accent === 'stripe') box(0, 1.53, 1.272, 0.22, 0.59, 0.012, accent)
    }
    if (wagon)
      for (const x of [-0.894, 0.894]) {
        box(x, -0.15, 1.08, 0.015, 2.93, 0.18, wood)
        for (const y of [-1.45, -0.5, 0.5, 1.2]) box(x * 1.005, y, 1.08, 0.016, 0.04, 0.2, leather)
      }
  }
  const supported = !(bike && (garage.roof === 'canoe' || garage.roof === 'bikes'))
  if (garage.roof !== 'none' && supported) {
    const rackStart = group.children.length
    if (bike) {
      if (garage.roof === 'luggage') {
        for (const x of [-0.22, 0.22]) rod([x, -0.75, 1.26], [x, -1.4, 1.26], 0.035, cream)
        box(0, -1.2, 1.29, 0.55, 0.55, 0.06, cream)
      } else {
        // Side cradles bolt to the frame, below the rider and handlebars.
        for (const y of [-0.65, 0.45]) {
          rod([0.14, y, 0.8], [0.65, y, 0.8], 0.035, cream)
          rod([0.65, y, 0.8], [0.65, y, 1.12], 0.035, cream)
        }
      }
    } else if (open && (garage.roof === 'luggage' || garage.roof === 'bikes')) {
      for (const x of [-0.45, 0.45]) {
        rod([x, -1.25, 1.25], [x, -1.25, 1.4], 0.035, cream)
        rod([x, -1.25, 1.4], [x, -1.75, 1.4], 0.035, cream)
        rod([x, -1.85, 1.23], [x, -1.75, 1.4], 0.035, cream)
      }
      for (const y of [-1.35, -1.75]) box(0, y, 1.4, 1.1, 0.08, 0.07, cream)
    } else if (open) {
      // Low crossbars rest on the windshield frame and a deck-mounted roll hoop.
      roof = 1.99
      for (const x of [-0.65, 0.65]) rod([x, -1.05, 1.25], [x, -1.05, roof], 0.04, cream)
      for (const y of [-1.05, 0.54]) box(0, y, roof, 1.42, 0.08, 0.07, cream)
    } else {
      for (const y of pickup ? [0.35, 0.8] : [-0.65, 0.65]) {
        box(0, y, roof, 1.4, 0.08, 0.07, cream)
        for (const x of [-0.45, 0.45]) box(x, y, roof - 0.055, 0.05, 0.06, 0.11, rubber)
      }
    }
    const cargoStart = group.children.length
    if (garage.roof === 'luggage') {
      profile(
        [
          [-0.75, roof + 0.035],
          [-0.75, roof + 0.48],
          [0.55, roof + 0.48],
          [0.55, roof + 0.035],
        ],
        1.12,
        wood,
      )
      for (const x of [-0.35, 0.35]) box(x, -0.1, roof + 0.532, 0.06, 1.29, 0.016, leather)
      box(0, 0.606, roof + 0.3, 0.28, 0.04, 0.06, leather)
    } else if (garage.roof === 'surfboard') {
      oval(0, 0, roof + 0.095, 0.83, 4.8, 0.14, cream)
      box(0, 0, roof + 0.171, 0.08, 3.65, 0.012, accent)
    } else if (garage.roof === 'canoe') {
      profile(
        [
          [-2.35, roof + 0.34],
          [-1.65, roof + 0.02],
          [1.65, roof + 0.02],
          [2.35, roof + 0.34],
        ],
        0.82,
        wood,
      )
      box(0, 0, roof + 0.37, 0.56, 3.25, 0.035, leather)
      for (const y of [-0.9, 0.9]) box(0, y, roof + 0.4, 0.78, 0.12, 0.05, cream)
    } else {
      wheel(0, -0.84, 0.35, roof + 0.39, 0.065)
      wheel(0, 0.84, 0.35, roof + 0.39, 0.065)
      const a = [0, -0.84, roof + 0.39],
        b = [0, -0.3, roof + 0.99],
        c = [0, 0.22, roof + 0.39],
        d = [0, 0.63, roof + 1.08]
      for (const [start, end] of [
        [a, b],
        [b, c],
        [c, a],
        [b, d],
        [c, d],
        [d, [0, 0.84, roof + 0.39]],
      ])
        rod(start, end, 0.035, accent)
      box(0, -0.3, roof + 1.05, 0.18, 0.3, 0.06, leather)
      rod([-0.22, 0.63, roof + 1.1], [0.22, 0.63, roof + 1.1], 0.025, rubber)
    }
    const cargo = new THREE.Group()
    cargo.name = 'cargo'
    cargo.add(...group.children.slice(cargoStart))
    if (bike && garage.roof === 'luggage') {
      cargo.scale.set(0.48, 0.4, 0.7)
      cargo.position.set(0, -1.16, 1.32 - (roof + 0.035) * 0.7)
    } else if (bike) {
      cargo.rotation.y = Math.PI / 2
      cargo.scale.set(0.75, 0.72, 1)
      cargo.position.set(0.58 - (roof + 0.095), 0, 1.12)
    } else if (open && garage.roof === 'luggage') {
      cargo.scale.set(1, 0.48, 0.8)
      cargo.position.set(0, -1.5, 1.435 - (roof + 0.035) * 0.8)
    } else if (open && garage.roof === 'bikes') {
      cargo.rotation.z = Math.PI / 2
      cargo.scale.setScalar(0.75)
      cargo.position.set(0, -1.75, 1.435 - (roof + 0.04) * 0.75)
    }
    const rack = new THREE.Group()
    rack.name = 'rack'
    rack.add(...group.children.slice(rackStart))
    const accessory = new THREE.Group()
    accessory.name = 'accessory'
    accessory.add(rack, cargo)
    group.add(accessory)
  }
  return group
}

export function disposeVehicle(group: THREE.Object3D) {
  const materials = new Set<THREE.Material>()
  const geometries = new Set<THREE.BufferGeometry>()
  const textures = new Set<THREE.Texture>()
  group.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (mesh.geometry) geometries.add(mesh.geometry)
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material)
  })
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) {
    const texture = (material as THREE.SpriteMaterial).map
    if (texture) textures.add(texture)
    material.dispose()
  }
  for (const texture of textures) texture.dispose()
}

/** A coastal car ferry, bow +Y, with the visitor's actual car on its foredeck. */
export function buildShip(garage: Garage) {
  const group = new THREE.Group()
  const { mesh, box, rod, profile } = workshop(group, 0)
  const shape = new THREE.Shape(
    [
      [-1.32, -3.3],
      [1.32, -3.3],
      [1.38, 1.5],
      [0.95, 2.8],
      [0, 3.65],
      [-0.95, 2.8],
      [-1.38, 1.5],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
  )
  mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.65,
      bevelEnabled: true,
      bevelSize: 0.06,
      bevelThickness: 0.06,
      bevelSegments: 1,
      steps: 1,
    }),
    cream,
    0,
    0,
    0.12,
  )
  box(0, 0.4, 0.84, 2.35, 4.6, 0.12, '#a89f81')
  profile(
    [
      [-3.1, 0.8],
      [-3.1, 1.8],
      [-2.85, 2.02],
      [-1.15, 2.02],
      [-0.9, 1.8],
      [-0.9, 0.8],
    ],
    2.18,
    cream,
  )
  box(0, -2, 2.1, 2.4, 2.5, 0.12, cream)
  for (const x of [-0.72, 0, 0.72]) box(x, -0.84, 1.68, 0.54, 0.04, 0.34, glass)
  for (const x of [-1.14, 1.14]) for (const y of [-2.5, -1.5]) box(x, y, 1.66, 0.02, 0.42, 0.32, glass)
  rod([0, -2.5, 2.12], [0, -2.5, 2.78], 0.25, '#9c4b40', 6)
  rod([0, -2.5, 2.74], [0, -2.5, 2.89], 0.27, rubber, 6)
  for (const x of [-1.26, 1.26]) {
    box(x, 0.7, 1.15, 0.05, 2.9, 0.05, cream)
    for (const y of [-0.7, 0.25, 1.2, 2.1]) box(x, y, 1, 0.05, 0.05, 0.32, cream)
    for (const y of [-2.5, -0.2, 1.6]) box(x, y, 0.4, 0.12, 0.28, 0.36, rubber)
  }
  const car = vehicleModel(garage, true)
  car.scale.setScalar(0.43)
  car.position.set(0, 0.95, 0.91)
  group.add(car)
  return group
}
