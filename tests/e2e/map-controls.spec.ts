import { expect, test } from '@playwright/test'

test('miniature town names can be turned off and on', async ({ page }) => {
  await page.goto('/byway/big-bend-scenic-byway-2599')
  const miniature = page.locator('.rr-mini-view')
  // The miniature mounts only when it comes near the screen, so scroll down the page the way a reader would until it appears.
  await expect
    .poll(async () => {
      await page.evaluate(() => window.scrollBy(0, 600))
      return miniature.count()
    })
    .toBeGreaterThan(0)
  await miniature.scrollIntoViewIfNeeded()
  const town = miniature.locator('.rr-mini-town').first()
  await expect(town).toBeAttached({ timeout: 20000 })
  const toggle = miniature.getByRole('button', { name: 'Town names' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(miniature.locator('.rr-mini-town:visible')).toHaveCount(0)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(miniature.locator('.rr-mini-town:visible').first()).toBeVisible()
})

test('the road-name popup on the map has a close button', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => {
    const map = (window as unknown as { __rambleMap?: { loaded(): boolean; queryRenderedFeatures(o: object): unknown[] } }).__rambleMap
    return !!map && map.loaded() && map.queryRenderedFeatures({ layers: ['byway-hit'] }).length > 0
  })
  // Hover the middle of a road that is drawn on screen, found through the map itself.
  const point = await page.evaluate(() => {
    type Feature = { geometry: { type: string; coordinates: number[][] | number[][][] } }
    const map = (
      window as unknown as {
        __rambleMap: {
          queryRenderedFeatures(o: object): Feature[]
          project(c: number[]): { x: number; y: number }
          getCanvas(): HTMLCanvasElement
        }
      }
    ).__rambleMap
    const box = map.getCanvas().getBoundingClientRect()
    for (const feature of map.queryRenderedFeatures({ layers: ['byway-hit'] })) {
      const lines = (feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates) as number[][][]
      for (const line of lines) {
        const p = map.project(line[Math.floor(line.length / 2)])
        if (p.x > box.width * 0.35 && p.x < box.width * 0.7 && p.y > box.height * 0.3 && p.y < box.height * 0.7)
          return { x: box.left + p.x, y: box.top + p.y }
      }
    }
    return null
  })
  expect(point).not.toBeNull()
  await page.mouse.move(point!.x, point!.y)
  const popup = page.locator('.maplibregl-popup')
  await expect(popup).toBeVisible()
  await popup.getByRole('button', { name: /close/i }).click()
  await expect(popup).toBeHidden()
})

test('the compass rose turns with the map', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => (window as unknown as { __rambleMap?: { loaded(): boolean } }).__rambleMap?.loaded())
  const rose = page.locator('svg.rr-compass')
  const angle = () =>
    rose.evaluate((svg) => {
      const m = new DOMMatrix(getComputedStyle(svg).transform)
      return Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI)
    })
  expect(await angle()).toBe(0)
  await page.evaluate(() => (window as unknown as { __rambleMap: { setBearing(b: number): void } }).__rambleMap.setBearing(90))
  await expect.poll(angle).toBe(-90)
  await page.evaluate(() => (window as unknown as { __rambleMap: { setBearing(b: number): void } }).__rambleMap.setBearing(0))
  await expect.poll(angle).toBe(0)
})

test('a click just beside the selected road keeps it; a click on open map resets', async ({ page }) => {
  const id = 'kancamagus-scenic-byway-2458'
  await page.goto(`/?byway=${id}`)
  type TestMap = {
    loaded(): boolean
    isMoving(): boolean
    queryRenderedFeatures(o: object): { properties: { id: string }; geometry: { type: string; coordinates: number[][] | number[][][] } }[]
    project(c: number[]): { x: number; y: number }
    getCanvas(): HTMLCanvasElement
  }
  await page.waitForFunction(() => {
    const map = (window as unknown as { __rambleMap?: TestMap }).__rambleMap
    return !!map && map.loaded() && !map.isMoving()
  })
  await page.waitForTimeout(1500)
  const spot = await page.evaluate((road) => {
    const map = (window as unknown as { __rambleMap: TestMap }).__rambleMap
    const box = map.getCanvas().getBoundingClientRect()
    const feature = map.queryRenderedFeatures({ layers: ['byway-hit'] }).find((f) => f.properties.id === road)!
    const lines = (feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates) as number[][][]
    const line = lines.sort((a, b) => b.length - a.length)[0]
    const p = map.project(line[Math.floor(line.length / 2)])
    return { x: box.left + p.x, y: box.top + p.y, width: box.width, height: box.height, left: box.left, top: box.top }
  }, id)
  // 14 px off the line: outside the drawn hit area, inside the click margin.
  await page.mouse.click(spot.x, spot.y + 14)
  await page.waitForTimeout(500)
  await expect(page).toHaveURL(new RegExp(`byway=${id}`))
  // Far out in the Atlantic, nowhere near a road.
  await page.evaluate(() =>
    (window as unknown as { __rambleMap: { jumpTo(o: object): void } }).__rambleMap.jumpTo({ center: [-60, 38], zoom: 6 }),
  )
  await page.waitForTimeout(800)
  // The upper part of the map: on a phone the road card covers the lower part.
  await page.mouse.click(spot.left + spot.width * 0.5, spot.top + spot.height * 0.15)
  await expect(page).not.toHaveURL(/byway=/)
})
