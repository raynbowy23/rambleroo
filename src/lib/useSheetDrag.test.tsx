import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { useSheetDrag } from './useSheetDrag'

beforeAll(() => {
  vi.stubGlobal('PointerEvent', MouseEvent)
  HTMLElement.prototype.setPointerCapture = vi.fn()
})
afterEach(cleanup)

function Sheet({ close }: { close?: () => void }) {
  const [snap, setSnap] = useState(0)
  const sheet = useSheetDrag(snap, close ?? setSnap, !!close)
  return (
    <div
      ref={(element) => {
        if (element) Object.defineProperty(element, 'clientHeight', { value: 800, configurable: true })
      }}
    >
      <div ref={sheet.ref} style={sheet.style} data-testid="sheet" data-snap={snap}>
        <button {...sheet.handlers}>Handle</button>
      </div>
    </div>
  )
}

it('cycles snap positions by tapping the handle', () => {
  render(<Sheet />)
  const handle = screen.getByText('Handle')
  for (const snap of [1, 2, 0]) {
    fireEvent.click(handle)
    expect(screen.getByTestId('sheet').dataset.snap).toBe(String(snap))
  }
})

it('follows a drag, rubber-bands beyond its end, then snaps without also cycling', () => {
  render(<Sheet />)
  const handle = screen.getByText('Handle')
  const sheet = screen.getByTestId('sheet')
  vi.spyOn(sheet, 'getBoundingClientRect').mockReturnValue({ height: 150 } as DOMRect)
  fireEvent.pointerDown(handle, { clientY: 650, button: 0 })
  fireEvent.pointerMove(handle, { clientY: -100 })
  const height = parseFloat(sheet.style.height)
  expect(height).toBeGreaterThan(704)
  expect(height).toBeLessThan(900)
  fireEvent.pointerUp(handle, { clientY: -100 })
  fireEvent.click(handle)
  expect(sheet.dataset.snap).toBe('2')
  expect(sheet.style.height).toBe('')
})

it('cancels a drag without snapping or dismissing', () => {
  const close = vi.fn()
  render(<Sheet close={close} />)
  const handle = screen.getByText('Handle')
  fireEvent.pointerDown(handle, { clientY: 200, button: 0 })
  fireEvent.pointerMove(handle, { clientY: 350 })
  fireEvent.pointerCancel(handle, { clientY: 350 })
  expect(close).not.toHaveBeenCalled()
  expect(screen.getByTestId('sheet').style.transform).toBe('')
})

it('dismisses the postcard with a downward swipe', () => {
  const close = vi.fn()
  render(<Sheet close={close} />)
  const handle = screen.getByText('Handle')
  fireEvent.pointerDown(handle, { clientY: 200, button: 0 })
  fireEvent.pointerMove(handle, { clientY: 350 })
  fireEvent.pointerUp(handle, { clientY: 350 })
  expect(close).toHaveBeenCalledOnce()
})
