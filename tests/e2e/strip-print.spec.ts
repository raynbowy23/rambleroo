import { expect, test } from './fixtures'
test('prints page-height panels with places, credits and no map chrome', async ({ page }) => {
  const id = 'door-county-coastal-byway-81450'
  await page.goto(`/byway/${id}/strip`)
  await page.getByRole('link', { name: 'Print this strip' }).click()
  await expect(page).toHaveURL(new RegExp(`/byway/${id}/strip/print`))
  const panels = page.getByTestId('print-panel')
  await expect(panels.first()).toBeVisible()
  expect(await panels.count()).toBeGreaterThan(1)
  await expect(panels.first()).toContainText('Main road · miles 0.0–')
  await expect(page.getByRole('heading', { name: 'Sources & photo credits' })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('button', { name: 'Print this strip' })).toBeHidden()
  await expect(page.getByRole('navigation', { name: 'Main navigation', exact: true })).toBeHidden()
  const sizes = await panels.evaluateAll((nodes) =>
    nodes.map((node) => ({
      height: node.getBoundingClientRect().height,
      overflow: node.scrollHeight - node.clientHeight,
      breakAfter: getComputedStyle(node).breakAfter,
    })),
  )
  for (const size of sizes) {
    expect(size.height).toBeLessThanOrEqual(960)
    expect(size.overflow).toBeLessThanOrEqual(1)
    expect(size.breakAfter).toBe('page')
  }
  // PDF output is a Chromium-only API; WebKit still checks the print layout above.
  if (test.info().project.name !== 'iphone') await page.pdf({ format: 'Letter', preferCSSPageSize: true })
})
