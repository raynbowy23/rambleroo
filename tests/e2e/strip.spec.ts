import { expect, test } from '@playwright/test'

const id = 'door-county-coastal-byway-81450'
const route = `/byway/${id}/strip`

test('unrolls from the byway page and drives as the page scrolls', async ({ page }) => {
  await page.goto(`/byway/${id}`)
  await page.getByRole('link', { name: 'Unroll the road' }).first().click()
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
  await page.goto(route)
  await page.getByRole('navigation', { name: 'Choose a stretch' }).getByRole('button', { name: 'Bay villages' }).click()
  const card = page.getByRole('region', { name: 'Bay villages stretch' })
  await expect(card).toBeVisible()
  await expect(card.getByText('≈ 15.8 mi · about 31 min driving')).toBeVisible()
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
  const toggle = page.getByRole('button', { name: /Out to the tip · \+13.3 mi/ })
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
