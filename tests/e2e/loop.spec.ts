// The blueprint's hero loop: find a byway, select it, open its story, save it, record a visit, see the stamp in the passport.
import { expect, test } from '@playwright/test'

test('explore → postcard → story → save → visit → passport stamp', async ({ page }) => {
  await page.goto('/')
  await page
    .getByRole('searchbox')
    .or(page.getByPlaceholder(/byway, state/i))
    .first()
    .fill('door county')
  await page
    .getByRole('button', { name: /Door County Coastal Byway/ })
    .first()
    .click()
  await expect(page).toHaveURL(/byway=door-county-coastal-byway-81450/)

  const postcard = page.getByRole('dialog', { name: /Door County Coastal Byway/ })
  await expect(postcard).toBeVisible()
  await postcard.getByRole('link', { name: /View story/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Door County Coastal Byway' })).toBeVisible()
  await expect(page.getByText(/Draft story/).first()).toBeVisible()

  await page
    .getByRole('button', { name: /^Save$/ })
    .first()
    .click()
  await page
    .getByRole('button', { name: /Record a visit/ })
    .first()
    .click()
  const editor = page.getByRole('dialog', { name: /Record a visit/ })
  await editor.getByLabel(/Note/).fill('Cherries and a windy lighthouse.')
  await editor.getByRole('button', { name: 'Save visit' }).click()
  await page.getByRole('link', { name: 'View passport' }).click()

  await expect(page).toHaveURL(/\/passport/)
  await expect(page.getByRole('heading', { name: /1 byway/ }).first()).toBeVisible()
  await expect(page.getByText('Cherries and a windy lighthouse.')).toBeVisible()

  // Back navigation restores the explorer selection from the URL.
  await page.goto('/?byway=door-county-coastal-byway-81450')
  await expect(page.getByRole('dialog', { name: /Door County Coastal Byway/ })).toBeVisible()
})

test('list view works without the map', async ({ page }) => {
  await page.goto('/?view=list&themes=desert')
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('row').nth(1)).toBeVisible()
})

// Regression: on mid-size windows the panel used to hide when a road was selected, taking the view switcher with it.
test('map / gallery / list switcher stays usable with a road selected at 1024px', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/?byway=great-river-road-2279')
  await page.getByRole('button', { name: 'gallery', exact: true }).click()
  await expect(page).toHaveURL(/view=gallery/)
  await page.getByRole('button', { name: 'map', exact: true }).click()
  await expect(page).toHaveURL(/view=map/)
  await page.getByRole('button', { name: 'list', exact: true }).click()
  await expect(page).toHaveURL(/view=list/)
})
