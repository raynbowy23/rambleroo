import { expect, it } from 'vitest'
import { pageTitle, photoUrl, roadMeta, titleFor } from './seo'
import type { BywaySummary, Collection, Photo } from './types'

const road = {
  id: 'kanc-1',
  name: 'Kancamagus Scenic Byway',
  states: ['NH'],
  themes: ['mountain'],
  designations: ['National Scenic Byway'],
  nationalScenicByway: true,
  allAmericanRoad: false,
  mappedMiles: 35.6,
} as BywaySummary
const photo = { file: '/photos/kanc-1/notch.jpg', width: 1600, height: 1000, alt: 'A notch.' } as Photo

it('describes a road from its story tagline, or from its listing when it has no story', () => {
  expect(roadMeta(road, 'Two dead ends became a mountain crossing', photo, 'https://photos.example')).toEqual({
    path: '/byway/kanc-1',
    title: 'Kancamagus Scenic Byway · Rambleroo',
    description: 'Two dead ends became a mountain crossing. National Scenic Byway, 36 miles mapped.',
    image: { url: 'https://photos.example/kanc-1/notch.jpg', width: 1600, height: 1000, alt: 'A notch.' },
  })
  expect(roadMeta(road, undefined, undefined, '').description).toBe(
    'A mountain road through New Hampshire. National Scenic Byway, 36 miles mapped.',
  )
  expect(photoUrl(photo, '')).toBe('https://rambleroo.app/photos/kanc-1/notch.jpg')
})

it('titles the browser tab for each kind of page', () => {
  const name = (id: string) => (id === 'kanc-1' ? road.name : undefined)
  const collections = [{ slug: 'follow-the-water', title: 'Follow the Water' }] as Collection[]
  expect(titleFor('/', name, collections)).toBe(pageTitle())
  expect(titleFor('/byway/kanc-1', name, collections)).toBe('Kancamagus Scenic Byway · Rambleroo')
  expect(titleFor('/byway/kanc-1/strip', name, collections)).toBe('Kancamagus Scenic Byway strip map · Rambleroo')
  expect(titleFor('/byway/unknown', name, collections)).toBe(pageTitle())
  expect(titleFor('/state/nh', name, collections)).toBe('New Hampshire scenic byways · Rambleroo')
  expect(titleFor('/collections/follow-the-water', name, collections)).toBe('Follow the Water · Rambleroo')
  expect(titleFor('/about', name, collections)).toBe('About the data · Rambleroo')
})
