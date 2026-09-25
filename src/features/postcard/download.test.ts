import { afterEach, expect, it, vi } from 'vitest'
import { renderPostcard } from './download'
import type { Photo } from '../../lib/types'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('renders a selected photo and its attribution into a shareable PNG', async () => {
  const sources: string[] = []
  vi.stubGlobal(
    'Image',
    class {
      width = 1200
      height = 800
      set src(value: string) {
        sources.push(value)
      }
      decode() {
        return Promise.resolve()
      }
    },
  )
  Object.defineProperty(document, 'fonts', { value: { ready: Promise.resolve() }, configurable: true })
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL() {
        return 'blob:stamp'
      }
      static revokeObjectURL() {}
    },
  )
  const text: string[] = []
  const context = {
    font: '',
    fillStyle: '',
    strokeStyle: '',
    fillRect() {},
    strokeRect() {},
    drawImage: vi.fn(),
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    arc() {},
    measureText: (value: string) => ({ width: value.length * 6 }),
    fillText: (value: string) => text.push(value),
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['png'], { type: 'image/png' })))
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 400 240')
  const photo: Photo = {
    bywayId: 'river',
    file: 'river.jpg',
    width: 1200,
    height: 800,
    title: 'River',
    alt: 'River',
    author: 'Alex Photographer',
    license: 'CC BY 4.0',
    licenseUrl: 'https://example.com/license',
    sourceUrl: 'https://commons.wikimedia.org/river',
  }
  const file = await renderPostcard({
    scene: svg,
    stamp: svg,
    id: 'river',
    name: 'River Road',
    message: 'By the water',
    note: 'See you there',
    postmark: 'WI',
    caption: 'Illustration',
    photo,
  })
  expect(file.type).toBe('image/png')
  expect(file.name).toBe('rambleroo-river.png')
  expect(sources).toContain('/photos/river/river.jpg')
  const printed = text.join(' ')
  expect(printed).toContain('Photo: Alex Photographer')
  expect(printed).toContain('CC BY 4.0')
  expect(printed).toContain(photo.licenseUrl)
  expect(printed).toContain(photo.sourceUrl)
  expect(printed).toContain('See you there')
})
