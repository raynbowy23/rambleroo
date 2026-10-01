import { expect, it, vi } from 'vitest'
import { bindBasemapFallback, detailFade } from './basemap'
import type { Map } from './maplibre'

it('crossfades only after vector content arrives and restores geography after a tile failure', () => {
  const listeners: Record<string, (event: object) => void> = {}
  const setPaintProperty = vi.fn()
  const isSourceLoaded = vi.fn(() => false)
  bindBasemapFallback({
    on: (event: string, listener: (event: object) => void) => {
      listeners[event] = listener
    },
    getLayer: () => true,
    isSourceLoaded,
    setPaintProperty,
  } as unknown as Map)
  listeners.sourcedata({ sourceId: 'openfreemap', sourceDataType: 'metadata' })
  listeners.sourcedata({ sourceId: 'openfreemap', tile: {} })
  expect(setPaintProperty).not.toHaveBeenCalled()
  isSourceLoaded.mockReturnValue(true)
  listeners.sourcedata({ sourceId: 'openfreemap', sourceDataType: 'content' })
  expect(setPaintProperty).not.toHaveBeenCalled()
  listeners.sourcedata({ sourceId: 'openfreemap', tile: {} })
  expect(setPaintProperty).toHaveBeenLastCalledWith('detail-ground', 'background-opacity', detailFade)
  listeners.error({ sourceId: 'openfreemap' })
  expect(setPaintProperty).toHaveBeenLastCalledWith('detail-ground', 'background-opacity', 0)
  listeners.sourcedata({ sourceId: 'openfreemap', tile: {} })
  expect(setPaintProperty).toHaveBeenCalledTimes(2)
})
