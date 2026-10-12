import * as T from 'three'
import type { Map } from './maplibre'
import { buildModel, type Pigments } from '../../components/art/diorama3d/models'
import { models, type Model } from '../../components/art/diorama3d/spec'
import { circumference, type RoadPoint } from './roadGeometry'
import { onWater, propSpacing, sceneAt, type RoadCountry, type WaterPolygon } from './roadCountry'

/** Fixed GPU pools; only instance transforms/counts change with the viewport. */
export function roadFurniture(
  scene: T.Scene,
  parts: RoadPoint[][],
  origin: [number, number],
  country: RoadCountry,
  fallback: string,
  color: (s: string) => string,
) {
  const ink: Pigments = {
    paper: color('paper'),
    far: color('route-mountain'),
    mid: color('route-desert'),
    dark: color('ink'),
    accent: color('route-town'),
    water: color('route-water'),
    foliage: color('route-forest'),
    night: false,
    snow: false,
  }
  const pools = new globalThis.Map<string, T.InstancedMesh>()
  const addPool = (key: string, geometry: T.BufferGeometry, token: string) => {
    const material = new T.MeshStandardMaterial({ color: color(token), flatShading: true, transparent: true })
    const mesh = new T.InstancedMesh(geometry, material, 4000)
    mesh.count = 0
    mesh.frustumCulled = false
    pools.set(key, mesh)
    scene.add(mesh)
  }
  addPool('tree', new T.ConeGeometry(0.22, 0.7, 5).rotateX(Math.PI / 2).translate(0, 0, 0.4), 'route-forest')
  addPool('broadleaf', new T.IcosahedronGeometry(0.27, 0).scale(1, 1, 1.15).translate(0, 0, 0.3), 'route-forest')
  addPool('bridge-post', new T.BoxGeometry(0.035, 0.035, 0.25).translate(0, 0, 0.575), 'route-water')
  addPool('rock', new T.DodecahedronGeometry(0.24, 0).scale(1, 0.8, 0.7).translate(0, 0, 0.12), 'route-mountain')
  addPool('desert', new T.DodecahedronGeometry(0.26, 0).scale(1, 0.8, 0.7).translate(0, 0, 0.12), 'route-desert')
  addPool('post', new T.BoxGeometry(0.045, 0.045, 0.3).translate(0, 0, 0.15), 'route-prairie')
  addPool('guard', new T.BoxGeometry(0.035, 0.035, 0.23).translate(0, 0, 0.115), 'route-mountain')
  addPool('hay', new T.CylinderGeometry(0.17, 0.17, 0.25, 8).translate(0, 0, 0.17), 'route-prairie')
  addPool('block', new T.BoxGeometry(0.3, 0.3, 0.35).translate(0, 0, 0.175), 'route-town')
  addPool('pier', new T.BoxGeometry(0.12, 0.12, 0.45).translate(0, 0, 0.225), 'route-water')
  const local = (lng: number, lat: number) => {
    const scale = circumference * Math.cos((origin[1] * Math.PI) / 180)
    return {
      x: ((lng - origin[0]) / 360) * scale,
      y:
        ((Math.log(Math.tan(Math.PI / 4 + (origin[1] * Math.PI) / 360)) - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) /
          (2 * Math.PI)) *
        scale,
      lng,
      lat,
    }
  }
  const path = country.spec?.road.coordinates ?? country.strip?.main.path ?? parts.flat().map((p) => [p.lng, p.lat])
  const lengths = [0]
  for (let i = 1; i < path.length; i++) {
    const a = local(path[i - 1][0], path[i - 1][1]),
      b = local(path[i][0], path[i][1])
    lengths.push(lengths[i - 1] + Math.hypot(b.x - a.x, b.y - a.y))
  }
  const fraction = (at: number) => {
    const d = Math.max(0, Math.min(1, at)) * lengths.at(-1)!
    let i = 1
    while (i < lengths.length - 1 && lengths[i] < d) i++
    const t = (d - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1),
      a = path[i - 1],
      b = path[i] ?? a
    return local(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
  }
  const landmarks: { group: T.Group; p: RoadPoint; side: number; nx: number; ny: number; waterModel: boolean }[] = []
  const addLandmark = (model: Model, p: RoadPoint, side: number) => {
    if (landmarks.length >= 64 || !models.includes(model)) return
    const group = buildModel(model, ink)
    group.rotation.x = Math.PI / 2
    scene.add(group)
    let nearest = Infinity,
      nx = 1,
      ny = 0
    for (const part of parts)
      for (let i = 1; i < part.length; i++) {
        const a = part[i - 1],
          b = part[i],
          dx = b.x - a.x,
          dy = b.y - a.y,
          len = Math.hypot(dx, dy)
        if (!len) continue
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (len * len)))
        const distance = (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2
        if (distance < nearest) {
          nearest = distance
          nx = -dy / len
          ny = dx / len
        }
      }
    landmarks.push({
      group,
      p,
      side,
      nx,
      ny,
      waterModel: [
        'harbor',
        'lighthouse-on-rock',
        'sea-stack',
        'paddlewheeler',
        'viaduct',
        'dam',
        'covered-bridge',
        'open-spandrel-arch-bridge',
      ].includes(model),
    })
  }
  for (const landmark of country.spec?.landmarks ?? []) {
    const match =
      country.strip?.moments.find((m) => m.title.toLowerCase() === landmark.name.toLowerCase()) ??
      country.moments?.find((m) => m.at && m.title.toLowerCase() === landmark.name.toLowerCase())
    addLandmark(landmark.model, match?.at ? local(match.at[0], match.at[1]) : fraction(landmark.at), 1)
  }
  const namedTowns = new Set(country.spec?.landmarks.filter((l) => l.model === 'town-blocks').map((l) => l.name))
  for (const town of country.strip?.towns ?? []) if (!namedTowns.has(town.name)) addLandmark('town-blocks', local(...town.at), -1)
  const dummy = new T.Object3D()
  const elevation = (map: Map, p: RoadPoint) =>
    map.getTerrain()
      ? ((map.queryTerrainElevation([p.lng, p.lat]) ?? 0) * Math.cos((origin[1] * Math.PI) / 180)) / Math.cos((p.lat * Math.PI) / 180)
      : 0
  let total = 0
  function update(map: Map, width: number, opacity: number, water: WaterPolygon[]) {
    total = 0
    for (const mesh of pools.values()) {
      mesh.count = 0
      mesh.visible = opacity > 0
      ;(mesh.material as T.Material).opacity = opacity
    }
    const spacing = propSpacing(map.getZoom(), origin[1]),
      bounds = map.getBounds?.()
    const visible = (p: RoadPoint) => !bounds || bounds.contains([p.lng, p.lat])
    const place = (key: string, p: RoadPoint, nx: number, ny: number, side: number, size = 1, allowWater = false) => {
      if (total >= 4000 || !visible(p)) return
      const offset = width * side,
        q = local(
          p.lng + ((nx * offset) / (circumference * Math.cos((origin[1] * Math.PI) / 180))) * 360,
          p.lat - ((ny * offset * Math.cos((p.lat * Math.PI) / 180)) / (circumference * Math.cos((origin[1] * Math.PI) / 180))) * 360,
        )
      if (!allowWater && onWater([q.lng, q.lat], water)) return
      const mesh = pools.get(key)!
      dummy.position.set(q.x, q.y, elevation(map, q) + 1)
      dummy.scale.setScalar(width * size)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(mesh.count++, dummy.matrix)
      total++
    }
    const broadleaf = country.spec?.dressing.some((d) => ['hardwood', 'aspen', 'orchard'].includes(d.model))
    for (const part of parts) {
      let distance = 0,
        next = spacing / 2
      for (let i = 0; i < part.length - 1; i++) {
        const a = part[i],
          b = part[i + 1],
          dx = b.x - a.x,
          dy = b.y - a.y,
          len = Math.hypot(dx, dy)
        if (
          bounds &&
          (Math.max(a.lng, b.lng) < bounds.getWest() ||
            Math.min(a.lng, b.lng) > bounds.getEast() ||
            Math.max(a.lat, b.lat) < bounds.getSouth() ||
            Math.min(a.lat, b.lat) > bounds.getNorth())
        ) {
          next += Math.max(0, Math.floor((distance + len - next) / spacing) + 1) * spacing
          distance += len
          continue
        }
        while (next <= distance + len && total < 4000) {
          const t = (next - distance) / (len || 1),
            p = { x: a.x + dx * t, y: a.y + dy * t, lng: a.lng + (b.lng - a.lng) * t, lat: a.lat + (b.lat - a.lat) * t },
            nx = -dy / (len || 1),
            ny = dx / (len || 1)
          const index = Math.round(next / spacing),
            family = sceneAt([p.lng, p.lat], country.moments, fallback)
          if (onWater([p.lng, p.lat], water)) {
            place('pier', p, nx, ny, -0.35, 1, true)
            place('pier', p, nx, ny, 0.35, 1, true)
            place('bridge-post', p, nx, ny, -0.445, 1, true)
            place('bridge-post', p, nx, ny, 0.445, 1, true)
          } else if (family === 'forest')
            for (const side of [-1, 1]) place(broadleaf ? 'broadleaf' : 'tree', p, nx, ny, side * (0.85 + (index % 3) * 0.18))
          else if (family === 'desert') for (const side of [-1, 1]) place('desert', p, nx, ny, side * 0.9, index % 4 === 0 ? 1.5 : 0.7)
          else if (family === 'prairie') {
            for (const side of [-1, 1]) place('post', p, nx, ny, side * 0.75)
            if (index % 5 === 0) place('hay', p, nx, ny, 1.1)
          } else if (family === 'town' && index % 3 === 0) place('block', p, nx, ny, index % 2 ? 1 : -1)
          else if (family === 'mountain') {
            const before = part[Math.max(0, i - 1)],
              cross = (a.x - before.x) * dy - (a.y - before.y) * dx,
              outside = cross > 0 ? -1 : 1
            place('rock', p, nx, ny, -outside * 0.85)
            if (Math.abs(cross) > 1) place('guard', p, nx, ny, outside * 0.55)
          }
          next += spacing
        }
        distance += len
      }
    }
    for (const mesh of pools.values()) mesh.instanceMatrix.needsUpdate = true
    for (const { group, p, side, nx, ny, waterModel } of landmarks) {
      const shifted = (direction: number) =>
        local(
          p.lng + ((nx * width * direction) / (circumference * Math.cos((origin[1] * Math.PI) / 180))) * 360,
          p.lat -
            ((ny * width * direction * Math.cos((p.lat * Math.PI) / 180)) / (circumference * Math.cos((origin[1] * Math.PI) / 180))) * 360,
        )
      let q = shifted(side)
      if (!waterModel && onWater([q.lng, q.lat], water)) q = shifted(-side)
      group.visible = visible(q) && opacity > 0 && (waterModel || !onWater([q.lng, q.lat], water))
      group.position.set(q.x, q.y, elevation(map, q) + 1)
      group.scale.setScalar(width * 1.3)
      group.traverse((o) => {
        if (o instanceof T.Mesh)
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            m.transparent = true
            m.opacity = opacity
          }
      })
    }
  }
  return { update }
}
