import * as THREE from 'three'
import maplibre, { type CustomLayerInterface, type Map } from './maplibre'
import { buildShip, buildVehicle, disposeVehicle } from '../../components/art/vehicle3d'
import type { Garage } from '../../lib/garage'
import { loadCarPicture } from '../../lib/carPicture'

export const carLayerId = 'garage-car-3d'
/** `ship`: a marine-highway route, where the car rides aboard a ferry instead of driving. */
export function createCarLayer(garage: Garage, initial: [number, number], heading = 0, ship = false) {
  let point = initial
  let bearing = heading
  let map: Map
  let renderer: THREE.WebGLRenderer
  let disposed = false
  const camera = new THREE.Camera()
  camera.matrixAutoUpdate = false
  camera.matrixWorldAutoUpdate = false
  const view = new THREE.Matrix4()
  const scene = new THREE.Scene()
  const vehicle = ship ? buildShip(garage) : buildVehicle(garage)
  const snow = new THREE.Mesh(
    new THREE.BoxGeometry(
      1.48,
      garage.model === 'camper' ? 3.52 : garage.model === 'pickup' ? 0.81 : garage.model === 'wagon' ? 2.01 : 1.64,
      0.08,
    ),
    new THREE.MeshStandardMaterial({ color: '#f7faff', roughness: 1 }),
  )
  snow.position.set(
    0,
    garage.model === 'pickup' ? 0.615 : garage.model === 'camper' ? 0 : garage.model === 'wagon' ? -0.235 : -0.05,
    garage.model === 'camper' ? 2.68 : 2.25,
  )
  snow.visible = false
  vehicle.add(snow)
  scene.add(vehicle, new THREE.AmbientLight(0xffffff, 2))
  const sun = new THREE.DirectionalLight(0xfff5db, 3)
  sun.position.set(-4, 5, 8)
  scene.add(sun)
  const layer: CustomLayerInterface = {
    id: carLayerId,
    type: 'custom',
    renderingMode: '3d',
    onAdd(current, gl) {
      map = current
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl })
      renderer.autoClear = false
      // A ferry stays a ferry; the round car picture is for roads.
      if (!ship && garage.usePicture && garage.picture)
        void loadCarPicture(garage.picture)
          .then(async (url) => {
            if (!url || disposed) return
            const picture = new Image()
            picture.src = url
            await picture.decode()
            if (disposed) return
            const canvas = document.createElement('canvas')
            canvas.width = canvas.height = 256
            const ctx = canvas.getContext('2d')!
            ctx.fillStyle = '#f5e6c8'
            ctx.beginPath()
            ctx.arc(128, 128, 126, 0, Math.PI * 2)
            ctx.fill()
            ctx.beginPath()
            ctx.arc(128, 128, 114, 0, Math.PI * 2)
            ctx.clip()
            ctx.drawImage(picture, 14, 14, 228, 228)
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }))
            sprite.scale.set(4, 4, 1)
            sprite.position.z = 2
            disposeVehicle(vehicle)
            vehicle.clear()
            vehicle.add(sprite)
            map.triggerRepaint()
          })
          .catch(() => {})
    },
    render(_gl, input) {
      const angle = (bearing * Math.PI) / 180
      sun.position.set(-4 * Math.cos(angle) - 5 * Math.sin(angle), -4 * Math.sin(angle) + 5 * Math.cos(angle), 8)
      const elevation = map.queryTerrainElevation(point) ?? 0
      const location = maplibre.MercatorCoordinate.fromLngLat(point, elevation)
      // Size the toy in screen pixels (~64 px long for a ~4.5-unit model), so it reads as a toy on the relief map at any
      // zoom. Metres per pixel follow Web Mercator with MapLibre's 512 px tiles.
      const metresPerPixel = (40075016.686 * Math.cos((point[1] * Math.PI) / 180)) / (512 * 2 ** map.getZoom())
      const metres = (64 / 4.5) * metresPerPixel
      const scale = location.meterInMercatorCoordinateUnits() * metres
      const transform = new THREE.Matrix4()
        .makeTranslation(location.x, location.y, location.z)
        .scale(new THREE.Vector3(scale, -scale, scale))
        .multiply(new THREE.Matrix4().makeRotationZ((-bearing * Math.PI) / 180))
      // Separate view and projection so picture sprites really face the camera.
      camera.projectionMatrix.fromArray(input.projectionMatrix)
      view
        .copy(camera.projectionMatrix)
        .invert()
        .multiply(new THREE.Matrix4().fromArray(input.defaultProjectionData.mainMatrix))
        .multiply(transform)
      camera.matrixWorldInverse.copy(view)
      camera.matrixWorld.copy(view).invert()
      renderer.resetState()
      renderer.render(scene, camera)
      renderer.resetState()
    },
    onRemove() {
      disposed = true
      disposeVehicle(scene)
      renderer?.dispose()
    },
  }
  return {
    layer,
    setSnow(enabled: boolean) {
      if (ship) return
      snow.visible = enabled && !garage.usePicture && garage.model !== 'motorcycle' && garage.model !== 'convertible'
      map?.triggerRepaint()
    },
    update(next: [number, number], angle: number) {
      point = next
      bearing = angle
      map?.triggerRepaint()
    },
  }
}
