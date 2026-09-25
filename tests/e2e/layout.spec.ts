import { expect, test } from '@playwright/test'

for (const width of [1440, 390]) {
  test(`collection covers and hero keep their content at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/collections')
    await expect(page.getByText('A few roads with something in common.')).toBeVisible()
    const covers = page.locator('main a[href^="/collections/"]')
    await expect(covers.first()).toBeVisible()
    for (const cover of await covers.all()) {
      const geometry = await cover.evaluate((element) => {
        const card = element.getBoundingClientRect()
        const art = element.querySelector('svg')!.getBoundingClientRect()
        const footer = element.querySelector('[class*="coverFooter"]')!.getBoundingClientRect()
        const text = element.querySelector('[class*="coverText"]')!
        return {
          portrait: card.height > card.width,
          artTop: Math.abs(art.top - card.top),
          artHeight: Math.abs(art.height - card.height),
          footerInside: footer.bottom <= card.bottom - 24,
          padding: parseFloat(getComputedStyle(text).paddingLeft),
        }
      })
      expect(geometry.portrait).toBe(true)
      expect(geometry.artTop).toBeLessThan(2)
      expect(geometry.artHeight).toBeLessThan(2)
      expect(geometry.footerInside).toBe(true)
      expect(geometry.padding).toBeGreaterThanOrEqual(width === 390 ? 24 : 36)
    }
    await covers.first().click()
    await expect(page.locator('main header h1')).toBeVisible()
    await expect(page.locator('main header').getByText('Illustration', { exact: false })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })

  test(`postcard faces stay 3:2 at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/byway/door-county-coastal-byway-81450')
    const turn = page.getByRole('button', { name: 'Turn over', exact: true }).first()
    await turn.scrollIntoViewIfNeeded()
    const faces = page.locator('[class*="faces"]').first()
    const before = (await faces.boundingBox())!
    expect(before.width).toBeLessThanOrEqual(760)
    expect(before.width / before.height).toBeCloseTo(1.5, 1)
    await turn.click()
    await expect(page.getByRole('button', { name: 'Show front' }).first()).toBeVisible()
    await expect(page.getByPlaceholder('A road to remember…').first()).toBeVisible()
    await expect.poll(async () => (await faces.boundingBox())!.height).toBeCloseTo(before.height, 0)
  })
}

test('explore keeps a compact collection rail and hides the selected cartouche below 1280px', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const rail = page.locator('main [class*="rail"]').first()
  await expect(rail).toBeVisible()
  expect((await rail.boundingBox())!.height).toBeLessThanOrEqual(72)
  const thumbnails = rail.locator('a[href^="/collections/"] > svg')
  expect((await thumbnails.first().boundingBox())!.width).toBe(48)
  await expect(rail.getByText('Editorial', { exact: true })).toHaveCount(0)
  const cartouche = page.locator('[class*="cartouche"]').first()
  await expect(cartouche).toBeVisible()
  expect((await cartouche.boundingBox())!.width).toBeLessThanOrEqual(440)
  await page.setViewportSize({ width: 1200, height: 900 })
  await page.goto('/?byway=door-county-coastal-byway-81450')
  await expect(page.getByRole('dialog', { name: /Door County/ })).toBeVisible()
  await expect(page.locator('[class*="selectedCartouche"]')).toBeHidden()
})

for (const width of [1280, 1440, 1968, 390]) {
  test(`byway hero has readable text and inline facts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    // Resolve the canonical ID from the catalog so this check survives catalog refreshes.
    const road = await page.request
      .get('/data/catalog.json')
      .then((response) => response.json())
      .then((catalog) => catalog.byways.find((road: { name: string }) => road.name === 'Scenic Byway 12'))
    expect(road).toBeTruthy()
    await page.goto(`/byway/${road.id}`)
    const heading = page.getByRole('heading', { level: 1, name: 'Scenic Byway 12' })
    await expect(heading).toBeVisible()
    const geometry = await heading.evaluate((element) => {
      const column = element.parentElement!
      const style = getComputedStyle(element)
      const facts = [...column.querySelectorAll('[class*="facts"] span')].map((fact) => fact.getBoundingClientRect())
      return {
        width: column.getBoundingClientRect().width,
        overflowWrap: style.overflowWrap,
        wordBreak: style.wordBreak,
        hyphens: style.hyphens,
        inlineFacts: facts.length > 1 && facts[0].top === facts[1].top,
        fits: element.scrollWidth <= element.clientWidth,
      }
    })
    expect(geometry.width).toBeCloseTo(width === 390 ? 390 : 640, 0)
    expect(geometry.overflowWrap).toBe('normal')
    expect(geometry.wordBreak).toBe('normal')
    expect(geometry.hyphens).toBe('manual')
    expect(geometry.inlineFacts).toBe(true)
    expect(geometry.fits).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('share fallback includes a typed note and closes with Escape', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'canShare', { value: () => false }))
  await page.goto('/byway/door-county-coastal-byway-81450')
  await page.getByRole('button', { name: 'Turn over', exact: true }).first().click()
  await page.getByPlaceholder('A road to remember…').first().fill('Meet at the lake & bring tea!')
  const share = page.locator('main header').getByRole('button', { name: 'Share', exact: true })
  await share.click()
  const email = page.getByRole('link', { name: 'Email', exact: true })
  await expect(email).toBeVisible()
  const body = new URL((await email.getAttribute('href'))!).searchParams.get('body')!
  expect(body).toContain('Meet at the lake & bring tea!')
  expect(body).toContain('/byway/door-county-coastal-byway-81450')
  await page.keyboard.press('Escape')
  await expect(email).toBeHidden()
  await expect(share).toBeFocused()
})
