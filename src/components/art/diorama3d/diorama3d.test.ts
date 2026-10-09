import { describe, expect, it } from 'vitest'
import Ajv from 'ajv'
import * as T from 'three'
import { specs, specSchema } from './fixtures.test-data'
import { buildScene, solarHour, triangleCount, ribbon } from './scene'
import { defaultGarage, models as vehicles } from '../../../lib/garage'
import { makeRoute, SPIN_PER_SECOND, DRAG_RADIANS_PER_PX } from './route'
import { buildModel } from './models'
import { models } from './spec'
import { disposeVehicle } from '../vehicle3d'

const validate = new Ajv().compile(specSchema)
describe('authored road specs', () => {
  for (const spec of specs)
    it(spec.bywayId, () => {
      expect(validate(spec), JSON.stringify(validate.errors)).toBe(true)
      expect(spec.landmarks.map((l) => l.at)).toEqual(spec.landmarks.map((l) => l.at).sort((a, b) => a - b))
      expect(spec.road.elevation[0][0]).toBe(0)
      expect(spec.road.elevation.at(-1)![0]).toBe(1)
      for (const town of spec.towns) expect(spec.landmarks.some((l) => l.name === town.landmark)).toBe(true)
    })
  it('rejects unknown models, invalid locations and missing route geometry', () => {
    const bad = structuredClone(specs[0])
    bad.landmarks[0].at = 2
    expect(validate(bad)).toBe(false)
    expect(validate({ ...specs[0], road: { ...specs[0].road, coordinates: [] } })).toBe(false)
    expect(validate({ ...specs[0], landmarks: [{ ...specs[0].landmarks[0], model: 'generic-box' }] })).toBe(false)
  })
})
describe('scene graphs without WebGL', () => {
  for (const spec of specs)
    for (const hour of [13, 21])
      it(`${spec.title} at ${hour}:00 fits budget`, () => {
        const built = buildScene(spec, defaultGarage, { hour, season: 'summer', weather: 'clear' })
        expect(built.landmarkGroups.map((g) => g.name)).toEqual(spec.landmarks.map((l) => l.name))
        const count = triangleCount(built.scene) - triangleCount(built.driver)
        expect(count).toBeLessThanOrEqual(2000)
        for (const t of [0, 15, 40, 75, 99]) {
          built.update(t)
          expect(built.driver.position.distanceTo(built.route.sample(t / 100))).toBeCloseTo(0.06)
          expect(built.driver.quaternion.toArray().every(Number.isFinite)).toBe(true)
          built.scene.updateMatrixWorld(true)
          const forward = new T.Vector3(0, 1, 0).transformDirection(built.driver.children[0].matrixWorld)
          expect(forward.dot(built.route.frame(t / 100).tangent)).toBeGreaterThan(0.999)
        }
        built.scene.traverse((o) => expect(o.position.toArray().every(Number.isFinite)).toBe(true))
        built.dispose()
      })
  it('builds every weather, season and garage model', () => {
    for (const weather of ['clear', 'cloudy', 'rain', 'snow', 'fog'] as const)
      for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
        const built = buildScene(specs[1], defaultGarage, { hour: 21, weather, season })
        built.update(12)
        built.dispose()
      }
    for (const model of vehicles) {
      const built = buildScene(specs[0], { ...defaultGarage, model }, { hour: 13, weather: 'clear', season: 'summer' })
      built.dispose()
    }
  })
  it('implements every named primitive', () => {
    for (const model of models) {
      const group = buildModel(model, {
        paper: '#ffffff',
        far: '#aaaaaa',
        mid: '#888888',
        dark: '#333333',
        accent: '#999999',
        water: '#448888',
        foliage: '#448844',
        night: true,
        snow: false,
      })
      expect(group.children.length).toBeGreaterThan(0)
      disposeVehicle(group)
    }
  })
  it('preserves rising terrain and route extent', () => {
    const route = makeRoute(specs[1])
    expect(route.sample(0.5).y - route.sample(0).y).toBeGreaterThan(1)
    expect(route.sample(0).distanceTo(route.sample(1))).toBeGreaterThan(3)
  })
})
it('turns a full circle in about forty seconds and drags at a steady rate', () => {
  expect(SPIN_PER_SECOND * 40).toBeCloseTo(2 * Math.PI)
  expect(DRAG_RADIANS_PER_PX * 300).toBeCloseTo(Math.PI)
})
it('resolves longitude-based solar time across midnight', () => {
  expect(solarHour(-120, new Date('2026-07-01T21:00:00Z'))).toBe(13)
  expect(solarHour(-120, new Date('2026-07-01T05:00:00Z'))).toBe(21)
})

it('joins road and centre-line corners continuously through sharp bends', () => {
  const points = [new T.Vector3(0, 0, 0), new T.Vector3(1, 0.3, 0), new T.Vector3(1, 0.5, 1), new T.Vector3(0.8, 0.6, 0.2)]
  for (const width of [0.34, 0.028]) {
    const mesh = ribbon(points, width)
    const positions = mesh.getAttribute('position')
    const vertex = (i: number) => new T.Vector3().fromBufferAttribute(positions, i)
    for (let i = 6; i < positions.count; i += 6) {
      expect(vertex(i).distanceTo(vertex(i - 5))).toBe(0)
      expect(vertex(i + 2).distanceTo(vertex(i - 1))).toBe(0)
    }
    mesh.dispose()
  }
})
