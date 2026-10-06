import { test as base, expect } from '@playwright/test'
import { deflateSync } from 'node:zlib'

/** A flat 256 px Terrarium tile (rgb 128,0,0 = sea level), built once in Node so route handlers never depend on the page being alive. */
export const flatTerrainTile = (() => {
  const size = 256
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (bytes: Buffer) => {
    let c = 0xffffffff
    for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const out = Buffer.alloc(body.length + 8)
    out.writeUInt32BE(data.length, 0)
    body.copy(out, 4)
    out.writeUInt32BE(crc(body), body.length + 4)
    return out
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 2, 0, 0, 0], 8)
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => [128, 0, 0]).flat())])
  const pixels = Buffer.concat(Array.from({ length: size }, () => row))
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ])
})()

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
      // The painted landscape's elevation tiles come back flat, so tests never wait on the terrain service.
      await page.route('https://s3.amazonaws.com/elevation-tiles-prod/**', (route) =>
        route.fulfill({ contentType: 'image/png', body: flatTerrainTile }),
      )
      await use()
    },
    { auto: true },
  ],
})
export { expect }
export type { Page, Locator } from '@playwright/test'
