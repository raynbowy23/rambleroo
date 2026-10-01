import { expect, test } from './fixtures'

const id = 'door-county-coastal-byway-81450'

test('road puts facts and Drive it before the story and keeps listing details collapsed', async ({ page }) => {
  await page.goto(`/byway/${id}`)
  const hero = page.locator('main > header')
  await expect(hero.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(hero.getByText(/Photo:|Illustration · no photo yet/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Drive it' }).first()).toHaveAttribute('href', `/byway/${id}/strip`)
  await expect(page.locator('[aria-label="Road facts"]')).toContainText('Mapped distance')
  const details = page.locator('details').filter({ hasText: 'About this listing' })
  await expect(details).not.toHaveAttribute('open')
  await details.locator('summary').click()
  await expect(details).toHaveAttribute('open', '')
  await expect(details.getByText('Data source', { exact: true })).toBeVisible()
})

test('strip stays within the viewport and town ticks drive to their actual miles', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'desktop') await page.setViewportSize({ width: 1512, height: 805 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`/byway/${id}/strip`)
  const ticks = page.getByRole('navigation', { name: 'Jump to a town' }).getByRole('button')
  await expect(ticks.first()).toBeVisible()
  const tick = ticks.nth(2)
  const mile = Number((await tick.getAttribute('aria-label'))!.match(/mile ([\d.]+)/)![1])
  await tick.click()
  await expect
    .poll(async () => Math.abs(Number(await page.getByRole('progressbar').getAttribute('aria-valuenow')) - mile))
    .toBeLessThan(0.2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0)
  const counter = page.getByTestId('mile-counter')
  await expect(counter).toContainText(`Mile ${mile.toFixed(1)}`)
})

test('missing routes and road IDs offer working recovery links', async ({ page }) => {
  for (const route of ['/no-such-page', '/byway/no-such-road', '/byway/no-such-road/strip']) {
    await page.goto(route)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/off the beaten path|Road not found/)
    await expect(page.getByRole('link', { name: 'Return to the map' })).toHaveAttribute('href', '/')
  }
})

test('road and strip show a skeleton while catalog data is pending', async ({ page }) => {
  for (const route of [`/byway/${id}`, `/byway/${id}/strip`]) {
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/data/catalog.json', async (request) => {
      await pending
      await request.continue()
    })
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main[aria-busy="true"]')).toBeVisible()
    release()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.unroute('**/data/catalog.json')
  }
})
