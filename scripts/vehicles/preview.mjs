/** Run: node scripts/vehicles/preview.mjs before|after [output-directory].
 * Before loads the three affected rendering modules directly from git HEAD.
 * Falls back to a software rasterizer if Chromium cannot launch.
 * No development server or node_modules writes are required.
 */
import { chromium } from '@playwright/test'
import { build } from 'esbuild'
import { softwarePreview } from './software.mjs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const run = promisify(execFile)
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
const phase = process.argv[2] ?? 'after'
if (!['before', 'after'].includes(phase)) throw new Error('Expected before or after')
const root = process.cwd()
const output = path.resolve(process.argv[3] ?? `../vehicle-previews/${phase}`)
await mkdir(output, { recursive: true })
const originals = ['src/components/art/vehicle3d.ts', 'src/components/art/diorama3d/scene.ts', 'src/components/art/diorama3d/renderer.ts']
const bundle = await build({
  stdin: {
    contents: `import * as T from 'three'; import { buildVehicle, buildShip, disposeVehicle } from './src/components/art/vehicle3d'; import { defaultGarage, models } from './src/lib/garage'; import { buildScene } from './src/components/art/diorama3d/scene'; import { registerScene } from './src/components/art/diorama3d/renderer'; window.preview = { T, buildVehicle, buildShip, disposeVehicle, defaultGarage, models, buildScene, registerScene };`,
    resolveDir: root,
  },
  bundle: true,
  write: false,
  format: 'iife',
  plugins: [
    {
      name: 'head-models',
      setup(build) {
        build.onLoad({ filter: /\.ts$/ }, async ({ path: filename }) => {
          const relative = path.relative(root, filename)
          if (phase === 'before' && originals.includes(relative))
            return {
              contents: (await run('git', ['show', `HEAD:${relative}`], { encoding: 'utf8' })).stdout,
              loader: 'ts',
              resolveDir: path.dirname(filename),
            }
        })
      },
    },
  ],
})
const spec = JSON.parse(await readFile('public/data/dioramas/route-1-big-sur-coast-highway-2301.json', 'utf8'))
let browser
try {
  if (process.env.VEHICLE_SOFTWARE === '1') {
    await softwarePreview(bundle.outputFiles[0].text, spec, output, phase)
    process.exit(0)
  }
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const page = await browser.newPage({ viewport: { width: 960, height: 720 }, reducedMotion: 'reduce' })
  page.on('pageerror', (error) => console.error(error))
  await page.setContent('<html><body style="margin:0;background:#f6ead3"><div id="root"></div></body></html>')
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  const result = await page.evaluate(async () => {
    const { T, buildVehicle, buildShip, disposeVehicle, defaultGarage, models } = window.preview
    const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(480, 360)
    renderer.setClearColor('#f6ead3')
    renderer.outputColorSpace = T.SRGBColorSpace
    const scene = new T.Scene()
    scene.add(new T.AmbientLight('#ffffff', 2))
    const sun = new T.DirectionalLight('#fff3d8', 2.5)
    sun.position.set(-3, 4, 8)
    scene.add(sun)
    const camera = new T.OrthographicCamera(-3.7, 3.7, 2.775, -2.775, 0.1, 100)
    camera.up.set(0, 0, 1)
    const images = [],
      stats = []
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
        scene.add(vehicle)
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
          renderer.render(scene, camera)
          images.push({ name: `${model}-${variant}-${angle}`, data: renderer.domElement.toDataURL('image/png') })
        }
        scene.remove(vehicle)
        disposeVehicle(vehicle)
      }
    renderer.dispose()
    return { images, stats }
  })
  for (const image of result.images)
    await writeFile(path.join(output, `${image.name}.png`), Buffer.from(image.data.split(',')[1], 'base64'))
  await writeFile(path.join(output, 'metrics.json'), JSON.stringify(result.stats, null, 2))
  await page.setViewportSize({ width: 1440, height: (result.images.length / 3) * 396 })
  await page.evaluate(
    ({ images, phase }) => {
      document.body.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,480px);font:16px monospace;color:#252b22">${images.map(({ name, data }) => `<div><div style="height:36px;line-height:36px;padding-left:16px">${phase} / ${name}</div><img style="display:block" width="480" height="360" src="${data}"></div>`).join('')}</div>`
    },
    { images: result.images, phase },
  )
  await page.screenshot({ path: path.join(output, 'contact-sheet.png'), fullPage: true })
  await page.setViewportSize({ width: 960, height: 720 })
  await page.setContent('<html><body style="margin:0;background:#f6ead3"><div id="root"></div></body></html>')
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  await page.evaluate(async (spec) => {
    const { buildScene, registerScene, defaultGarage } = window.preview
    const built = buildScene(spec, defaultGarage, { hour: 13, season: 'summer', weather: 'clear' })
    const update = built.update
    built.update = () => update(24)
    built.update()
    const element = document.createElement('div')
    element.style.cssText = 'width:960px;height:720px'
    document.getElementById('root').append(element)
    const style = document.createElement('style')
    style.textContent = '.rr-mini-canvas {position:fixed;inset:0;pointer-events:none}.rr-mini-town {display:none}'
    document.head.append(style)
    registerScene(element, built)
  }, spec)
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(output, 'miniature.png') })
  console.log(`Saved ${result.images.length} vehicle views, contact sheet, metrics and miniature to ${output}`)
} catch (error) {
  if (browser) throw error
  console.warn('Chromium unavailable; using software rasterizer:', error.message.split('\n')[0])
  await softwarePreview(bundle.outputFiles[0].text, spec, output, phase)
} finally {
  await browser?.close()
}
