/** Deterministic orthographic fallback for sandboxes that cannot launch Chromium. */
import { writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
export async function softwarePreview(bundle, spec, output, phase) {
  globalThis.window = {}
  new Function(bundle)()
  const { T, buildVehicle, buildShip, disposeVehicle, defaultGarage, models, buildScene } = window.preview
  const camera = new T.OrthographicCamera(-3.7, 3.7, 2.775, -2.775, 0.1, 100)
  camera.up.set(0, 0, 1)
  const images = [],
    stats = []
  function capture(object, camera, width, height, miniature = false) {
    object.updateMatrixWorld(true)
    camera.updateMatrixWorld(true)
    const triangles = []
    const light = new T.Vector3(-3, 4, 8).normalize()
    object.traverse((mesh) => {
      if (!mesh.isMesh || !mesh.visible) return
      const geometry = mesh.geometry,
        positions = geometry.attributes.position,
        indices = geometry.index
      const count = indices?.count ?? positions.count
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      const normalMatrix = new T.Matrix3().getNormalMatrix(mesh.matrixWorld)
      for (let i = 0; i < count; i += 3) {
        const vertices = [0, 1, 2].map((j) => new T.Vector3().fromBufferAttribute(positions, indices ? indices.getX(i + j) : i + j))
        const normal = vertices[1]
          .clone()
          .sub(vertices[0])
          .cross(vertices[2].clone().sub(vertices[0]))
          .normalize()
          .applyMatrix3(normalMatrix)
          .normalize()
        const world = vertices.map((v) => v.applyMatrix4(mesh.matrixWorld))
        if (material.side !== T.DoubleSide && normal.dot(camera.position.clone().sub(world[0])) < 0) continue
        const projected = world.map((v) => {
          v.project(camera)
          return [((v.x + 1) * width) / 2, ((1 - v.y) * height) / 2, v.z]
        })
        const color = material.color
          .clone()
          .multiplyScalar(0.62 + 0.55 * Math.max(0, normal.dot(light)))
          .convertLinearToSRGB()
        triangles.push({
          vertices: projected,
          color: color.toArray().map((c) => Math.round(Math.min(1, c) * 255)),
          layer: miniature && mesh.layers.mask === 2 ? 1 : 0,
          depth: material.depthTest,
          order: mesh.renderOrder,
        })
      }
    })
    triangles.sort((a, b) => a.layer - b.layer || a.order - b.order)
    return { width, height, triangles }
  }
  const roofs = ['surfboard', 'luggage', 'canoe', 'bikes', 'luggage', 'luggage']
  for (const [i, model] of [...models, 'ferry'].entries())
    for (const variant of ['default', 'alternate', 'luggage', 'surfboard', 'canoe', 'bikes']) {
      const garage = {
        ...defaultGarage,
        model: model === 'ferry' ? 'coupe' : model,
        ...(variant === 'alternate'
          ? { body: '#5a6844', accent: i % 2 ? 'stripe' : 'two-tone', accentColor: '#f5e6c8', roof: roofs[i % 6] }
          : {}),
      }
      if (variant !== 'default' && variant !== 'alternate') garage.roof = variant
      const vehicle = model === 'ferry' ? buildShip(garage) : buildVehicle(garage)
      let triangles = 0
      vehicle.traverse((o) => {
        if (o.isMesh) triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3
      })
      stats.push({ model, variant, triangles, bounds: new T.Box3().setFromObject(vehicle).getSize(new T.Vector3()).toArray() })
      camera.zoom = model === 'ferry' ? 0.75 : 1
      camera.updateProjectionMatrix()
      for (const [angle, position] of [
        ['front', [7, 9, 6]],
        ['side', [12, 0, 4]],
        ['rear', [7, -9, 6]],
      ]) {
        camera.position.set(...position)
        camera.lookAt(0, 0, 1.2)
        images.push({ name: `${model}-${variant}-${angle}`, ...capture(vehicle, camera, 480, 360) })
      }
      disposeVehicle(vehicle)
    }
  const budgets = []
  for (const model of [...models, 'ferry']) {
    const counts = []
    for (const roof of ['none', 'surfboard', 'canoe', 'bikes', 'luggage'])
      for (const accent of ['none', 'stripe', 'two-tone']) {
        const object =
          model === 'ferry'
            ? buildShip({ ...defaultGarage, model: 'wagon', roof, accent })
            : buildVehicle({ ...defaultGarage, model, roof, accent })
        let triangles = 0
        object.traverse((o) => {
          if (o.isMesh) triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3
        })
        counts.push(triangles)
        disposeVehicle(object)
      }
    budgets.push({ model, min: Math.min(...counts), max: Math.max(...counts) })
  }
  await writeFile(path.join(output, 'triangle-budgets.json'), JSON.stringify(budgets, null, 2))
  const built = buildScene(spec, defaultGarage, { hour: 13, season: 'summer', weather: 'clear' })
  built.update(24)
  built.camera.left = -8.4
  built.camera.right = 8.4
  built.camera.top = 6.3
  built.camera.bottom = -6.3
  built.camera.updateProjectionMatrix()
  images.push({ name: 'miniature', ...capture(built.scene, built.camera, 960, 720, true) })
  built.dispose()
  await writeFile(path.join(output, 'metrics.json'), JSON.stringify(stats, null, 2))
  const input = path.join(output, 'render-data.json')
  await writeFile(input, JSON.stringify({ images, phase }))
  await promisify(execFile)('python3', ['scripts/vehicles/raster.py', input, output], { maxBuffer: 1024 * 1024 })
  console.log(`Saved software-rendered previews to ${output}`)
}
