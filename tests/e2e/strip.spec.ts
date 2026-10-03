import { expect, test } from './fixtures'

const id = 'door-county-coastal-byway-81450'
const route = `/byway/${id}/strip`

test('unrolls from the byway page and drives as the page scrolls', async ({ page }) => {
  await page.goto(`/byway/${id}`)
  await page.getByRole('link', { name: 'Drive it' }).first().click()
  await expect(page).toHaveURL(new RegExp(route))
  await expect(page.getByRole('heading', { name: 'Door County Coastal Byway', exact: true })).toBeVisible()
  await expect(page.getByText('Draft · pending review', { exact: true })).toBeVisible()
  const counter = page.getByTestId('mile-counter')
  const mile = async () => Number((await counter.textContent())?.match(/Mile ([\d.]+)/)?.[1])
  const before = await mile()
  await page.evaluate(() => window.scrollBy(0, 1300))
  await expect.poll(mile).toBeGreaterThan(before)
})

test('selects, shares a URL and saves Bay villages to the passport', async ({ page }) => {
  const strip = await (await page.request.get(`/data/strips/${id}.json`)).json()
  const bay = strip.stretches.find((stretch: { id: string }) => stretch.id === 'bay-villages')
  await page.goto(route)
  await page.getByRole('navigation', { name: 'Choose a stretch' }).getByRole('button', { name: 'Bay villages' }).click()
  const card = page.getByRole('region', { name: 'Bay villages stretch' })
  await expect(card).toBeVisible()
  // Stretches without a verified route show distance only.
  const timing = bay.minutes === null ? 'drive time not verified for this stretch' : `about ${bay.minutes} min driving`
  await expect(card.getByText(`≈ ${bay.mappedMiles} mi · ${timing}`)).toBeVisible()
  await expect(page).toHaveURL(/stretch=bay-villages/)
  const href = await card.getByRole('link', { name: 'Drive this stretch' }).getAttribute('href')
  expect(new URL(href!).searchParams.get('waypoints')?.split('|')).toHaveLength(3)
  // Save, unsave, and save again from the same card (it used to lock as "Stretch saved").
  await card.getByRole('button', { name: 'Save stretch', exact: true }).click()
  await expect(card.getByRole('button', { name: 'Saved', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await card.getByRole('button', { name: 'Saved', exact: true }).click()
  await expect(card.getByRole('button', { name: 'Save stretch', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await card.getByRole('button', { name: 'Save stretch', exact: true }).click()
  await page.goto('/passport')
  await expect(page.getByRole('heading', { name: 'Saved roads', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Door County Coastal Byway · Bay villages', exact: true })).toBeVisible()
})

test('opens the tip in place and counts branch miles', async ({ page }) => {
  await page.goto(route)
  const toggle = page.getByRole('button', { name: /Out to the tip · \+[\d.]+ mi/ })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#tip-ribbon').getByText('Gills Rock', { exact: true })).toBeVisible()
  await page.locator('#tip-ribbon').getByText('Ellison Bay', { exact: true }).scrollIntoViewIfNeeded()
  await expect(page.getByTestId('mile-counter')).toContainText('Tip · mile')
  await toggle.click()
  await expect(page.locator('#tip-ribbon')).toHaveCount(0)
})

test('fits a 390px screen, including the expanded tip and selected card', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${route}?stretch=the-tip`)
  await expect(page.getByRole('region', { name: 'Out to the tip stretch' })).toBeVisible()
  await expect(page.locator('#tip-ribbon')).toBeVisible()
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(await overflow()).toBe(0)
  await page.getByRole('button', { name: 'Close stretch', exact: true }).click()
  await page.locator('#tip-ribbon').getByText('Gills Rock', { exact: true }).scrollIntoViewIfNeeded()
  expect(await overflow()).toBe(0)
})

test('a road without strip data offers a way back', async ({ page }) => {
  await page.route('**/data/strips/index.json', (route) => route.fulfill({ json: [] }))
  await page.goto('/byway/great-river-road-2279/strip')
  await expect(page.getByRole('heading', { name: 'No strip map for this road yet' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to the road' })).toHaveAttribute('href', '/byway/great-river-road-2279')
})

// Regression: narrow town signs broke names mid-word ("Jacks onpor t") and let the info link overlap the name.
test('town signs keep whole names and never overlap their info link', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/byway/door-county-coastal-byway-81450/strip')
  await expect(page.getByText('Jacksonport', { exact: true }).first()).toBeAttached()
  const problems = await page.evaluate(() =>
    [...document.querySelectorAll('[class*="town"]')]
      .filter((sign) => sign.querySelector('strong'))
      .flatMap((sign) => {
        const name = sign.querySelector('strong')!
        const r = name.getBoundingClientRect()
        const a = sign.querySelector('a')?.getBoundingClientRect()
        const out: string[] = []
        if (getComputedStyle(name).overflowWrap === 'anywhere' || getComputedStyle(name).wordBreak === 'break-all')
          out.push(`${name.textContent} may break mid-word`)
        if (a && a.left < r.right && a.top < r.bottom && a.right > r.left && a.bottom > r.top)
          out.push(`${name.textContent} overlaps its info link`)
        return out
      }),
  )
  expect(problems).toEqual([])
})

test('shows the road in all four seasons at a glance, and picking one repaints the stops', async ({ page }) => {
  await page.goto('/byway/door-county-coastal-byway-81450/strip')
  const glance = page.getByRole('group', { name: 'The same road, four seasons' })
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    await expect(glance.getByRole('button', { name: `Show ${season} along the road` })).toBeVisible()
    await expect(glance.locator(`[data-season-atmosphere^="${season}"]`)).toHaveCount(1)
  }
  await glance.getByRole('button', { name: 'Show winter along the road' }).click()
  await expect(glance.getByRole('button', { name: 'Show winter along the road' })).toHaveAttribute('aria-pressed', 'true')
})

test('header tagline stays on one line', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/collections')
  const tagline = page.getByText(/Scenic roads of America/i).first()
  const box = await tagline.boundingBox()
  const lineHeight = await tagline.evaluate(
    (el) => parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.5,
  )
  expect(box!.height).toBeLessThan(lineHeight * 1.6)
})

test('choosing a stretch drives to its first mile', async ({ page }) => {
  await page.goto('/byway/door-county-coastal-byway-81450/strip')
  const counter = page.locator('output').first()
  await page.getByRole('navigation', { name: 'Choose a stretch' }).getByRole('button', { name: 'Bay villages' }).click()
  // Bay villages starts at Sister Bay, mile 33.6.
  await expect
    .poll(async () => Number((await counter.textContent())?.match(/Mile ([\d.]+)/)?.[1] ?? 0), { timeout: 5000 })
    .toBeGreaterThan(32)
  expect(Number((await counter.textContent())?.match(/Mile ([\d.]+)/)?.[1])).toBeLessThan(35.5)
})

test('Blue Ridge stays compact and jumps to Into the Smokies', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const id = 'blue-ridge-parkway-2280'
  const response = await page.request.get(`/data/strips/${id}.json`)
  const data = await response.json()
  const stretch = data.stretches.find((entry: { title: string }) => entry.title === 'Into the Smokies')
  expect(stretch).toBeTruthy()
  await page.goto(`/byway/${id}/strip`)
  await expect(page.getByRole('heading', { name: data.title, exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(16000)
  await page.getByRole('navigation', { name: 'Choose a stretch' }).getByRole('button', { name: 'Into the Smokies' }).click()
  await expect
    .poll(async () =>
      Math.abs(Number((await page.getByTestId('mile-counter').textContent())?.match(/Mile ([\d.]+)/)?.[1]) - stretch.fromMile),
    )
    .toBeLessThan(2)
})

test('3D scroll driving follows the ribbon, restores the inset and remembers the choice', async ({ page }) => {
  // Test browsers render WebGL in software (SwiftShader), so 3D pages are slow under parallel load.
  test.slow()
  // A deterministic, flat Terrarium tile keeps this UI test independent of AWS availability.
  await page.route('**/elevation-tiles-prod/terrarium/**', async (route) => {
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 256
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = 'rgb(128, 0, 0)'
      ctx.fillRect(0, 0, 256, 256)
      return canvas.toDataURL().split(',')[1]
    })
    await route.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') })
  })
  await page.goto(route)
  const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'))
  test.skip(!webgl, 'WebGL2 unavailable in this browser')
  const toggle = page.getByRole('button', { name: '3D view', exact: true })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  const view = page.getByTestId('strip-3d')
  await expect(view).toBeVisible()
  const box = await view.boundingBox()
  expect(box!.width).toBeGreaterThan(page.viewportSize()!.width * 0.4)
  expect(box!.height).toBeGreaterThan(page.viewportSize()!.height * 0.35)
  await expect.poll(() => page.evaluate(() => window.__rambleroo3d?.car())).toBe(true)
  const center = await page.evaluate(() => window.__rambleroo3d!.center())
  await page.evaluate(() => window.scrollBy(0, 1500))
  await expect.poll(() => page.evaluate(() => window.__rambleroo3d!.center())).not.toEqual(center)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reducedStart = await page.evaluate(() => window.__rambleroo3d!.center())
  await page.evaluate(() => window.scrollBy(0, 500))
  await expect.poll(() => page.evaluate(() => window.__rambleroo3d!.center())).not.toEqual(reducedStart)
  const stopped = await page.evaluate(() => window.__rambleroo3d!.center())
  await page.waitForTimeout(250)
  expect(await page.evaluate(() => window.__rambleroo3d!.center())).toEqual(stopped)
  await page.reload()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(view).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__rambleroo3d?.car())).toBe(true)
  await toggle.click()
  await expect(page.getByTestId('strip-inset')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__rambleroo3d?.car())).toBe(false)
  await page.reload()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
})

test('terrain failure restores the flat strip map with a message', async ({ page }) => {
  // Test browsers render WebGL in software (SwiftShader), so 3D pages are slow under parallel load.
  test.slow()
  await page.route('**/elevation-tiles-prod/terrarium/**', (route) => route.abort())
  await page.goto(route)
  const toggle = page.getByRole('button', { name: '3D view', exact: true })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('strip-inset')).toBeVisible()
  await expect(page.getByText("3D terrain isn't available right now; showing the flat road map")).toBeVisible()
})

for (const relief of [false, true]) {
  test(`${relief ? '3D' : 'flat'} map preserves user camera offsets while driving`, async ({ page }) => {
    // Test browsers render WebGL in software (SwiftShader), so 3D pages are slow under parallel load.
    test.slow()
    await page.route('**/elevation-tiles-prod/terrarium/**', async (request) => {
      const png = await page.evaluate(() => {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 256
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = 'rgb(128, 0, 0)'
        ctx.fillRect(0, 0, 256, 256)
        return canvas.toDataURL().split(',')[1]
      })
      await request.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') })
    })
    await page.goto(route)
    test.skip(!(await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'))), 'WebGL2 unavailable')
    await expect.poll(() => page.evaluate(() => !!window.__rambleroo3d)).toBe(true)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    if (relief) await page.getByRole('button', { name: '3D view', exact: true }).click()
    await page.evaluate(() => window.scrollBy(0, 1400))
    const map = page.getByTestId(relief ? 'strip-3d' : 'strip-inset')
    await expect(map).toBeVisible()
    const zoom = await page.evaluate(() => window.__rambleroo3d!.zoom())
    const y = await page.evaluate(() => window.scrollY)
    const box = (await map.boundingBox())!
    // Ctrl + wheel is a desktop gesture (and mobile WebKit can't emulate a wheel); phones use pinch, covered by unit tests.
    test.skip(!!test.info().project.use.isMobile, 'Ctrl + wheel is desktop-only')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -120)
    await page.keyboard.up('Control')
    await expect.poll(() => page.evaluate(() => window.__rambleroo3d!.zoom())).toBeGreaterThan(zoom)
    expect(await page.evaluate(() => window.scrollY)).toBe(y)
    await page.mouse.wheel(0, 400)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y)
    const bearing = await page.evaluate(() => window.__rambleroo3d!.bearing())
    await map.getByRole('button', { name: 'Rotate right', exact: true }).click()
    expect(await page.evaluate(() => window.__rambleroo3d!.bearing())).not.toBe(bearing)
    const offset = await page.evaluate(() => window.__rambleroo3d!.offsets())
    await page.evaluate(() => window.scrollBy(0, 500))
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y + 500)
    expect(await page.evaluate(() => window.__rambleroo3d!.offsets())).toEqual(offset)
    await map.getByRole('button', { name: 'Reset view', exact: true }).click()
    expect(await page.evaluate(() => window.__rambleroo3d!.offsets())).toEqual({ zoom: 0, bearing: 0, pitch: 0 })
    await expect.poll(() => page.evaluate(() => window.__rambleroo3d!.zoom())).toBeCloseTo(zoom, 4)
    await expect(map.getByRole('button', { name: 'Reset view', exact: true })).toHaveCount(0)
    await map.focus()
    await page.keyboard.press('+')
    await page.keyboard.press(']')
    expect(await page.evaluate(() => window.__rambleroo3d!.offsets())).toEqual({ zoom: 0.5, bearing: 15, pitch: 0 })
  })
}

test('3D photo pins open the landmark postcard', async ({ page }) => {
  // Test browsers render WebGL in software (SwiftShader), so 3D pages are slow under parallel load.
  test.slow()
  await page.route('**/elevation-tiles-prod/terrarium/**', async (request) => {
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 256
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = 'rgb(128, 0, 0)'
      ctx.fillRect(0, 0, 256, 256)
      return canvas.toDataURL().split(',')[1]
    })
    await request.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') })
  })
  await page.goto(route)
  test.skip(!(await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'))), 'WebGL2 unavailable')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: '3D view', exact: true }).click()
  const map = page.getByTestId('strip-3d')
  await expect.poll(() => page.evaluate(() => window.__rambleroo3d?.car())).toBe(true)
  for (const name of ['Cave Point County Park', 'Cana Island Lighthouse']) {
    await expect(map.locator(`[data-photo-pin="${name}"] img`)).toBeAttached()
  }
  await page.getByRole('navigation', { name: 'Choose a stretch' }).getByRole('button', { name: 'The Lake Michigan side' }).click()
  await page.getByRole('button', { name: 'Close stretch', exact: true }).click()
  // The landmarks are several miles off the road, so widen the view to include the shore.
  for (let i = 0; i < 7; i++) await map.getByRole('button', { name: 'Zoom out', exact: true }).click()
  for (const name of ['Cave Point County Park', 'Cana Island Lighthouse']) {
    // Keyboard activation: pins near the panel edge can sit under the sticky mile bar on small phones, and keyboard is the accessible path anyway.
    const pin = map.getByRole('button', { name: `Map pin: postcard from ${name}`, exact: true })
    await pin.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: `Postcard from ${name}`, exact: true })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
  }
})

test('multi-part roads switch between sections and start each one fresh', async ({ page }) => {
  await page.goto('/byway/historic-route-66-2489/strip')
  const parts = page.getByRole('navigation', { name: 'Parts of this road' })
  await expect(parts.getByRole('link')).toHaveCount(4)
  await expect(parts.getByRole('link', { name: /Illinois/ })).toHaveAttribute('aria-current', 'page')
  await parts.getByRole('link', { name: /Oklahoma/ }).click()
  await expect(page).toHaveURL(/part=ok/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Historic Route 66 · Oklahoma')
  await expect(page.getByTestId('mile-counter')).toContainText('Mile 0.0 of 392.8')
  await parts.getByRole('link', { name: /New Mexico/ }).click()
  await expect(page.getByRole('button', { name: /East to Santa Rosa and Tucumcari/ })).toBeVisible()
})
