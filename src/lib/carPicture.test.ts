import { afterEach, expect, it, vi } from 'vitest'
import { prepareCarPicture } from './carPicture'
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('rejects non-images and pictures larger than 8 MB', async () => {
  await expect(prepareCarPicture(new File(['text'], 'car.txt', { type: 'text/plain' }))).rejects.toThrow('image file')
  await expect(prepareCarPicture(new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'car.png', { type: 'image/png' }))).rejects.toThrow('8 MB')
})
it('center-crops to 256 pixels without painting over transparency and revokes its URL', async () => {
  const drawImage = vi.fn(),
    fillRect = vi.fn(),
    revokeObjectURL = vi.fn()
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 800
      naturalHeight = 400
      decode = async () => {}
    },
  )
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:car', revokeObjectURL })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage, fillRect } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback, type) {
    expect([this.width, this.height]).toEqual([256, 256])
    expect(type).toBe('image/png')
    callback(new Blob(['png'], { type }))
  })
  expect((await prepareCarPicture(new File(['png'], 'car.png', { type: 'image/png' }))).type).toBe('image/png')
  expect(drawImage).toHaveBeenCalledWith(expect.anything(), 200, 0, 400, 400, 0, 0, 256, 256)
  expect(fillRect).not.toHaveBeenCalled()
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:car')
})
