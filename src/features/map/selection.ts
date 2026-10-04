import type { Feature, LineString, Point } from 'geojson'
import type { GeoJSONSource, Map } from './maplibre'
import type { BywayGeometry } from './layers'
import { longestPart, journeyPoint } from './routeJourney'
import { addMomentStamp } from './routeArt'
import { palette } from './style'

export type StoryMoment = { title: string; at?: [number, number] }
export const emptyCollection = { type: 'FeatureCollection' as const, features: [] }

export function animateSelection(map: Map, features: BywayGeometry['features'], enabled: boolean) {
  // Separate LineStrings give every disconnected part its own complete pen trace.
  const lines: Feature<LineString>[] = features.flatMap((f) =>
    f.geometry.coordinates.map((coordinates) => ({
      type: 'Feature',
      properties: f.properties,
      geometry: { type: 'LineString', coordinates },
    })),
  )
  const ink = palette()('ink')
  map.setPaintProperty('selected-line', 'line-gradient', ['literal', 'rgba(0,0,0,0)'])
  ;(map.getSource('selected') as GeoJSONSource).setData({ type: 'FeatureCollection', features: lines })
  const part = longestPart(lines.map((f) => f.geometry.coordinates))
  const flags: Feature<Point>[] = part
    ? [
        { type: 'Feature', properties: { icon: 'route-start' }, geometry: { type: 'Point', coordinates: part.coordinates[0] } },
        { type: 'Feature', properties: { icon: 'route-finish' }, geometry: { type: 'Point', coordinates: part.coordinates.at(-1)! } },
      ]
    : []
  ;(map.getSource('route-flags') as GeoJSONSource).setData({ type: 'FeatureCollection', features: flags })
  ;(map.getSource('route-car') as GeoJSONSource).setData(emptyCollection)
  let frame = 0
  const start = performance.now()
  const trace = (now: number) => {
    const progress = enabled ? Math.min(1, (now - start) / 1200) : 1
    map.setPaintProperty(
      'selected-line',
      'line-gradient',
      progress === 1 ? ['literal', 'rgba(0,0,0,0)'] : ['step', ['line-progress'], ink, Math.max(0.00001, progress), 'rgba(0,0,0,0)'],
    )
    if (part) {
      const point = journeyPoint(part, progress)
      ;(map.getSource('route-car') as GeoJSONSource).setData({
        type: 'Feature',
        properties: { bearing: point.bearing },
        geometry: { type: 'Point', coordinates: point.coordinates },
      })
    }
    // Once the pen reaches the end its ink lifts away, leaving the road's own motif (selected-art) under the gold glow.
    if (progress < 1) frame = requestAnimationFrame(trace)
  }
  if (features.length) trace(start)
  return () => cancelAnimationFrame(frame)
}

export function setMomentPins(map: Map, id: string | undefined, moments: StoryMoment[]) {
  // Unlocated moments stay in the story; inventing a position would imply a real stop.
  const features: Feature<Point>[] = id
    ? moments.flatMap((moment, index) =>
        moment.at && moment.at.every(Number.isFinite)
          ? [
              {
                type: 'Feature',
                properties: { id, title: moment.title, icon: addMomentStamp(map, index + 1) },
                geometry: { type: 'Point', coordinates: moment.at },
              },
            ]
          : [],
      )
    : []
  ;(map.getSource('route-moments') as GeoJSONSource).setData({ type: 'FeatureCollection', features })
}
