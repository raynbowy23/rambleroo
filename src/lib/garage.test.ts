import { beforeEach, expect, it } from 'vitest'
import { defaultGarage, models, useGarage, validateGarage } from './garage'
beforeEach(() => useGarage.setState(defaultGarage))
it('starts with the rounded orange coupe and RAMBLE plate', () => {
  expect(validateGarage({})).toEqual(defaultGarage)
  expect(useGarage.getState().model).toBe('coupe')
})
it('normalizes plates and rejects invalid colours and model values', () => {
  useGarage.getState().update({ plate: 'ab-12💛xyz890', body: 'url(evil)', model: 'invalid' as 'coupe' })
  expect(useGarage.getState().plate).toBe('AB12XYZ')
  expect(useGarage.getState().body).toBe(defaultGarage.body)
  expect(useGarage.getState().model).toBe('coupe')
  expect(validateGarage({ plate: 'a b 1234' }).plate).toBe('A B 123')
})
it('persists every model with a custom body and curated second ink', async () => {
  for (const model of models) {
    useGarage.getState().update({ model, body: '#123456', accent: 'two-tone', accentColor: '#af96ca' })
    await useGarage.persist.rehydrate()
    expect(useGarage.getState()).toMatchObject({ model, body: '#123456', accent: 'two-tone', accentColor: '#af96ca' })
  }
})

it('keeps drawn choices while switching to and from a persisted picture', async () => {
  const garage = useGarage.getState()
  garage.update({ model: 'wagon', roof: 'canoe', body: '#123456', picture: 'local-picture', usePicture: true })
  await useGarage.persist.rehydrate()
  expect(useGarage.getState()).toMatchObject({ picture: 'local-picture', usePicture: true, model: 'wagon', roof: 'canoe' })
  garage.update({ usePicture: false })
  expect(useGarage.getState()).toMatchObject({ picture: 'local-picture', model: 'wagon', body: '#123456', roof: 'canoe' })
  garage.update({ picture: undefined, usePicture: false })
  expect(useGarage.getState().picture).toBeUndefined()
})
