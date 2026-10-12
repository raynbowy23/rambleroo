import { expect, test } from '@playwright/test'

test('miniature town names can be turned off and on', async ({ page }) => {
  await page.goto('/byway/big-bend-scenic-byway-2599')
  const miniature = page.locator('.rr-mini-view')
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
