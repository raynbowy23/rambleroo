import { afterEach, expect, it, vi } from 'vitest'
import * as T from 'three'
import { buildScene } from './scene'
import { specs } from './spec'
import { defaultGarage } from '../../../lib/garage'

const mock = vi.hoisted(() => ({ created: 0, render: vi.fn(), dispose: vi.fn(), contextLoss: vi.fn() }))
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three')
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = document.createElement('canvas')
      constructor() {
        mock.created++
      }
      setPixelRatio() {}
      setSize() {}
      setScissorTest() {}
      setClearColor() {}
      clear() {}
      setViewport() {}
      setScissor() {}
      render = mock.render
      dispose = mock.dispose
      forceContextLoss = mock.contextLoss
    },
  }
})
import { registerScene } from './renderer'
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})
it('shares one WebGL context, sleeps off screen and releases resources', () => {
  const callbacks = new Map<number, FrameRequestCallback>()
  let next = 1
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    callbacks.set(next, fn)
    return next++
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id))
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  let intersect: IntersectionObserverCallback = () => {}
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(fn: IntersectionObserverCallback) {
        intersect = fn
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  const elements = specs.map(() => {
    const e = document.createElement('div')
    e.getBoundingClientRect = () => ({ left: 20, top: 20, right: 380, bottom: 350, width: 360, height: 330, x: 20, y: 20, toJSON() {} })
    return e
  })
  const built = specs.map((s) => buildScene(s, defaultGarage, { hour: 13, season: 'summer', weather: 'clear' }))
  const registrations = built.map((b, i) => registerScene(elements[i], b))
  expect(mock.created).toBe(1)
  expect(document.querySelectorAll('canvas')).toHaveLength(1)
  const tick = () => {
    const entries = [...callbacks]
    callbacks.clear()
    for (const [, fn] of entries) fn(performance.now())
  }
  const entries = (isIntersecting: boolean): IntersectionObserverEntry[] =>
    elements.map((target) => ({
      target,
      isIntersecting,
      boundingClientRect: target.getBoundingClientRect(),
      intersectionRect: target.getBoundingClientRect(),
      intersectionRatio: isIntersecting ? 1 : 0,
      rootBounds: null,
      time: performance.now(),
    }))
  tick()
  expect(mock.render).not.toHaveBeenCalled()
  expect(callbacks.size).toBe(0)
  intersect(entries(true), {} as IntersectionObserver)
  tick()
  expect(mock.render).toHaveBeenCalledTimes(3)
  expect(callbacks.size).toBe(1)
  registrations[0].grab()
  registrations[0].rotateBy(1.5)
  tick()
  expect(built[0].world.rotation.y).toBeCloseTo(1.5)
  registrations[0].release()
  intersect(entries(false), {} as IntersectionObserver)
  tick()
  expect(callbacks.size).toBe(0)
  for (const registration of registrations) registration.dispose()
  expect(mock.dispose).toHaveBeenCalledOnce()
  expect(mock.contextLoss).toHaveBeenCalledOnce()
  expect(document.querySelectorAll('canvas')).toHaveLength(0)
  expect(callbacks.size).toBe(0)
  expect(built[0].scene).toBeInstanceOf(T.Scene)
})
