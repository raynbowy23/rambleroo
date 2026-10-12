import { expect, it } from 'vitest'
import { Box3, Mesh, Vector3 } from 'three'
import { defaultGarage, models, roofs, accents } from '../../lib/garage'
import { buildShip, buildVehicle, disposeVehicle } from './vehicle3d'

it.each(models)('builds a non-empty %s with each roof accessory', (model) => {
  for (const roof of roofs) {
    const group = buildVehicle({ ...defaultGarage, model, roof })
    const meshes = group.children.filter((child) => child instanceof Mesh)
    expect(meshes.length).toBeGreaterThan(0)
    expect(meshes.every((mesh) => mesh.geometry.getAttribute('position').count > 0)).toBe(true)
    disposeVehicle(group)
  }
})

it.each(models)('%s stays within its footprint and 1,500 triangles for every configuration', (model) => {
  for (const roof of roofs)
    for (const accent of accents) {
      const group = buildVehicle({ ...defaultGarage, model, roof, accent })
      const bounds = new Box3().setFromObject(group)
      const size = bounds.getSize(new Vector3())
      let triangles = 0
      group.traverse((object) => {
        if (object instanceof Mesh) {
          triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          expect(materials.every((m) => m.depthTest && m.depthWrite)).toBe(true)
        }
      })
      expect(triangles, `${model}/${roof}/${accent}`).toBeLessThanOrEqual(1500)
      expect(size.x).toBeLessThanOrEqual(1.951)
      expect(size.y).toBeLessThanOrEqual(roof === 'canoe' || roof === 'surfboard' ? 4.91 : 4.31)
      expect(bounds.min.z).toBeGreaterThanOrEqual(-0.001)
      disposeVehicle(group)
    }
})

it('keeps the ferry and every carried-car configuration under budget', () => {
  for (const model of models)
    for (const roof of roofs)
      for (const accent of accents) {
        const ship = buildShip({ ...defaultGarage, model, roof, accent })
        let triangles = 0
        ship.traverse((object) => {
          if (object instanceof Mesh) triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3
        })
        expect(triangles, `${model}/${roof}/${accent}`).toBeLessThanOrEqual(1500)
        const size = new Box3().setFromObject(ship).getSize(new Vector3())
        expect(size.x).toBeLessThan(3)
        expect(size.y).toBeLessThan(7.3)
        disposeVehicle(ship)
      }
})

it.each(models)('%s carries every supported accessory in contact with the body', (model) => {
  for (const roof of roofs) {
    const group = buildVehicle({ ...defaultGarage, model, roof })
    const accessory = group.getObjectByName('accessory')
    const omitted = roof === 'none' || (model === 'motorcycle' && (roof === 'canoe' || roof === 'bikes'))
    expect(Boolean(accessory), `${model}/${roof}`).toBe(!omitted)
    if (accessory) {
      const bounds = new Box3().setFromObject(accessory)
      const bodyBounds = group.children.filter((child) => child instanceof Mesh).map((child) => new Box3().setFromObject(child))
      // Compare with individual body parts, not the whole vehicle's envelope:
      // the latter would incorrectly count empty space above open seats as support.
      const gap = (a: Box3, b: Box3) =>
        new Vector3(
          Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x),
          Math.max(0, a.min.y - b.max.y, b.min.y - a.max.y),
          Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z),
        ).length()
      const supports = bodyBounds.filter((body) => body.min.z <= bounds.min.z)
      expect(Math.min(...supports.map((body) => gap(bounds, body))), `${model}/${roof} body contact`).toBeLessThanOrEqual(0.05)
      const cargo = new Box3().setFromObject(accessory.getObjectByName('cargo')!)
      const rack = accessory.getObjectByName('rack')!
      expect(
        Math.min(...rack.children.map((part) => gap(cargo, new Box3().setFromObject(part)))),
        `${model}/${roof} cargo contact`,
      ).toBeLessThanOrEqual(0.05)
      // Every rack piece must connect to the body or another rack piece.
      for (const part of rack.children) {
        const partBounds = new Box3().setFromObject(part)
        const neighbors = [
          ...bodyBounds,
          ...rack.children.filter((other) => other !== part).map((other) => new Box3().setFromObject(other)),
        ]
        expect(Math.min(...neighbors.map((other) => gap(partBounds, other))), `${model}/${roof} rack contact`).toBeLessThanOrEqual(0.05)
      }
    }
    disposeVehicle(group)
  }
})

it('builds a motorcycle without adding an implausible canoe or bicycle carrier', () => {
  const bare = buildVehicle({ ...defaultGarage, model: 'motorcycle', roof: 'none' })
  for (const roof of ['canoe', 'bikes'] as const) {
    const vehicle = buildVehicle({ ...defaultGarage, model: 'motorcycle', roof })
    expect(vehicle.children.length).toBe(bare.children.length)
    expect(new Box3().setFromObject(vehicle)).toEqual(new Box3().setFromObject(bare))
    disposeVehicle(vehicle)
  }
  disposeVehicle(bare)
})
