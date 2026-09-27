import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PostcardArt } from './PostcardArt'
import { renderBywayPostcard } from './renderBywayPostcard'
import { downloadBlob } from './download'
import type { BywaySummary, Photo } from '../../lib/types'
vi.mock('../../lib/data', () => ({ usePhotos: () => [photo] }))
vi.mock('./renderBywayPostcard', () => ({ renderBywayPostcard: vi.fn() }))
vi.mock('./download', () => ({ downloadBlob: vi.fn() }))
const photo: Photo = {
  bywayId: 'river',
  file: 'river.jpg',
  width: 1200,
  height: 800,
  title: 'River bend',
  alt: 'River bend photograph',
  author: 'Photographer',
  license: 'CC BY',
  licenseUrl: 'https://example.com/license',
  sourceUrl: 'https://example.com/photo',
}
const byway: BywaySummary = {
  id: 'river',
  name: 'River Road',
  states: ['WI'],
  scene: 'river',
  region: 'upper-midwest',
  seed: 1,
  designations: [],
  themes: ['water'],
  mappedMiles: 20,
  sourceId: 1,
  nationalScenicByway: false,
  allAmericanRoad: false,
  bbox: [-92, 42, -90, 44],
  center: [-91, 43],
  status: 'listing',
  themeSource: 'inferred',
  look: { palette: 0, layout: 0, season: 'summer', time: 'day', lettering: 'greetings', border: 'white', mirror: false },
}
afterEach(cleanup)
it('defaults to a photo postcard and exports its photo and note', async () => {
  const file = new File(['png'], 'postcard.png', { type: 'image/png' })
  vi.mocked(renderBywayPostcard).mockResolvedValue(file)
  render(<PostcardArt byway={byway} note="A day on the river" onNote={() => {}} />)
  expect(screen.getByRole('img', { name: `River Road postcard: ${photo.alt}` })).toBeTruthy()
  expect(document.querySelector('image')?.getAttribute('href')).toBe('/photos/river/river.jpg')
  expect(screen.getByRole('link', { name: 'CC BY' })).toBeTruthy()
  expect(document.querySelector('[data-lettering="greetings"]')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Download postcard' }))
  await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(file, file.name))
  expect(renderBywayPostcard).toHaveBeenCalledWith(byway, undefined, 'A day on the river', photo)
  expect(screen.queryByRole('button', { name: 'Illustration' })).toBeNull()
})
