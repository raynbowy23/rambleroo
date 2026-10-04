import { afterEach, beforeEach, expect, it } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ConsentBanner } from './ConsentBanner'
import { analyticsAvailable, useConsent } from '../../lib/analytics'

beforeEach(() => {
  localStorage.clear()
  useConsent.setState({ choice: null, open: false })
})
afterEach(cleanup)

it('offers analytics only on the live host', () => {
  expect(analyticsAvailable('rambleroo.app')).toBe(true)
  expect(analyticsAvailable('localhost')).toBe(false)
  expect(analyticsAvailable('www.rambleroo.app')).toBe(false)
  // Off the live host there is nothing to consent to, so no banner.
  render(<ConsentBanner />, { wrapper: MemoryRouter })
  expect(screen.queryByRole('region', { name: 'Cookie choice' })).toBeNull()
})

it('records a decline without loading Google, and an accept, each with equal weight', () => {
  render(<ConsentBanner force />, { wrapper: MemoryRouter })
  const decline = screen.getByRole('button', { name: 'Decline' })
  const accept = screen.getByRole('button', { name: 'Accept' })
  expect(decline.className).toBe(accept.className)
  fireEvent.click(decline)
  expect(JSON.parse(localStorage.getItem('rambleroo.consent.v1')!).analytics).toBe(false)
  expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull()
  useConsent.getState().decide(true)
  expect(useConsent.getState().choice?.analytics).toBe(true)
  // Not on rambleroo.app in tests, so even an accept loads nothing.
  expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull()
})
