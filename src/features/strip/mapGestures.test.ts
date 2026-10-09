import { describe, expect, it, vi } from 'vitest'
import { bindMapGestures } from './mapGestures'

describe('strip map gestures', () => {
  it('leaves plain wheels alone and consumes Ctrl/Cmd wheels, including line deltas', () => {
    const element = document.createElement('div')
    const adjust = vi.fn()
    const cleanup = bindMapGestures(element, adjust)
    const plain = new WheelEvent('wheel', { deltaY: 120, cancelable: true })
    element.dispatchEvent(plain)
    expect(plain.defaultPrevented).toBe(false)
    expect(adjust).not.toHaveBeenCalled()
    for (const modifier of ['ctrlKey', 'metaKey']) {
      const wheel = new WheelEvent('wheel', { [modifier]: true, deltaY: -3, deltaMode: 1, cancelable: true })
      element.dispatchEvent(wheel)
      expect(wheel.defaultPrevented).toBe(true)
      expect(adjust).toHaveBeenLastCalledWith({ zoom: 0.16 })
    }
    cleanup()
    element.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: 120 }))
    expect(adjust).toHaveBeenCalledTimes(2)
  })

  it('pans plain drags past a few pixels, and rotates and tilts modified drags', () => {
    const element = document.createElement('div')
    const adjust = vi.fn()
    const cleanup = bindMapGestures(element, adjust)
    element.dispatchEvent(new MouseEvent('mousedown', { clientX: 20, clientY: 50 }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 22, clientY: 51 }))
    expect(adjust).not.toHaveBeenCalled()
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 30 }))
    expect(adjust).toHaveBeenLastCalledWith({ panX: 20, panY: -20 })
    window.dispatchEvent(new MouseEvent('mouseup'))
    for (const options of [{ ctrlKey: true }, { metaKey: true }, { button: 2 }]) {
      element.dispatchEvent(new MouseEvent('mousedown', { ...options, clientX: 20, clientY: 50 }))
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 30 }))
      expect(adjust).toHaveBeenLastCalledWith({ bearing: 10, pitch: 6 })
      window.dispatchEvent(new MouseEvent('mouseup'))
    }
    cleanup()
  })

  it('allows one-finger scrolling and handles pinch/twist without angle wrap jumps', () => {
    const element = document.createElement('div')
    const adjust = vi.fn()
    const cleanup = bindMapGestures(element, adjust)
    const dispatch = (type: string, points: number[][]) => {
      const event = new Event(type, { cancelable: true })
      Object.defineProperty(event, 'touches', { value: points.map(([clientX, clientY]) => ({ clientX, clientY })) })
      element.dispatchEvent(event)
      return event
    }
    expect(dispatch('touchstart', [[0, 0]]).defaultPrevented).toBe(false)
    expect(dispatch('touchmove', [[0, 20]]).defaultPrevented).toBe(false)
    expect(adjust).not.toHaveBeenCalled()
    expect(
      dispatch('touchstart', [
        [0, 0],
        [10, 0],
      ]).defaultPrevented,
    ).toBe(true)
    expect(
      dispatch('touchmove', [
        [0, 0],
        [0, 20],
      ]).defaultPrevented,
    ).toBe(true)
    expect(adjust).toHaveBeenLastCalledWith({ zoom: 1, bearing: 90 })
    dispatch('touchstart', [
      [0, 0],
      [-10, 0.1],
    ])
    dispatch('touchmove', [
      [0, 0],
      [-10, -0.1],
    ])
    expect(Math.abs(adjust.mock.lastCall![0].bearing)).toBeLessThan(2)
    dispatch('touchcancel', [])
    expect(dispatch('touchmove', [[0, 20]]).defaultPrevented).toBe(false)
    cleanup()
  })
})
