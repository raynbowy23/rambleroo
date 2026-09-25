import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ShareControl } from './ShareControl'
import { renderBywayPostcard } from '../postcard/renderBywayPostcard'
import type { BywaySummary, Photo } from '../../lib/types'
vi.mock('../postcard/renderBywayPostcard', () => ({ renderBywayPostcard: vi.fn() }))
const byway = { id: 'river', name: 'River & Hills' } as BywaySummary
const photo = { file: 'river.jpg' } as Photo
const file = new File(['png'], 'river.png', { type: 'image/png' })
beforeEach(() => {
  vi.mocked(renderBywayPostcard).mockResolvedValue(file)
  HTMLElement.prototype.showPopover = vi.fn()
  HTMLElement.prototype.hidePopover = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
it('shares the PNG, selected photo, note and canonical road URL', async () => {
  const share = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  Object.defineProperty(navigator, 'canShare', { value: vi.fn(() => true), configurable: true })
  render(<ShareControl byway={byway} note="Meet at sunset" photo={photo} />)
  fireEvent.click(screen.getByRole('button', { name: 'Share' }))
  await waitFor(() =>
    expect(share).toHaveBeenCalledWith({
      files: [file],
      title: byway.name,
      text: 'River & Hills — found on Rambleroo\n\nMeet at sunset',
      url: new URL('/byway/river', location.origin).href,
    }),
  )
  expect(renderBywayPostcard).toHaveBeenCalledWith(byway, undefined, 'Meet at sunset', photo)
})
it('offers fallback links without exporting an image or including an empty note', () => {
  Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true })
  vi.mocked(renderBywayPostcard).mockClear()
  render(<ShareControl byway={byway} note="  " />)
  fireEvent.click(screen.getByRole('button', { name: 'Share' }))
  expect(HTMLElement.prototype.showPopover).toHaveBeenCalled()
  expect(renderBywayPostcard).not.toHaveBeenCalled()
  expect(screen.queryByText('Your note is included')).toBeNull()
  const email = screen.getByRole('link', { name: 'Email', hidden: true })
  expect(new URL(email.getAttribute('href')!).searchParams.get('body')).toBe(
    `River & Hills — found on Rambleroo\n\n${new URL('/byway/river', location.origin).href}`,
  )
  fireEvent.keyDown(email, { key: 'Escape' })
  expect(HTMLElement.prototype.hidePopover).toHaveBeenCalled()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Share' }))
})
