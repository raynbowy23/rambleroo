import type { Map } from './maplibre'

// Opt in with ?mapProfile=1, then pan/zoom. No animation loop runs on an idle map.
// Compare with &mapStrokes=dash on the same device and the same camera path.
export function profileRouteFrames(map: Map) {
  if (!import.meta.env.DEV || !new URLSearchParams(location.search).has('mapProfile')) return () => {}
  let last = 0
  let frames: number[] = []
  const reset = () => {
    last = 0
    frames = []
  }
  const sample = () => {
    if (!map.isMoving()) return
    const now = performance.now()
    if (last) frames.push(now - last)
    last = now
  }
  const report = () => {
    if (frames.length < 10) return
    const sorted = [...frames].sort((a, b) => a - b)
    console.debug('[Rambleroo route frames]', {
      strokes: new URLSearchParams(location.search).get('mapStrokes') === 'dash' ? 'dash' : 'pattern',
      frames: frames.length,
      meanMs: +(frames.reduce((sum, n) => sum + n, 0) / frames.length).toFixed(1),
      p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1),
    })
  }
  map.on('movestart', reset)
  map.on('render', sample)
  map.on('moveend', report)
  return () => {
    map.off('movestart', reset)
    map.off('render', sample)
    map.off('moveend', report)
  }
}
