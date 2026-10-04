import { expect, test } from '@playwright/test'

test('sign-in is visible and signed-out trips stay in this browser', async ({ page, isMobile }) => {
  await page.route('**/api/auth/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }))
  let writes = 0
  await page.route('**/api/data**', (route) => {
    writes++
    return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Sign in required"}' })
  })
  await page.addInitScript(() => {
    if (!localStorage.getItem('rambleroo.trip.v1'))
      localStorage.setItem(
        'rambleroo.trip.v1',
        JSON.stringify({ version: 1, state: { roads: [{ bywayId: 'local-road', addedAt: '2026-10-04T00:00:00.000Z' }] } }),
      )
  })
  await page.goto('/passport')
  const area = isMobile ? page.locator('main') : page.locator('header').first()
  await expect(area.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page.getByText('Saved in this browser', { exact: true })).toBeVisible()
  await page.reload()
  await expect(area.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  const trip = await page.evaluate(() => JSON.parse(localStorage.getItem('rambleroo.trip.v1')!).state.roads)
  expect(trip).toHaveLength(1)
  expect(trip[0].bywayId).toBe('local-road')
  expect(writes).toBe(0)
})
