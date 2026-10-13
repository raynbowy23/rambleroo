import { expect, it } from 'vitest'
import { photoSources } from './photoSources'
import type { Photo } from './types'

const photo = { bywayId: 'a', file: '/photos/a/x.jpg', thumb: '/photos/a/x-480.jpg', medium: '/photos/a/x-960.webp', width: 1600 } as Photo

it('offers every size it has and starts heroes from the middle size and cards from the thumbnail', () => {
  const srcSet = 'https://p.example/a/x-480.jpg 480w, https://p.example/a/x-960.webp 960w, https://p.example/a/x.jpg 1600w'
  expect(photoSources(photo, 'https://p.example', 'hero')).toEqual({ src: 'https://p.example/a/x-960.webp', srcSet, sizes: '100vw' })
  expect(photoSources(photo, 'https://p.example', 'card')).toMatchObject({ src: 'https://p.example/a/x-480.jpg', srcSet })
  expect(photoSources(photo, '', 'full')).toEqual({ src: '/photos/a/x.jpg' })
  expect(photoSources({ ...photo, thumb: undefined, medium: undefined }, '', 'hero')).toEqual({
    src: '/photos/a/x.jpg',
    srcSet: undefined,
    sizes: undefined,
  })
})
