import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MomentPhoto, PhotoGallery, photoCredit } from './Photos'
import type { Photo } from '../../lib/types'

const photo: Photo = {
  bywayId: 'river',
  file: 'river.jpg',
  width: 1200,
  height: 800,
  title: 'River bend',
  alt: 'A river winding past green bluffs',
  author: 'A. Photographer',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://example.com/license',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:River.jpg',
  moment: 'River bend',
}
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
})
afterEach(cleanup)
it('hides the gallery for roads without photos', () => {
  const { container } = render(<PhotoGallery photos={[]} />)
  expect(container.textContent).toBe('')
})
it('shows dimensions, credit links and a lightbox that restores focus on Escape', () => {
  render(<PhotoGallery photos={[photo]} />)
  const image = screen.getByAltText(photo.alt)
  expect(image.getAttribute('width')).toBe('1200')
  expect(image.getAttribute('height')).toBe('800')
  expect(image.getAttribute('loading')).toBe('lazy')
  expect(screen.getByRole('link', { name: photo.license }).getAttribute('href')).toBe(photo.licenseUrl)
  expect(screen.getByRole('link', { name: 'Wikimedia Commons' }).getAttribute('href')).toBe(photo.sourceUrl)
  const opener = screen.getByRole('button', { name: 'Enlarge River bend' })
  opener.focus()
  fireEvent.click(opener)
  const dialog = document.querySelector('dialog')!
  expect(dialog).not.toBeNull()
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(document.querySelector('dialog')).toBeNull()
  expect(document.activeElement).toBe(opener)
  expect(photoCredit(photo)).toContain(photo.author)
  expect(photoCredit(photo)).toContain(photo.licenseUrl)
})
it('defaults moment cards to their photo and offers an illustration switch', () => {
  render(
    <MomentPhoto photo={photo}>
      <span>Illustrated river bend</span>
    </MomentPhoto>,
  )
  expect(screen.getByAltText(photo.alt)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Illustration' }))
  expect(screen.queryByAltText(photo.alt)).toBeNull()
  expect(screen.getByText('Illustrated river bend')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Photo' }))
  expect(screen.getByAltText(photo.alt)).toBeTruthy()
})
