import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Map } from './maplibre'
import type { BywayGeometry } from './layers'
import { animateSelection, setMomentPins } from './selection'

vi.mock('./routeArt', () => ({ addMomentStamp: (_map: Map, number: number) => `route-stamp-${number}` }))
const features: BywayGeometry['features'] = [
  {
    type: 'Feature',
    properties: { id: 'route', name: 'Test road', scene: 'river', story: true },
    geometry: {
      type: 'MultiLineString',
      coordinates: [
        [
          [0, 0],
          [4, 0],
        ],
        [
          [1, 1],
          [1.1, 1],
        ],
      ],
    },
  },
]

function adapter() {
  const sources = Object.fromEntries(['selected', 'route-flags', 'route-car', 'route-moments'].map((id) => [id, { setData: vi.fn() }]))
  const paint = vi.fn()
  const map = { getSource: (id: string) => sources[id], setPaintProperty: paint } as unknown as Map
  return { map, sources, paint }
}
beforeEach(() => {
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({ getPropertyValue: () => '#202925' } as unknown as CSSStyleDeclaration)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('draws fully and parks without scheduling frames under reduced motion', () => {
  const raf = vi.fn()
  vi.stubGlobal('requestAnimationFrame', raf)
  const { map, sources, paint } = adapter()
  animateSelection(map, features, false)
  expect(raf).not.toHaveBeenCalled()
  // The finished pen trace lifts away so the road's motif shows.
  expect(paint).toHaveBeenLastCalledWith('selected-line', 'line-gradient', ['literal', 'rgba(0,0,0,0)'])
  const car = sources['route-car'].setData.mock.lastCall![0]
  expect(car.geometry.coordinates[0]).toBeCloseTo(4)
  expect(car.properties.bearing).toBe(90)
  expect(sources['route-flags'].setData.mock.lastCall![0].features).toHaveLength(2)
})

it('only updates the car source during the trace and stops after 1.2 seconds', () => {
  let callback: FrameRequestCallback = () => {}
  vi.spyOn(performance, 'now').mockReturnValue(0)
  const raf = vi.fn((next: FrameRequestCallback) => {
    callback = next
    return 42
  })
  const cancel = vi.fn()
  vi.stubGlobal('requestAnimationFrame', raf)
  vi.stubGlobal('cancelAnimationFrame', cancel)
  const { map, sources, paint } = adapter()
  const stop = animateSelection(map, features, true)
  callback(600)
  expect(sources['route-car'].setData.mock.lastCall![0].geometry.coordinates[0]).toBeCloseTo(2)
  expect(sources.selected.setData).toHaveBeenCalledTimes(1)
  callback(1200)
  expect(raf).toHaveBeenCalledTimes(2)
  // The finished pen trace lifts away so the road's motif shows.
  expect(paint).toHaveBeenLastCalledWith('selected-line', 'line-gradient', ['literal', 'rgba(0,0,0,0)'])
  stop()
  expect(cancel).toHaveBeenCalledWith(42)
})

it('clears selection and preserves story numbering when some moments lack coordinates', () => {
  const { map, sources } = adapter()
  animateSelection(map, [], true)
  for (const id of ['selected', 'route-flags', 'route-car']) {
    expect(sources[id].setData.mock.lastCall![0].features).toEqual([])
  }
  setMomentPins(map, 'route', [{ title: 'Unlocated' }, { title: 'Lookout', at: [1, 2] }])
  expect(sources['route-moments'].setData.mock.lastCall![0].features[0].properties).toEqual({
    id: 'route',
    title: 'Lookout',
    icon: 'route-stamp-2',
  })
  setMomentPins(map, undefined, [{ title: 'Lookout', at: [1, 2] }])
  expect(sources['route-moments'].setData.mock.lastCall![0].features).toEqual([])
})
