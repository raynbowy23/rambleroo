import type { StripData } from '../strip/types'
import { afterEach, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { CardFront } from './CardFront'
import { defaultGarage } from '../../lib/garage'
import { postcardDefaults } from '../../lib/postcards'
import type { BywaySummary } from '../../lib/types'
import { milestones, routeInset } from './cardData'
const byway = {
  id: 'door',
  name: 'Door County',
  states: ['WI'],
  scene: 'coast',
  region: 'great-lakes',
  seed: 4,
  look: { palette: 0, layout: 0, season: 'summer', time: 'day', lettering: 'greetings', border: 'white', mirror: false },
} as BywaySummary
afterEach(cleanup)
it('renders the chosen photo, lettering and parked vehicle on real route geometry', () => {
  const { container, rerender } = render(
    <CardFront
      byway={byway}
      choices={{ ...postcardDefaults(), front: 'own', lettering: 'script' }}
      ownUrl="data:image/jpeg;base64,aGVsbG8="
      garage={{ ...defaultGarage, model: 'wagon' }}
      milestone={{ id: 'ephraim', name: 'Ephraim', mile: 37.2, on: 'main', scene: 'town' }}
      route={{
        lines: [
          [
            [-87, 44],
            [-86, 45],
          ],
        ],
        position: [-86.5, 44.5],
      }}
    />,
  )
  expect(container.querySelector('image')?.getAttribute('href')).toMatch(/^data:image/)
  expect(container.querySelector('[data-lettering="script"]')).toBeTruthy()
  expect(container.querySelector('[data-vehicle="wagon"]')?.getAttribute('viewBox')).toBe('0 0 60 100')
  expect(container.querySelector('path[stroke="var(--map-route-water)"]')).toBeTruthy()
  rerender(
    <CardFront byway={byway} choices={{ ...postcardDefaults(), car: false, route: false, lettering: 'off' }} garage={defaultGarage} />,
  )
  expect(container.querySelector('image')).toBeNull()
  expect(container.querySelector('[data-vehicle]')).toBeNull()
  expect(container.querySelector('[data-lettering]')).toBeNull()
})
it('preserves breaks and projects a milestone at its geographic location', () => {
  const inset = routeInset({
    lines: [
      [
        [0, 0],
        [1, 1],
      ],
      [
        [2, 2],
        [3, 3],
      ],
    ],
    position: [1, 1],
  })!
  expect(inset.path.match(/M/g)).toHaveLength(2)
  expect(inset.position[0]).toBeGreaterThan(inset.start[0])
  expect(inset.position[1]).toBeGreaterThan(inset.end[1])
  expect(routeInset({ lines: [] })).toBeUndefined()
})

it('gives a town and a story moment with the same name independent stable keys', () => {
  const cards = milestones({
    towns: [{ name: 'Ephraim', mile: 37.2, on: 'main' }],
    moments: [{ title: 'Ephraim', mile: 37.3, on: 'main', scene: 'town' }],
  } as StripData)
  expect(cards.map((card) => card.id)).toEqual(['ephraim', 'ephraim-moment'])
})

it('uses town photos under the postcard credit rule and renders a car sticker', () => {
  const photo = {
    file: '/photos/town.jpg',
    alt: 'Town square',
    author: 'Photographer',
    license: 'CC BY',
    title: 'Town',
  } as import('../../lib/types').Photo
  const [town] = milestones({ towns: [{ name: 'Town', mile: 10, on: 'main', photo }], moments: [] } as unknown as StripData)
  expect(town.photo).toBe(photo)
  const { container } = render(
    <CardFront
      byway={byway}
      milestone={town}
      photo={town.photo}
      choices={postcardDefaults(town.photo)}
      garage={{ ...defaultGarage, usePicture: true, picture: 'car' }}
      pictureUrl="data:image/png;base64,cGljdHVyZQ=="
    />,
  )
  expect(container.querySelector('image')?.getAttribute('href')).toBe(photo.file)
  expect(container.querySelector('[data-vehicle="picture"] image')?.getAttribute('href')).toMatch(/^data:image\/png/)
})
