// Run from the worktree: BASE=http://127.0.0.1:5210 node scripts/route3d-previews.mjs [output-directory]
// Starts/stops its own Vite on 5210. Never checks out files or writes node_modules.
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const base = process.env.BASE ?? 'http://127.0.0.1:5210'
const output = resolve(process.argv[2] ?? '../route3d-previews')
await mkdir(output, { recursive: true })
const catalog = JSON.parse(await readFile('public/data/catalog.json', 'utf8')).byways
const bigBend = 'big-bend-scenic-byway-2599'
const beartooth = catalog.find((road) => /beartooth highway/i.test(road.name))?.id
if (!beartooth) throw new Error('Beartooth Highway missing from catalog')
const errors = []
const captures = []
for (const phase of ['before', 'after']) {
  const server = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--port', '5210', '--strictPort', '--configLoader', 'runner', '--config', 'scripts/route3d-vite.ts'],
    {
      env: { ...process.env, ROUTE3D_BASELINE: phase === 'before' ? '1' : '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let browser
  try {
    await new Promise((done, fail) => {
      const timer = setTimeout(() => fail(new Error('Vite startup timed out')), 30000)
      const inspect = (data) => {
        const text = String(data)
        process.stdout.write(text)
        if (text.includes('Local:')) {
          clearTimeout(timer)
          done()
        }
      }
      server.stdout.on('data', inspect)
      server.stderr.on('data', inspect)
      server.once('exit', (code) => {
        clearTimeout(timer)
        fail(new Error(`Vite exited (${code}) before preview capture`))
      })
    })
    browser = await chromium.launch()
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      const device = viewport.width === 390 ? 'phone' : 'desktop'
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' })
      // A test-only map handle; production source is untouched.
      await context.route('**/src/features/map/maplibre.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        await route.fulfill({
          response,
          body:
            body +
            `\nconst previewAddControl = maplibregl.Map.prototype.addControl;
          maplibregl.Map.prototype.addControl = function(...args) { window.__previewMap = this; return previewAddControl.apply(this,args); };`,
        })
      })
      const page = await context.newPage()
      page.on('pageerror', (error) => errors.push({ phase, device, message: error.message }))
      page.on('requestfailed', (request) => {
        if (/elevation-tiles/.test(request.url()))
          errors.push({ phase, device, terrain: request.url(), message: request.failure()?.errorText })
      })
      page.on('response', (response) => {
        if (/elevation-tiles/.test(response.url()) && !response.ok())
          errors.push({ phase, device, terrain: response.url(), status: response.status() })
      })
      await page.addInitScript(() => localStorage.setItem('rambleroo.relief.v1', 'false'))
      const capture = async (name) => {
        await page.waitForTimeout(3000)
        const state = await page.evaluate(() => {
          const map = window.__previewMap
          return {
            zoom: map.getZoom(),
            pitch: map.getPitch(),
            terrain: !!map.getTerrain(),
            elevation: map.queryTerrainElevation(map.getCenter()),
            car: !!map.getLayer('garage-car-3d'),
            ribbon: !!map.getLayer('selected-road-3d'),
            carIcon: map.getLayoutProperty('route-car', 'visibility'),
            selectedArtOpacity: map.getPaintProperty('selected-art', 'line-opacity') ?? 1,
          }
        })
        const path = `${output}/${phase}-${device}-${name}.png`
        await page.screenshot({ path })
        captures.push({ path, ...state })
      }
      const open = async (id) => {
        await page.goto(`${base}/?byway=${id}`, { waitUntil: 'domcontentloaded' })
        await page.waitForFunction(() => window.__previewMap?.getSource('selected'))
        await page.waitForTimeout(3500)
      }
      await open(bigBend)
      for (const relief of [false, true]) {
        if (relief) await page.getByRole('button', { name: '3D', exact: true }).click()
        const bounds = catalog.find((road) => road.id === bigBend).bbox
        await page.evaluate((bbox) => window.__previewMap.fitBounds(bbox, { padding: 100, duration: 0 }), bounds)
        await capture(`big-bend-overview-${relief ? 'terrain' : 'flat'}`)
        await page.evaluate(() => {
          const map = window.__previewMap
          const features = map.getSource('selected').serialize().data.features
          const parts = features.flatMap((f) => (f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates))
          let nearest,
            next,
            distance = Infinity
          for (const part of parts)
            for (let i = 0; i < part.length - 1; i++) {
              const p = part[i],
                d = (p[0] + 84.385) ** 2 + (p[1] - 29.975) ** 2
              if (d < distance) {
                distance = d
                nearest = p
                next = part[i + 1]
              }
            }
          // Park on the same actual route vertex for reproducible closeups, in both phases.
          const bearing =
            (Math.atan2((next[0] - nearest[0]) * Math.cos((nearest[1] * Math.PI) / 180), next[1] - nearest[1]) * 180) / Math.PI
          map
            .getSource('route-car')
            .setData({ type: 'Feature', properties: { bearing }, geometry: { type: 'Point', coordinates: nearest } })
          map.jumpTo({ center: nearest, zoom: 12, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 } })
        })
        await capture(`ochlockonee-z12-${relief ? 'terrain' : 'flat'}`)
        if (!relief) {
          const pitch = await page.evaluate(() => window.__previewMap.getPitch())
          await page.evaluate(() => window.__previewMap.jumpTo({ pitch: 0 }))
          await capture('ochlockonee-z12-flat-top-down')
          await page.evaluate((pitch) => window.__previewMap.jumpTo({ pitch }), pitch)
        }
      }
      await open(beartooth)
      await page.getByRole('button', { name: '3D', exact: true }).click()
      await page.evaluate(() => window.__previewMap.jumpTo({ center: [-109.466, 44.969], zoom: 12 }))
      await capture('beartooth-z12-terrain')
      const countryViews = [
        { id: bigBend, name: 'ochlockonee-bridge', center: [-84.384, 29.966], zooms: [12, 14] },
        { id: bigBend, name: 'st-marks-light', center: [-84.18, 30.074], zooms: [12, 14] },
        { id: 'kancamagus-scenic-byway-2458', name: 'kancamagus-forest', center: [-71.491, 44.022], zooms: [12] },
        { id: 'glacial-ridge-trail-scenic-byway-11186', name: 'glacial-ridge-prairie', center: [-95.27028, 45.32056], zooms: [12] },
        { id: 'scenic-byway-12-2020', name: 'byway-12-desert', center: [-111.421, 37.747], zooms: [12] },
        { id: bigBend, name: 'sopchoppy-town', center: [-84.496, 30.059], zooms: [14] },
      ]
      for (const view of countryViews) {
        if (!catalog.some((road) => road.id === view.id)) throw new Error(`Missing preview road: ${view.id}`)
        await open(view.id)
        for (const zoom of view.zooms) {
          await page.evaluate(
            ({ center, zoom }) =>
              window.__previewMap.jumpTo({ center, zoom, pitch: 45, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 } }),
            { center: view.center, zoom },
          )
          await capture(`${view.name}-z${zoom}`)
        }
      }
      await context.close()
    }
  } catch (error) {
    errors.push({ phase, message: String(error) })
    throw error
  } finally {
    await browser?.close()
    const stopped = new Promise((done) => server.once('exit', done))
    if (server.exitCode === null) {
      server.kill('SIGTERM')
      await stopped
    }
    await writeFile(`${output}/capture-log.json`, JSON.stringify({ captures, errors }, null, 2))
  }
}
console.log(`Previews: ${output}`)
