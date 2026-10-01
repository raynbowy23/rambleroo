import { test as base, expect } from '@playwright/test'

// Tests never depend on the live OpenFreeMap service: the TileJSON is stubbed and every tile and glyph comes back empty, so maps render the bundled Natural Earth layers quickly and deterministically.
export const test = base.extend<{ stubBasemap: void }>({
  stubBasemap: [
    async ({ page }, use) => {
      await page.route('https://tiles.openfreemap.org/**', (route) => {
        const url = route.request().url()
        if (url.endsWith('/planet'))
          return route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              tilejson: '3.0.0',
              tiles: ['https://tiles.openfreemap.org/stub/{z}/{x}/{y}.pbf'],
              minzoom: 0,
              maxzoom: 14,
            }),
          })
        return route.fulfill({ status: 200, contentType: 'application/x-protobuf', body: Buffer.alloc(0) })
      })
      await use()
    },
    { auto: true },
  ],
})
export { expect }
export type { Page, Locator } from '@playwright/test'
