import * as THREE from 'three'
import maplibre, { type CustomLayerInterface, type Map } from './maplibre'
import type { Position } from 'geojson'
import { palette } from './style'
import { splitStretches, waterCrossings, onWater, type RoadCountry, type WaterPolygon } from './roadCountry'
import { roadFurniture } from './roadFurniture'
import { projectRoad, sampleRoad, roadNormal, ribbonFade, ribbonWidth, roadDeckLift } from './roadGeometry'

export const roadLayerId = 'selected-road-3d'
/** Geometry and topology are allocated once. Only elevation attributes change when terrain tiles settle. */
export function createRoadLayer(
  parts: Position[][],
  onFailure: () => void,
  onReady: () => void,
  family = 'town',
  country: RoadCountry = {},
): CustomLayerInterface {
  const projected = projectRoad(parts)
  const sampled = sampleRoad(projected.parts)
  const points = sampled.flat()
  const origin = maplibre.MercatorCoordinate.fromLngLat(projected.origin)
  const units = origin.meterInMercatorCoordinateUnits()
  const positions: number[] = [],
    offsets: number[] = [],
    colors: number[] = [],
    pointIds: number[] = [],
    segmentIds: number[] = [],
    bridgeOffsets: number[] = []
  const segments: [(typeof points)[number], (typeof points)[number]][] = []
  const css = palette()
  const c = (token: string) => css(token) || '#746044'
  const ink = new THREE.Color(c('ink') || '#493e32')
  const cream = new THREE.Color(c('paper') || '#f6ead3')
  let base = 0
  for (const part of sampled) {
    const normals = part.map((_, i) => roadNormal(part, i))
    const stretches = splitStretches(part, country.moments, family)
    for (let i = 0; i < part.length - 1; i++) {
      const family = stretches.find((s) => i >= s.start && i < s.end)!.scene
      const token = ['river', 'coast'].includes(family) ? 'water' : family
      const route = new THREE.Color(c(`route-${token}`))
      const edge = token === 'water' ? 0.13 : family === 'mountain' ? 0.18 : family === 'town' ? 0.07 : 0.035
      const bands: [number, number, number, number, THREE.Color][] = [
        [-0.5, -0.46, 0, edge, route],
        [-0.46, -0.4, edge, edge, route],
        [-0.4, 0.4, 0.025, 0.025, cream],
        [-0.055, 0.055, 0.026, 0.026, route],
        [0.4, 0.46, edge, edge, route],
        [0.46, 0.5, edge, 0, route],
        // Rail bands collapse to the surface on dry road; raised for verified water crossings.
        [-0.46, -0.43, 0, 0, ink],
        [0.43, 0.46, 0, 0, ink],
      ]
      const segmentId = segments.length
      segments.push([part[i], part[i + 1]])
      for (const [left, right, zl, zr, color] of bands) {
        for (const [index, side] of [
          [i, 0],
          [i + 1, 0],
          [i, 1],
          [i, 1],
          [i + 1, 0],
          [i + 1, 1],
        ]) {
          const p = part[index],
            n = normals[index],
            edge = side ? right : left
          positions.push(p.x, p.y, 0)
          offsets.push(n[0] * edge, n[1] * edge, side ? zr : zl)
          colors.push(color.r, color.g, color.b)
          pointIds.push(base + index)
          segmentIds.push(segmentId)
          bridgeOffsets.push((left === -0.46 && right === -0.43) || left === 0.43 ? 0.7 : 0.45)
        }
      }
    }
    base += part.length
  }
  const geometry = new THREE.BufferGeometry()
  const position = new THREE.Float32BufferAttribute(positions, 3)
  position.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', position)
  geometry.setAttribute('offset', new THREE.Float32BufferAttribute(offsets, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const bridge = new THREE.Float32BufferAttribute(new Float32Array(pointIds.length), 1)
  geometry.setAttribute('bridge', bridge)
  const material = new THREE.ShaderMaterial({
    uniforms: { width: { value: 1 }, opacity: { value: 0 } },
    vertexShader: `attribute vec3 offset; attribute vec3 color; attribute float bridge; uniform float width; varying vec3 ink;
      void main() { ink = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position + (offset + vec3(0.0,0.0,bridge)) * width, 1.0); }`,
    fragmentShader: `uniform float opacity; varying vec3 ink; void main() { gl_FragColor = vec4(ink, opacity);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
    transparent: true,
    depthWrite: false,
    // A cartographic overlay must remain legible across unloaded tiles and between elevation samples.
    depthTest: false,
    side: THREE.DoubleSide,
  })
  const scene = new THREE.Scene(),
    camera = new THREE.Camera()
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  scene.add(mesh)
  scene.add(new THREE.HemisphereLight('#ffffff', '#8d826e', 2.5))
  const sun = new THREE.DirectionalLight('#ffffff', 2)
  sun.position.set(-1, -1, 3)
  scene.add(sun)
  const furniture = roadFurniture(scene, sampled, projected.origin, country, family, c)
  let water: WaterPolygon[] = [],
    dirty = true,
    hydroDirty = true,
    view = ''
  const readWater = () => {
    if (!hydroDirty || !map.getStyle || !map.querySourceFeatures) return
    hydroDirty = false
    const found = new Set<string>(),
      polygons: WaterPolygon[] = []
    // Use the style's actual hydro sources, including OpenMapTiles water polygons.
    const layers = map.getStyle().layers ?? []
    const sources: [string, string | undefined][] = layers.flatMap((l) =>
      'source' in l && l.type === 'fill' && /water|lake|ocean/i.test(l.id + ('source-layer' in l ? l['source-layer'] : ''))
        ? [[l.source as string, 'source-layer' in l ? l['source-layer'] : undefined] as [string, string | undefined]]
        : [],
    )
    if (map.getSource('openfreemap')) sources.push(['openfreemap', 'water'])
    for (const [source, sourceLayer] of sources) {
      const key = source + sourceLayer
      if (found.has(key)) continue
      found.add(key)
      for (const f of map.querySourceFeatures(source, sourceLayer ? { sourceLayer } : {}))
        if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') polygons.push(f.geometry)
    }
    water = polygons
    const wet = segments.map(([a, b]) => waterCrossings([a.lng, a.lat], [b.lng, b.lat], water).length > 0)
    segmentIds.forEach((id, i) => bridge.setX(i, wet[id] ? bridgeOffsets[i] : 0))
    bridge.needsUpdate = true
    dirty = true
    map.triggerRepaint()
  }
  let map: Map,
    renderer: THREE.WebGLRenderer | undefined,
    failed = false,
    ready = false
  const heights = new Float64Array(points.length).fill(NaN)
  let timer: ReturnType<typeof setTimeout> | undefined
  const terrain = () => {
    clearTimeout(timer)
    if (failed) return
    let changed = false
    points.forEach((p, i) => {
      // MapLibre returns elevations with the active terrain exaggeration already applied.
      const elevation = map.getTerrain() ? (map.queryTerrainElevation([p.lng, p.lat]) ?? 0) : 0
      const z = maplibre.MercatorCoordinate.fromLngLat([p.lng, p.lat], elevation).z / units
      if (heights[i] !== z) {
        heights[i] = z
        changed = true
      }
    })
    if (!changed) return
    dirty = true
    pointIds.forEach((id, i) => position.setZ(i, heights[id] + 1))
    position.needsUpdate = true
    map.triggerRepaint()
  }
  const scheduleTerrain = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      readWater()
      terrain()
    }, 100)
  }
  const onSourceData = (event: { sourceId?: string }) => {
    if (['openfreemap', 'lakes'].includes(event.sourceId ?? '')) hydroDirty = true
    if (event.sourceId === map.getTerrain()?.source || ['openfreemap', 'lakes'].includes(event.sourceId ?? '')) scheduleTerrain()
  }
  const transform = new THREE.Matrix4().makeTranslation(origin.x, origin.y, 0).scale(new THREE.Vector3(units, units, units))
  return {
    id: roadLayerId,
    type: 'custom',
    renderingMode: '3d',
    onAdd(current, gl) {
      map = current
      roadDeckLift.set(map, (point) => (onWater(point, water) ? 0.45 : 0))
      try {
        renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl })
        renderer.autoClear = false
        renderer.debug.onShaderError = () => {
          failed = true
          onFailure()
        }
        map.on('idle', scheduleTerrain)
        map.on('sourcedata', onSourceData)
        map.on('terrain', terrain)
        readWater()
        terrain()
      } catch {
        failed = true
        onFailure()
      }
    },
    render(_gl, input) {
      if (failed || !renderer) return
      try {
        material.uniforms.width.value = ribbonWidth(map.getZoom(), projected.origin[1])
        material.uniforms.opacity.value = ribbonFade(map.getZoom())
        const key = `${map.getZoom()}:${map.getCenter?.().toArray()}:${map.getBearing?.()}:${map.getPitch?.()}`
        if (dirty || key !== view) {
          furniture.update(map, material.uniforms.width.value, material.uniforms.opacity.value, water)
          view = key
          dirty = false
        }
        camera.projectionMatrix.fromArray(input.defaultProjectionData.mainMatrix).multiply(transform)
        renderer.resetState()
        renderer.render(scene, camera)
        renderer.resetState()
        if (!ready && !failed) {
          ready = true
          onReady()
        }
      } catch {
        failed = true
        onFailure()
      }
    },
    onRemove() {
      roadDeckLift.delete(map)
      clearTimeout(timer)
      map?.off('idle', scheduleTerrain)
      map?.off('sourcedata', onSourceData)
      map?.off('terrain', terrain)
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>()
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          geometries.add(o.geometry)
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m)
          if (o instanceof THREE.InstancedMesh) o.dispose()
        }
      })
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
      renderer?.dispose()
    },
  }
}
