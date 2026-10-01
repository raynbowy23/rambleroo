import { expect, test, type Page } from './fixtures'

const routes = [
  '/',
  '/?view=gallery',
  '/?view=list',
  '/?byway=great-river-road-2279',
  '/byway/great-river-road-2279',
  '/state/WI',
  '/collections',
  '/collections/follow-the-water',
  '/passport',
  '/about',
]

test.beforeEach(async ({}, testInfo) => {
  test.skip(!['mobile', 'iphone'].includes(testInfo.project.name), 'Touch device projects only')
})

async function audit(page: Page) {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      if (element.closest('svg, [inert], [aria-hidden="true"], .visually-hidden')) return false
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      if (style.visibility === 'hidden' || style.display === 'none' || rect.width === 0 || rect.height === 0) return false
      if (rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) return false
      // Overflow-clipped results/chips and offscreen skip links are not visible controls.
      const x = Math.max(0, Math.min(innerWidth - 1, rect.left + rect.width / 2))
      const y = Math.max(0, Math.min(innerHeight - 1, rect.top + rect.height / 2))
      const hit = document.elementFromPoint(x, y)
      return !!hit && (element.contains(hit) || hit.contains(element))
    }
    const targets = [...document.querySelectorAll('a,button,input,select,[role="button"]')].filter(visible).flatMap((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width < 40 || rect.height < 40
        ? [
            `${element.tagName} ${element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 70)}: ${rect.width}×${rect.height}`,
          ]
        : []
    })
    const text: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      const parent = node.parentElement!
      if (!node.textContent?.trim() || parent.closest('script,style,option') || !visible(parent)) continue
      const size = parseFloat(getComputedStyle(parent).fontSize)
      if (size < 12) text.push(`${node.textContent.trim().slice(0, 70)}: ${size}px`)
    }
    return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, targets, text }
  })
}

for (const width of [360, 390, 430, 768]) {
  for (const route of routes) {
    test(`${route} fits and remains usable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      await page.goto(route)
      await expect(page.locator('main')).toBeVisible()
      await expect(page.getByText('Opening the map…')).toHaveCount(0)
      await page.evaluate(() => document.fonts.ready)
      // Audit each screenful, including controls below the initial viewport.
      const height = await page.evaluate(() => document.documentElement.scrollHeight)
      for (let y = 0; y < height; y += 600) {
        await page.evaluate((y) => window.scrollTo(0, y), y)
        const result = await audit(page)
        expect(result.overflow, 'horizontal page overflow').toBeLessThanOrEqual(0)
        expect(result.targets, 'small visible touch targets').toEqual([])
        expect(result.text, 'small visible text').toEqual([])
      }
      // Lazy photos and maps grow the page after the first scroll, so keep scrolling to the bottom until the height settles.
      await page.evaluate(async () => {
        let last = -1
        for (let i = 0; i < 20 && document.documentElement.scrollHeight !== last; i++) {
          last = document.documentElement.scrollHeight
          window.scrollTo(0, last)
          document.querySelectorAll<HTMLElement>('main, main section').forEach((element) => {
            if (getComputedStyle(element).overflowY === 'auto') element.scrollTop = element.scrollHeight
          })
          // Offscreen lazy images never fire load, so each wait is capped.
          await Promise.all(
            [...document.images]
              .filter((img) => !img.complete)
              .map((img) =>
                Promise.race([
                  new Promise((r) => img.addEventListener('load', r, { once: true })),
                  new Promise((r) => setTimeout(r, 1200)),
                ]),
              ),
          )
          await new Promise((r) => setTimeout(r, 150))
        }
      })
      const tab = page.getByRole('navigation', { name: 'Mobile navigation' })
      if (await tab.isVisible()) {
        const bottom = await page.locator('main').evaluate((main) => {
          const children = [...main.children].filter((element) => {
            const style = getComputedStyle(element)
            return element.getBoundingClientRect().height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
          })
          return children.at(-1)?.getBoundingClientRect().bottom ?? main.getBoundingClientRect().bottom
        })
        expect(bottom).toBeLessThanOrEqual((await tab.boundingBox())!.y + 1)
      }
    })
  }
}

test('peek leaves room for the map and supports dragging and tapping', async ({ page }) => {
  await page.goto('/')
  const sheet = page.locator('[data-map-panel="search"]')
  await expect(sheet).toHaveAttribute('data-snap', '0')
  const box = (await sheet.boundingBox())!
  expect(box.height).toBeLessThanOrEqual(160)
  const main = (await page.locator('main').boundingBox())!
  expect(main.height - box.height).toBeGreaterThanOrEqual(page.viewportSize()!.height * 0.55)
  const handle = page.getByRole('button', { name: 'Change results sheet height' })
  const bounds = (await handle.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 22)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y - 220, { steps: 16 })
  await page.mouse.up()
  await expect(sheet).not.toHaveAttribute('data-snap', '0')
  const snap = await sheet.getAttribute('data-snap')
  await handle.tap()
  await expect(sheet).not.toHaveAttribute('data-snap', snap!)
})

test('browse filters are a dismissible sheet; selected postcard swipes closed', async ({ page }) => {
  await page.goto('/?view=gallery')
  await page.getByRole('button', { name: 'Filters', exact: true }).tap()
  const dialog = page.getByRole('dialog', { name: 'Filter byways' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'water', exact: true }).tap()
  await dialog.getByRole('button', { name: 'Show results' }).tap()
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/themes=water/)
  await page.goto('/?byway=great-river-road-2279')
  const postcard = page.locator('[data-map-panel="postcard"]')
  await expect(postcard).toBeVisible()
  expect((await postcard.boundingBox())!.height).toBeLessThanOrEqual((await page.locator('main').boundingBox())!.height * 0.75 + 1)
  const handle = (await page.getByRole('button', { name: 'Swipe down to close postcard' }).boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 22)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 150, { steps: 12 })
  await page.mouse.up()
  await expect(postcard).toBeHidden()
})

// Regression: Safari flattens 3D under the card's clip-path and used to show the mirrored back instead of the front.
test('postcard shows the front first and the back only after turning over', async ({ page }) => {
  await page.goto('/?byway=door-county-coastal-byway-81450')
  const postcard = page.getByRole('dialog', { name: /Door County Coastal Byway/ })
  await expect(postcard.getByText('Your note')).toBeHidden()
  await postcard.getByRole('button', { name: /Turn over/ }).click()
  await expect(postcard.getByText('Your note')).toBeVisible()
  await postcard.getByRole('button', { name: /Show front/ }).click()
  await expect(postcard.getByText('Your note')).toBeHidden()
})
