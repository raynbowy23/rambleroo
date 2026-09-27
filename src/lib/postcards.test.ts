import { beforeEach, expect, it } from 'vitest'
import { cardKey, creditedPhoto, postcardDefaults, usePostcards } from './postcards'
import type { Photo } from './types'
const photo = { author: 'Photographer', license: 'CC BY', sourceUrl: 'https://commons.wikimedia.org/example' } as Photo
beforeEach(() => usePostcards.getState().clear())
it('defaults to route and car, with photo only when available', () => {
  expect(postcardDefaults()).toMatchObject({ front: 'illustration', route: true, car: true })
  expect(postcardDefaults(photo, 'script')).toMatchObject({ front: 'photo', lettering: 'script' })
})
it('keeps road and milestone choices separate and survives rehydration', async () => {
  const store = usePostcards.getState()
  store.update(cardKey('door'), { front: 'own', userPhotoId: 'local-id', note: 'At sunset' })
  store.update(cardKey('door', 'ephraim'), { route: false, lettering: 'off', note: 'x'.repeat(700) })
  await usePostcards.persist.rehydrate()
  expect(usePostcards.getState().cards.door).toMatchObject({ front: 'own', userPhotoId: 'local-id', note: 'At sunset' })
  expect(usePostcards.getState().cards['door#ephraim'].note).toHaveLength(500)
  expect(usePostcards.getState().cards['door#ephraim'].route).toBe(false)
})
it('requires the source credit for Commons and excludes it for own photos and illustrations', () => {
  expect(creditedPhoto({ front: 'photo' }, photo)).toBe(photo)
  expect(creditedPhoto({ front: 'own' }, photo)).toBeUndefined()
  expect(creditedPhoto({ front: 'illustration' }, photo)).toBeUndefined()
})
