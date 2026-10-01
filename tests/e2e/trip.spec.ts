import { expect, test } from './fixtures'
const first = 'door-county-coastal-byway-81450'
const second = 'great-river-road-2279'
test('collects two roads, shows honest totals, reorders and persists', async ({ page }) => {
  const catalog = await (await page.request.get('/data/catalog.json')).json()
  const miles = catalog.byways
    .filter((b: { id: string }) => [first, second].includes(b.id))
    .reduce((sum: number, b: { mappedMiles: number }) => sum + b.mappedMiles, 0)
  await page.route('**/data/strips/index.json', (route) => route.fulfill({ json: [first] }))
  const strip = await (await page.request.get(`/data/strips/${first}.json`)).json()
  const stretches = strip.stretches.filter((s: { on: string }) => s.on === 'main')
  const minutes = stretches.reduce((sum: number, s: { minutes: number | null }) => sum + (s.minutes ?? 0), 0)
  for (const id of [first, second]) {
    await page.goto(`/byway/${id}`)
    await page.getByRole('button', { name: 'Add to trip', exact: true }).first().click()
    await expect(page.getByRole('button', { name: 'In your trip' }).first()).toBeDisabled()
  }
  // Desktop header or the phone tab bar, whichever is showing.
  await page
    .getByRole('navigation', { name: /^(Main|Mobile) navigation$/ })
    .getByRole('link', { name: /Trip/ })
    .filter({ visible: true })
    .click()
  await expect(page.getByRole('status').filter({ hasText: 'mapped miles' })).toContainText(
    `2 roads · ${Math.round(miles).toLocaleString('en-US')} mapped miles`,
  )
  await expect(page.getByText('Loading drive times…')).toHaveCount(0)
  if (stretches.some((s: { minutes: number | null }) => s.minutes !== null))
    await expect(
      page.getByText(
        new RegExp(
          `${Math.floor(Math.round(minutes) / 60) ? `${Math.floor(Math.round(minutes) / 60)} h ` : ''}${Math.round(minutes) % 60} min of known drive time`,
        ),
      ),
    ).toBeVisible()
  await expect(page.getByText(/lacks? complete drive times/)).toContainText(
    stretches.some((s: { minutes: number | null }) => s.minutes === null) ? '2 roads lack' : '1 road lacks',
  )
  const directions = new URL((await page.getByRole('link', { name: 'Open in Google Maps', exact: true }).getAttribute('href'))!)
  expect(directions.searchParams.get('waypoints')?.split('|')).toHaveLength(3)
  await page.getByRole('button', { name: 'Move road 2 up' }).click()
  await page.reload()
  await expect(page.locator('main ol > li').first()).toContainText('Great River Road')
  await page.locator('main ol > li').first().getByRole('button', { name: 'Remove' }).click()
  await expect(page.locator('main ol > li')).toHaveCount(1)
})
test('Near me requests location only on click and keeps it out of storage and URL', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 37.123456, longitude: -84.654321 })
  await page.addInitScript(() => {
    const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation)
    Object.defineProperty(window, 'locationRequests', { value: 0, writable: true })
    navigator.geolocation.getCurrentPosition = (...args) => {
      ;(window as unknown as { locationRequests: number }).locationRequests++
      original(...args)
    }
  })
  await page.goto('/?view=list')
  await expect(page.getByRole('button', { name: 'Near me', exact: true })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { locationRequests: number }).locationRequests)).toBe(0)
  await page.getByRole('button', { name: 'Near me', exact: true }).click()
  await expect(page.getByText(/Your location stays on this device/)).toBeVisible()
  await expect(page.getByText(/mi away, straight line/).filter({ visible: true }).first()).toBeVisible()
  expect(page.url()).not.toContain('37.123456')
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toMatch(/37\.123456|84\.654321/)
})
test('unavailable location leaves the current road order intact', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { value: undefined }))
  await page.goto('/?view=list')
  const rows = page.locator('tbody tr')
  await expect(rows.first()).toBeVisible()
  const before = await rows.allTextContents()
  await page.getByRole('button', { name: 'Near me', exact: true }).click()
  await expect(page.getByText('Location is unavailable. Your sort is unchanged.')).toBeVisible()
  expect(await rows.allTextContents()).toEqual(before)
})
