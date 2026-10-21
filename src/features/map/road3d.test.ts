import { afterEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import type { Map } from './maplibre'
import { createRoadLayer } from './road3d'
import { roadDeckLift } from './roadGeometry'

const state = vi.hoisted(() => ({ scene: undefined as THREE.Scene | undefined }))
vi.mock('three', async (original) => ({
  ...(await original<typeof THREE>()),
  WebGLRenderer: class {
    autoClear = false
    debug = {}
    resetState() {}
    render(scene: THREE.Scene) {
      state.scene = scene
    }
    dispose() {}
  },
}))
vi.mock('./style', () => ({ palette: () => () => '#eadfc7' }))
afterEach(() => vi.useRealTimers())
it('refreshes exaggerated elevations after terrain tiles settle and removes pending work', () => {
  vi.useFakeTimers()
  const listeners = new globalThis.Map<string, (event?: { sourceId: string }) => void>()
  let terrain: { source: string } | null = { source: 'raised-relief' }
  let elevation = 0
  const map = {
    getTerrain: () => terrain,
    getCanvas: () => document.createElement('canvas'),
    queryTerrainElevation: vi.fn(() => elevation),
    triggerRepaint: vi.fn(),
    getZoom: () => 12,
    on: (type: string, fn: (event?: { sourceId: string }) => void) => listeners.set(type, fn),
    off: (type: string) => listeners.delete(type),
  }
  const failure = vi.fn()
  const layer = createRoadLayer(
    [
      [
        [0, 0],
        [0.001, 0],
      ],
    ],
    failure,
    vi.fn(),
    'coast',
  )
  const gl = {} as WebGL2RenderingContext
  layer.onAdd!(map as unknown as Map, gl)
  layer.render(gl, { defaultProjectionData: { mainMatrix: new THREE.Matrix4().elements } } as Parameters<typeof layer.render>[1])
  const mesh = state.scene!.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
  const positions = mesh.geometry.getAttribute('position')
  expect(positions.getZ(0)).toBeCloseTo(1)
  expect(mesh.material.depthTest).toBe(false)
  map.queryTerrainElevation.mockClear()
  elevation = 160 // Already exaggerated by MapLibre; must not multiply by 1.6 again.
  listeners.get('sourcedata')!({ sourceId: 'unrelated' })
  vi.advanceTimersByTime(100)
  expect(map.queryTerrainElevation).not.toHaveBeenCalled()
  for (let i = 0; i < 4; i++) listeners.get('sourcedata')!({ sourceId: 'raised-relief' })
  vi.advanceTimersByTime(99)
  expect(positions.getZ(0)).toBeCloseTo(1)
  vi.advanceTimersByTime(1)
  expect(positions.getZ(0)).toBeCloseTo(161)
  elevation = 180
  listeners.get('idle')!()
  vi.advanceTimersByTime(100)
  expect(positions.getZ(0)).toBeCloseTo(181)
  terrain = null
  listeners.get('terrain')!()
  expect(positions.getZ(0)).toBeCloseTo(1)
  listeners.get('idle')!()
  layer.onRemove!(map as unknown as Map, gl)
  map.queryTerrainElevation.mockClear()
  vi.runAllTimers()
  expect(listeners.size).toBe(0)
  expect(map.queryTerrainElevation).not.toHaveBeenCalled()
  expect(failure).not.toHaveBeenCalled()
})

it('updates bridge decks from arriving water polygons without rebuilding and disposes the scenery', () => {
  vi.useFakeTimers()
  let water: unknown[] = []
  const loaded = { layers: [{ id: 'water', type: 'fill', source: 'openfreemap', 'source-layer': 'water' }] }
  let style: typeof loaded | undefined = loaded
  const listeners = new globalThis.Map<string, (event?: { sourceId: string }) => void>()
  const map = {
    getTerrain: () => null,
    getCanvas: () => document.createElement('canvas'),
    triggerRepaint: vi.fn(),
    getZoom: () => 15,
    getStyle: () => style,
    getSource: () => ({}),
    querySourceFeatures: () => water,
    on: (type: string, fn: (event?: { sourceId: string }) => void) => listeners.set(type, fn),
    off: (type: string) => listeners.delete(type),
  }
  const failure = vi.fn()
  const layer = createRoadLayer(
    [
      [
        [0, 0],
        [3, 0],
      ],
    ],
    failure,
    vi.fn(),
    'forest',
  )
  const gl = {} as WebGL2RenderingContext
  const input = { defaultProjectionData: { mainMatrix: new THREE.Matrix4().elements } } as Parameters<typeof layer.render>[1]
  layer.onAdd!(map as unknown as Map, gl)
  layer.render(gl, input)
  const scene = state.scene!
  const road = scene.children[0] as THREE.Mesh
  const bridge = road.geometry.getAttribute('bridge')
  expect(bridge.getX(0)).toBe(0)
  const pools = scene.children.filter((o) => o instanceof THREE.InstancedMesh)
  expect(pools.reduce((n, m) => n + m.count, 0)).toBe(4000)
  water = [
    {
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-0.001, -0.001],
            [0.01, -0.001],
            [0.01, 0.001],
            [-0.001, 0.001],
            [-0.001, -0.001],
          ],
        ],
      },
    },
  ]
  // Water that arrives while the style is still loading is read once the style is there, not dropped.
  style = undefined
  listeners.get('sourcedata')!({ sourceId: 'openfreemap' })
  vi.advanceTimersByTime(100)
  expect(bridge.getX(0)).toBe(0)
  style = loaded
  listeners.get('idle')!()
  vi.advanceTimersByTime(100)
  layer.render(gl, input)
  expect(state.scene).toBe(scene)
  expect(bridge.getX(0)).toBeCloseTo(0.45)
  expect(roadDeckLift.get(map)?.([0.005, 0])).toBe(0.45)
  expect(roadDeckLift.get(map)?.([1, 0])).toBe(0)
  expect(pools.find((m) => m.geometry.getAttribute('position').count === 24 && m.count > 0)).toBeDefined()
  const disposed = vi.spyOn(road.geometry, 'dispose')
  const instanceDisposed = vi.spyOn(pools[0], 'dispose')
  layer.onRemove!(map as unknown as Map, gl)
  expect(disposed).toHaveBeenCalledOnce()
  expect(instanceDisposed).toHaveBeenCalledOnce()
  expect(roadDeckLift.has(map)).toBe(false)
  expect(listeners.size).toBe(0)
  expect(failure).not.toHaveBeenCalled()
})
