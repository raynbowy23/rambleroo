import { expect, it } from 'vitest'
import { Mesh } from 'three'
import { defaultGarage, models, roofs } from '../../lib/garage'
import { buildVehicle, disposeVehicle } from './vehicle3d'

it.each(models)('builds a non-empty %s with each roof accessory', (model) => {
  for (const roof of roofs) {
    const group = buildVehicle({ ...defaultGarage, model, roof })
    const meshes = group.children.filter((child) => child instanceof Mesh)
    expect(meshes.length).toBeGreaterThan(0)
    expect(meshes.every((mesh) => mesh.geometry.getAttribute('position').count > 0)).toBe(true)
    disposeVehicle(group)
  }
})
