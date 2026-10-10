import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { lookInks } from '../looks'
import { buildVehicle, disposeVehicle } from '../vehicle3d'
import type { Garage } from '../../../lib/garage'
import type { Season, Weather } from '../diorama/environment'
import type { DioramaSpec } from './spec'
import { makeRoute } from './route'
import { buildModel, type Pigments } from './models'

export interface Conditions {
  hour?: number
  season: Season
  weather: Weather
}
export function solarHour(longitude: number, now = new Date()) {
  return (((now.getUTCHours() + now.getUTCMinutes() / 60 + longitude / 15) % 24) + 24) % 24
}

function geometry(vertices: number[]) {
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3))
  g.computeVertexNormals()
  return g
}
/** Shared mitered cross-sections keep both edges joined through every bend. */
export function ribbon(points: T.Vector3[], width: number, _depth = 0) {
  const edges = points.map((p, i) => {
    const before = p
      .clone()
      .sub(points[Math.max(0, i - 1)])
      .setY(0)
      .normalize()
    const after = points[Math.min(points.length - 1, i + 1)].clone().sub(p).setY(0).normalize()
    if (!i) before.copy(after)
    if (i === points.length - 1) after.copy(before)
    const normal = new T.Vector3(-before.z - after.z, 0, before.x + after.x).normalize()
    const length = Math.min(width, width / 2 / Math.max(0.5, normal.dot(new T.Vector3(-after.z, 0, after.x))))
    normal.multiplyScalar(length)
    return [p.clone().add(normal), p.clone().sub(normal)]
  })
  const vertices: number[] = []
  for (let i = 1; i < edges.length; i++) {
    const [al, ar] = edges[i - 1],
      [bl, br] = edges[i]
    for (const p of [al, bl, ar, ar, bl, br]) vertices.push(...p.toArray())
  }
  return geometry(vertices)
}

export function buildScene(spec: DioramaSpec, garage: Garage, conditions: Conditions) {
  const hour = conditions.hour ?? solarHour(spec.longitude),
    night = hour < 5 || hour >= 21
  const warm = hour < 8 || hour >= 17
  const snow = conditions.weather === 'snow' || (conditions.season === 'winter' && spec.snowInWinter)
  const ink: Pigments = {
    ...lookInks(spec.palette, {
      palette: 0,
      time: 'day',
      season: conditions.season,
      layout: 0,
      lettering: 'block',
      border: 'linen',
      mirror: false,
    }),
    foliage: conditions.season === 'autumn' ? '#bd6339' : conditions.season === 'spring' ? '#a7b66e' : '#73906b',
    night,
    snow,
  }
  const scene = new T.Scene()
  const sky = night ? '#202e48' : hour >= 19 ? '#605676' : warm ? '#dcb17b' : conditions.weather === 'clear' ? '#c9ded5' : '#a9b9bb'
  scene.background = new T.Color(sky)
  if (conditions.weather === 'fog') scene.fog = new T.Fog(sky, 10, 23)
  else if (conditions.weather !== 'clear') scene.fog = new T.Fog(sky, 19, 35)
  const world = new T.Group()
  scene.add(world)
  const route = makeRoute(spec)
  const material = (color: string) =>
    new T.MeshStandardMaterial({
      color,
      emissive: night ? color : '#000000',
      emissiveIntensity: night ? 0.16 : 0,
      flatShading: true,
      roughness: 1,
      side: T.DoubleSide,
    })
  const add = (g: T.BufferGeometry, color: string) => {
    const m = new T.Mesh(g, material(color))
    world.add(m)
    return m
  }
  // A coarse, closed height field with independently coloured geological strata.
  const n = 12
  const groundBatches = new Map<string, number[]>()
  const heights = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => route.height(-4 + (i * 8) / n, -4 + (j * 8) / n)),
  )
  const terrainHeight = (x: number, z: number) => {
    const gx = T.MathUtils.clamp(((x + 4) * n) / 8, 0, n - 0.00001),
      gz = T.MathUtils.clamp(((z + 4) * n) / 8, 0, n - 0.00001)
    const i = Math.floor(gx),
      j = Math.floor(gz),
      u = gx - i,
      v = gz - j
    const a = heights[i][j],
      b = heights[i + 1][j],
      c = heights[i][j + 1],
      d = heights[i + 1][j + 1]
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v)
  }
  const vertex = (x: number, z: number) => new T.Vector3(x, terrainHeight(x, z), z)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x = -4 + (i * 8) / n,
        z = -4 + (j * 8) / n,
        a = vertex(x, z),
        b = vertex(x + 8 / n, z),
        c = vertex(x, z + 8 / n),
        d = vertex(x + 8 / n, z + 8 / n)
      const near = route.nearest(x, z)
      const color = snow
        ? ink.paper
        : spec.ground === 'alpine-plateau'
          ? near.y > 1.3
            ? ink.far
            : ink.mid
          : spec.ground === 'desert-mesas'
            ? a.y > 0.8
              ? ink.far
              : ink.accent
            : spec.ground === 'prairie-grid'
              ? ink.mid
              : spec.ground === 'low-shore'
                ? ink.accent
                : spec.ground === 'main-street'
                  ? ink.far
                  : ink.mid
      if (!groundBatches.has(color)) groundBatches.set(color, [])
      groundBatches.get(color)!.push(...a.toArray(), ...c.toArray(), ...b.toArray(), ...b.toArray(), ...c.toArray(), ...d.toArray())
    }
  for (const [color, points] of groundBatches) add(geometry(points), color)
  for (let layer = 0; layer < 3; layer++) {
    const base = add(new T.BoxGeometry(8, 0.17, 8), [ink.dark, '#a38266', ink.accent][layer])
    base.position.y = -0.46 + layer * 0.17
  }
  const sides: number[] = []
  for (let edge = 0; edge < 4; edge++)
    for (let i = 0; i < n; i++) {
      const t = -4 + (i * 8) / n,
        u = t + 8 / n
      const a = edge === 0 ? vertex(t, -4) : edge === 1 ? vertex(4, t) : edge === 2 ? vertex(u, 4) : vertex(-4, u)
      const b = edge === 0 ? vertex(u, -4) : edge === 1 ? vertex(4, u) : edge === 2 ? vertex(t, 4) : vertex(-4, t)
      const aa = a.clone().setY(-0.03),
        bb = b.clone().setY(-0.03)
      sides.push(...a.toArray(), ...aa.toArray(), ...b.toArray(), ...b.toArray(), ...aa.toArray(), ...bb.toArray())
    }
  add(geometry(sides), ink.far)
  if (spec.ground === 'coastal-cliff' || spec.ground === 'low-shore') {
    const sea = add(new T.PlaneGeometry(8, 8), ink.water)
    sea.rotation.x = -Math.PI / 2
    sea.position.y = 0.13
  }
  // Seat route vertices on the actual triangulated height field. Bixby's deck spans the canyon instead.
  for (const p of route.points) {
    const at = route.nearest(p.x, p.z).at
    if (!spec.landmarks.some((l) => l.model === 'open-spandrel-arch-bridge' && l.offset === 'on-road' && Math.abs(at - l.at) < 0.1))
      p.y = Math.max(
        ...[
          [0, 0],
          [0.2, 0],
          [-0.2, 0],
          [0, 0.2],
          [0, -0.2],
        ].map(([x, z]) => terrainHeight(p.x + x, p.z + z)),
      )
  }
  route.height = terrainHeight
  // The road ribbon and car share these terrain-conforming elevations.
  const road = route.points.map((p) => p.clone().add(new T.Vector3(0, 0.045, 0)))
  add(ribbon(road, 0.34), ink.dark)
  add(
    ribbon(
      road.map((p) => p.clone().add(new T.Vector3(0, 0.009, 0))),
      0.028,
      0,
    ),
    '#e9cb85',
  )
  const landmarkGroups: T.Group[] = []
  const placedKinds = new Map<string, T.Vector3[]>()
  for (const landmark of spec.landmarks) {
    const peers = spec.landmarks.filter((l) => l.at === landmark.at)
    const peer = peers.indexOf(landmark)
    const distance =
      (peer % 2 ? -1 : 1) * (landmark.offset === 'on-road' ? 0 : landmark.offset === 'seaward' ? 1.25 : 0.9 + Math.floor(peer / 2) * 0.5)
    let displayAt = landmark.at
    const sameKind = placedKinds.get(landmark.model) ?? []
    if (landmark.offset !== 'on-road') {
      const candidates = [displayAt, ...Array.from({ length: 41 }, (_, i) => i / 40)].sort(
        (a, b) => Math.abs(a - landmark.at) - Math.abs(b - landmark.at),
      )
      displayAt =
        candidates.find((at) =>
          sameKind.every((p) => {
            const q = route.frame(at, distance).point
            return Math.hypot(p.x - T.MathUtils.clamp(q.x, -3.3, 3.3), p.z - T.MathUtils.clamp(q.z, -3.3, 3.3)) >= 1.8
          }),
        ) ?? displayAt
    }
    const { point, angle } = route.frame(displayAt, distance)
    point.x = T.MathUtils.clamp(point.x, -3.3, 3.3)
    point.z = T.MathUtils.clamp(point.z, -3.3, 3.3)
    point.y = landmark.offset === 'on-road' ? route.sample(landmark.at).y + 0.06 : route.height(point.x, point.z) + 0.025
    if (landmark.offset === 'seaward') point.y = 0.16
    const model = buildModel(landmark.model, ink)
    const size = new T.Box3().setFromObject(model).getSize(new T.Vector3())
    const scale = Math.min(2.25, 8 / 3 / Math.max(size.x, size.y, size.z))
    model.scale.setScalar(scale)
    if (landmark.model === 'open-spandrel-arch-bridge' && landmark.offset !== 'on-road') point.y += 0.85 * scale
    sameKind.push(point.clone())
    placedKinds.set(landmark.model, sameKind)
    model.name = landmark.name
    model.position.copy(point)
    model.rotation.y = angle
    if (landmark.model === 'covered-bridge') model.rotation.y += Math.PI / 2
    world.add(model)
    landmarkGroups.push(model)
  }
  for (const item of spec.dressing) {
    if (item.model === 'river') {
      const pts = Array.from({ length: 25 }, (_, i) => {
        const p = route.frame((spec.authored ? 0.43 : 0) + (i * (spec.authored ? 0.57 : 1)) / 24, item.side * item.distance).point
        p.y = route.height(p.x, p.z) + 0.035
        return p
      })
      add(ribbon(pts, 0.32, 0), ink.water)
      continue
    }
    // Fog is optional scenery; omit it rather than putting a solid bank on land.
    if (item.model === 'fog-bank') continue
    const { point, angle } = route.frame(item.at, item.side * item.distance)
    if (item.model === 'field') {
      if (spec.ground === 'coastal-cliff' || spec.ground === 'low-shore' || spec.ground === 'river-valley') continue
      const vertices: number[] = []
      const polygon = [
        [-0.65, -0.18],
        [-0.22, -0.24],
        [0.6, -0.13],
        [0.52, 0.18],
        [-0.4, 0.26],
      ].map(([x, z]) => {
        const px = point.x + (x * Math.cos(angle) - z * Math.sin(angle)) * item.scale
        const pz = point.z + (x * Math.sin(angle) + z * Math.cos(angle)) * item.scale
        return new T.Vector3(px, terrainHeight(px, pz) + 0.018, pz)
      })
      const probes = [...polygon, point.clone().setY(terrainHeight(point.x, point.z))]
      if (
        probes.some(
          (p) =>
            Math.abs(p.x) > 3.9 ||
            Math.abs(p.z) > 3.9 ||
            p.y < 0.16 ||
            route.nearest(p.x, p.z).distance < 0.3 ||
            Math.hypot(
              terrainHeight(p.x + 0.1, p.z) - terrainHeight(p.x - 0.1, p.z),
              terrainHeight(p.x, p.z + 0.1) - terrainHeight(p.x, p.z - 0.1),
            ) /
              0.2 >
              0.25,
        )
      )
        continue
      for (let i = 1; i < polygon.length - 1; i++)
        vertices.push(...polygon[0].toArray(), ...polygon[i].toArray(), ...polygon[i + 1].toArray())
      add(geometry(vertices), snow ? ink.paper : ['#9c9869', '#aaa077', '#918c63'][Math.floor(item.at * 37) % 3])
      continue
    }
    // Leave clearings around named landmarks; no implicit species or roadside buildings.
    if (landmarkGroups.some((g) => Math.hypot(g.position.x - point.x, g.position.z - point.z) < 1.0)) continue
    point.y = route.height(point.x, point.z) + 0.025
    if (item.model === 'surf' || item.model === 'sea-stack') point.y = 0.16
    const model = buildModel(item.model, {
      ...ink,
      foliage: conditions.season === 'autumn' && item.at % 0.1 < 0.05 ? '#d8a348' : ink.foliage,
    })
    const tree = ['hardwood', 'conifer', 'aspen', 'orchard', 'cypress'].includes(item.model)
    if (tree && (route.nearest(point.x, point.z).distance < 0.55 || point.y < 0.17 || Math.abs(point.x) > 3.7 || Math.abs(point.z) > 3.7)) {
      disposeVehicle(model)
      continue
    }
    model.position.copy(point)
    model.rotation.y = angle
    model.scale.setScalar(item.scale * (tree ? 0.8 : 1))
    world.add(model)
  }
  const townAnchors: { name: string; point: T.Vector3 }[] = []
  for (const town of spec.towns) {
    const existing = landmarkGroups.find((g) => g.name === town.landmark)
    const point = existing ? existing.position.clone() : route.frame(town.at, -0.85).point
    if (!existing) {
      point.y = route.height(point.x, point.z) + 0.025
      const model = buildModel('town-blocks', ink)
      model.position.copy(point)
      world.add(model)
    }
    townAnchors.push({ name: town.name, point: point.clone().add(new T.Vector3(0, 0.55, 0)) })
  }
  const car = buildVehicle(garage)
  // Vehicle uses Z up and +Y forward. This mount maps it into our Y-up world.
  car.rotation.set(-Math.PI / 2, 0, Math.PI)
  car.scale.setScalar(0.135)
  // Layer 1 gets a fresh depth buffer in the shared renderer, preserving self-occlusion.
  car.traverse((object) => object.layers.set(1))
  const driver = new T.Group()
  driver.name = 'visitor-car'
  driver.add(car)
  world.add(driver)
  if (night)
    for (const x of [-0.034, 0.034]) {
      const light = new T.SpotLight('#ffe2a0', 0.7, 2, Math.PI / 7, 0.6, 1)
      light.position.set(x, 0.055, 0.11)
      light.target.position.set(x, 0, 1.5)
      driver.add(light, light.target)
    }
  const ambient = new T.HemisphereLight(night ? '#98afd5' : '#fff0d0', night ? '#71819a' : ink.dark, night ? 1.5 : 2.2)
  ambient.layers.enable(1)
  scene.add(ambient)
  const sun = new T.DirectionalLight(
    night ? '#9ab1dc' : warm ? '#ffc58f' : '#fff3db',
    night ? 0.8 : conditions.weather === 'clear' ? 1.4 : 1.0,
  )
  const phase = ((hour - 6) / 12) * Math.PI
  sun.position.set(Math.cos(phase) * 8, Math.max(1, Math.sin(phase) * 10), 4)
  sun.layers.enable(1)
  scene.add(sun)
  const camera = new T.OrthographicCamera(-6.3, 6.3, 5.8, -5.8, 0.1, 60)
  camera.position.set(12, 11, 12)
  camera.lookAt(0, 0.7, 0)
  const particles = new T.Group()
  scene.add(particles)
  if (night || conditions.weather === 'rain' || conditions.weather === 'snow') {
    const positions: number[] = []
    for (let i = 0; i < 70; i++)
      positions.push(
        Math.sin(i * 73) * 5,
        night && conditions.weather === 'clear' ? 4 + (i % 9) * 0.4 : 1 + (i % 13) * 0.4,
        Math.cos(i * 31) * 5,
      )
    const g = new T.BufferGeometry()
    g.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
    const p = new T.Points(
      g,
      new T.PointsMaterial({
        color: night ? '#f5e6c8' : '#e1e7df',
        size: conditions.weather === 'rain' ? 0.025 : 0.045,
        transparent: true,
        opacity: 0.7,
      }),
    )
    particles.add(p)
    if (conditions.weather === 'rain') {
      p.visible = false
      const streaks: number[] = []
      for (let i = 0; i < positions.length; i += 3)
        streaks.push(positions[i], positions[i + 1], positions[i + 2], positions[i] - 0.04, positions[i + 1] - 0.2, positions[i + 2])
      const lines = new T.BufferGeometry()
      lines.setAttribute('position', new T.Float32BufferAttribute(streaks, 3))
      particles.add(new T.LineSegments(lines, new T.LineBasicMaterial({ color: '#d5e1e5', transparent: true, opacity: 0.5 })))
    }
  }
  const beams: T.Object3D[] = []
  world.traverse((o) => {
    if (o.name === 'lighthouse-beam') beams.push(o)
  })
  // Batch static geometry by pigment. Keep the car and rotating beam independent.
  const batches = new Map<string, { material: T.Material; geometries: T.BufferGeometry[] }>()
  const remove: T.Mesh[] = []
  world.updateMatrixWorld(true)
  world.traverse((o) => {
    if (!(o instanceof T.Mesh) || o.parent === car || o.parent?.name === 'lighthouse-beam') return
    const m = o.material as T.MeshStandardMaterial
    if (m.transparent) return
    const key = [m.color?.getHex(), m.emissive?.getHex(), m.side, m.opacity].join(':')
    const copy = o.geometry.clone().applyMatrix4(o.matrixWorld)
    const g = copy.index ? copy.toNonIndexed() : copy
    if (g !== copy) copy.dispose()
    // All static meshes carry position and normal only; discard primitive UVs before batching.
    g.deleteAttribute('uv')
    if (!batches.has(key)) batches.set(key, { material: m, geometries: [] })
    batches.get(key)!.geometries.push(g)
    remove.push(o)
  })
  const kept = new Set([...batches.values()].map((b) => b.material))
  for (const m of remove) {
    m.removeFromParent()
    m.geometry.dispose()
    if (!kept.has(m.material as T.Material)) (m.material as T.Material).dispose()
  }
  for (const { material, geometries } of batches.values()) {
    const merged = mergeGeometries(geometries)
    for (const g of geometries) g.dispose()
    if (merged) {
      world.add(new T.Mesh(merged, material))
      world.add(
        new T.LineSegments(new T.EdgesGeometry(merged, 45), new T.LineBasicMaterial({ color: ink.dark, transparent: true, opacity: 0.14 })),
      )
    }
  }
  // Sparse geometric ink edges, not an expensive fullscreen post-processing chain.
  const outlineBox = new T.BoxGeometry(8, 0.5, 8)
  const outlineGeometry = new T.EdgesGeometry(outlineBox)
  outlineBox.dispose()
  const outline = new T.LineSegments(outlineGeometry, new T.LineBasicMaterial({ color: ink.dark, transparent: true, opacity: 0.4 }))
  outline.position.y = -0.29
  world.add(outline)
  function update(seconds: number) {
    const t = (seconds / 100) % 1,
      p = route.sample(t).add(new T.Vector3(0, 0.06, 0)),
      tangent = route.frame(t).tangent
    driver.position.copy(p)
    driver.rotation.set(-Math.atan2(tangent.y, Math.hypot(tangent.x, tangent.z)), Math.atan2(tangent.x, tangent.z), 0, 'YXZ')
    for (const beam of beams) beam.rotation.y = seconds * 0.35
    if (conditions.weather === 'rain' || conditions.weather === 'snow')
      particles.position.y = -((seconds * (conditions.weather === 'rain' ? 2 : 0.3)) % 1.5)
  }
  update(0)
  return { scene, world, camera, route, driver, landmarkGroups, townAnchors, update, dispose: () => disposeVehicle(scene) }
}
export type BuiltScene = ReturnType<typeof buildScene>
export function triangleCount(object: T.Object3D) {
  let count = 0
  object.traverse((o) => {
    if (o instanceof T.Mesh) count += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3
  })
  return count
}
