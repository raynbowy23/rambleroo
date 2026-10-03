import { expect, test, flatTerrainTile } from './fixtures'

for (const road of [
  { id: 'door-county-coastal-byway-81450', region: 'upper-midwest', center: [-87.2, 45], climate: 'snowy', label: 'Winter · snowy' },
  {
    id: 'a1a-scenic-and-historic-coastal-byway-2477',
    region: 'florida',
    center: [-81.2, 29.5],
    climate: 'tropical',
    label: 'Winter · Florida stays warm',
  },
] as const) {
  test(`${road.id}: winter restyles the existing 3D map`, async ({ page }) => {
    test.slow()
    await page.route('**/elevation-tiles-prod/terrarium/**', async (request) => {
      await request.fulfill({ contentType: 'image/png', body: flatTerrainTile })
    })
    await page.goto(`/byway/${road.id}/strip`)
    test.skip(!(await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'))), 'WebGL2 unavailable')
    await page.getByRole('button', { name: '3D view', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.__rambleroo3d?.car())).toBe(true)
    const canvas = await page.getByTestId('strip-3d').locator('canvas').elementHandle()
    await page.getByRole('button', { name: 'Show summer along the road' }).click()
    await expect.poll(() => page.evaluate(() => window.__rambleroo3d!.season())).toBe('summer')
    const summer = await page.evaluate(() => window.__rambleroo3d!.landColor())
    await page.getByRole('button', { name: 'Show winter along the road' }).click()
    // Assert what the owner asked for rather than an exact hex (the app refines colours with real terrain height):
    // northern winter land is near-white snow; Florida's winter land stays green.
    await expect.poll(() => page.evaluate(() => window.__rambleroo3d!.season())).toBe('winter')
    const winterLand = await page.evaluate(() => window.__rambleroo3d!.landColor())
    expect(winterLand).not.toBe(summer)
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(winterLand.slice(i, i + 2), 16))
    if (road.climate === 'snowy') expect(Math.min(r, g, b)).toBeGreaterThan(205)
    else expect(g).toBeGreaterThan(Math.max(r, b))
    expect(await page.evaluate(() => window.__rambleroo3d!.climate())).toBe(road.climate)
    expect(await canvas!.evaluate((node) => node === document.querySelector('[data-testid="strip-3d"] canvas'))).toBe(true)
    const chip = page.getByRole('button', { name: `Change map season: ${road.label}`, exact: true })
    await expect(chip).toBeAttached()
    expect(await chip.evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
    if (road.climate === 'snowy') {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await expect(page.getByTestId('season-weather')).toHaveAttribute('data-weather', 'snow')
    } else await expect(page.getByTestId('season-weather')).toHaveCount(0)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(page.getByTestId('season-weather')).toHaveCount(0)
    await chip.click()
    await expect.poll(() => page.evaluate(() => window.__rambleroo3d!.season())).toBe('spring')
    await expect(page.getByRole('button', { name: 'Show spring along the road' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: '3D view', exact: true }).click()
    await expect(page.getByTestId('strip-inset')).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.__rambleroo3d!.car())).toBe(false)
  })
}
