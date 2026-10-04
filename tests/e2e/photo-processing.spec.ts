import { test, expect } from '@playwright/test'
test('photo upload re-encoding removes an APP1 Exif segment and resizes', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    // Use the production processor and the browser's real JPEG encoder/decoder.
    const { processPhoto } = await import('/src/lib/photo-process.ts')
    const canvas = document.createElement('canvas')
    canvas.width = 2000
    canvas.height = 1000
    canvas.getContext('2d')!.fillRect(0, 0, 2000, 1000)
    const jpeg = await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), 'image/jpeg'))
    const original = new Uint8Array(await jpeg.arrayBuffer())
    const exif = new Uint8Array([0xff, 0xe1, 0, 22, 69, 120, 105, 102, 0, 0, 73, 73, 42, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    const input = new Blob([original.slice(0, 2), exif, original.slice(2)], { type: 'image/jpeg' })
    const output = await processPhoto(input)
    const bytes = new Uint8Array(await output.arrayBuffer())
    let hasExif = false
    for (let i = 0; i < bytes.length - 7; i++)
      if (bytes[i] === 0xff && bytes[i + 1] === 0xe1 && String.fromCharCode(...bytes.slice(i + 4, i + 8)) === 'Exif') hasExif = true
    const image = await createImageBitmap(output)
    return {
      inputHasExif: new TextDecoder().decode(await input.arrayBuffer()).includes('Exif'),
      hasExif,
      type: output.type,
      width: image.width,
      height: image.height,
      size: output.size,
    }
  })
  expect(result).toMatchObject({ inputHasExif: true, hasExif: false, type: 'image/jpeg', width: 1600, height: 800 })
  expect(result.size).toBeLessThanOrEqual(1_500_000)
})
