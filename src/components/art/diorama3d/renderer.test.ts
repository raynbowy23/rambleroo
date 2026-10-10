import { afterEach, expect, it, vi } from 'vitest'
import * as T from 'three'
import { buildScene } from './scene'
import { specs } from './fixtures.test-data'
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
import { registerScene, MAX_ZOOM, MIN_ZOOM } from './renderer'
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
  let reduceMotion = false
  vi.stubGlobal('matchMedia', () => ({ matches: reduceMotion, addEventListener() {}, removeEventListener() {} }))
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
  // The same projected framing is used for desktop and 390px-phone card widths.
  for (const width of [360, 560]) {
    elements[0].getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: width,
      bottom: width,
      width,
      height: width,
      x: 0,
      y: 0,
      toJSON() {},
    })
    registrations[0].rotateBy(0)
    tick()
    built[0].world.updateMatrixWorld(true)
    built[0].camera.updateMatrixWorld(true)
    const corners = [
      [-4, -4],
      [-4, 4],
      [4, -4],
      [4, 4],
    ].map(([x, z]) => new T.Vector3(x, 0, z).applyMatrix4(built[0].world.matrixWorld).project(built[0].camera))
    const coverage = (Math.max(...corners.map((p) => p.x)) - Math.min(...corners.map((p) => p.x))) / 2
    expect(coverage).toBeCloseTo(0.85, 1)
  }
  registrations[0].grab()
  registrations[0].rotateBy(1.5)
  tick()
  expect(built[0].world.rotation.y).toBeCloseTo(1.5)
  registrations[0].tiltBy(100)
  tick()
  const highY = built[0].camera.position.y
  registrations[0].tiltBy(100)
  tick()
  expect(built[0].camera.position.y).toBeCloseTo(highY)
  registrations[0].tiltBy(-100)
  tick()
  expect(built[0].camera.position.y).toBeLessThan(highY)
  const wide = built[0].camera.top
  registrations[0].zoomBy(2)
  tick()
  expect(built[0].camera.top).toBeCloseTo(wide / 2)
  expect(registrations[0].zoomBy(100)).toBe(MAX_ZOOM)
  expect(registrations[0].zoomBy(0.0001)).toBe(MIN_ZOOM)
  expect(registrations[0].zoomBy(Number.NaN)).toBe(MIN_ZOOM)
  registrations[0].zoomBy(1 / MIN_ZOOM)
  registrations[0].release()
  reduceMotion = true
  const angle = built[0].world.rotation.y
  const position = built[0].driver.position.clone()
  tick()
  expect(callbacks.size).toBe(0)
  expect(built[0].world.rotation.y).toBe(angle)
  expect(built[0].driver.position.equals(position)).toBe(true)
  registrations[0].rotateBy(0.2)
  tick()
  expect(built[0].world.rotation.y).toBeCloseTo(angle + 0.2)
  expect(callbacks.size).toBe(0)
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
