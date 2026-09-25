import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { VisitEditor } from './VisitEditor'
import { usePassport } from '../../lib/passport'
import type { BywaySummary } from '../../lib/types'
const road: BywaySummary = {
  id: 'river',
  name: 'River Road',
  states: ['WI'],
  themes: ['water'],
  sourceId: 1,
  designations: [],
  nationalScenicByway: false,
  allAmericanRoad: false,
  mappedMiles: 244,
  bbox: [-92, 42, -90, 44],
  center: [-91, 43],
  scene: 'river',
  region: 'upper-midwest',
  status: 'listing',
  seed: 1,
  themeSource: 'inferred',
}
beforeAll(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 24, 12))
  usePassport.setState({ saved: {}, visits: [], lastStampId: null })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
describe('visit editor', () => {
  it('defaults to the local date and part scope, saves to the store and reveals a stamp', () => {
    render(
      <MemoryRouter>
        <VisitEditor byway={road} onClose={vi.fn()} />
      </MemoryRouter>,
    )
    const date = screen.getByLabelText('Date') as HTMLInputElement
    expect(date.value).toBe('2026-09-24')
    expect(date.max).toBe('2026-09-24')
    expect((screen.getByLabelText('Part of the road') as HTMLInputElement).checked).toBe(true)
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: '  River light  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save visit' }))
    const visits = usePassport.getState().visits
    expect(visits).toHaveLength(1)
    expect(visits[0]).toMatchObject({ bywayId: 'river', date: '2026-09-24', scope: 'part', note: 'River light' })
    expect(usePassport.getState().lastStampId).toBe(visits[0].id)
    expect(screen.getByText('Stamp added to your passport')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View passport' }).getAttribute('href')).toBe('/passport')
  })
  it('rejects future dates and updates an existing visit without adding another', () => {
    const visit = usePassport.getState().addVisit({ bywayId: 'river', date: '2020-05-01', scope: 'part', note: 'First visit' })
    const close = vi.fn()
    render(
      <MemoryRouter>
        <VisitEditor byway={road} visit={visit} onClose={close} />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2999-01-01' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Save visit' }).closest('form')!)
    expect(usePassport.getState().visits[0].date).toBe('2020-05-01')
    expect(close).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2021-05-01' } })
    fireEvent.click(screen.getByLabelText('The whole road'))
    fireEvent.click(screen.getByRole('button', { name: 'Save visit' }))
    expect(usePassport.getState().visits).toHaveLength(1)
    expect(usePassport.getState().visits[0]).toMatchObject({ id: visit.id, date: '2021-05-01', scope: 'whole' })
    expect(close).toHaveBeenCalledOnce()
  })
  it('traps Tab, closes on Escape, and restores focus on unmount', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const close = vi.fn()
    const view = render(
      <MemoryRouter>
        <VisitEditor byway={road} onClose={close} />
      </MemoryRouter>,
    )
    const first = screen.getByRole('button', { name: 'Close dialog' }),
      last = screen.getByRole('button', { name: 'Save visit' })
    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
    fireEvent.keyDown(last, { key: 'Escape' })
    expect(close).toHaveBeenCalledOnce()
    view.unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})
