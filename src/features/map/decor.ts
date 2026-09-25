import type { Map } from './maplibre'
import { palette } from './style'
type Kind = 'pine' | 'mountain' | 'mesa' | 'cactus' | 'wave' | 'lighthouse' | 'sailboat'
const groups: Record<Kind, [number, number][]> = {
  pine: [
    [-123, 47],
    [-122, 45],
    [-121, 43],
    [-120, 39],
    [-119, 37],
    [-116, 48],
    [-114, 47],
    [-91, 47],
    [-89, 46],
    [-85, 45],
    [-70, 45],
    [-72, 44],
    [-76, 42],
    [-79, 39],
    [-82, 36],
    [-84, 35],
  ],
  mountain: [
    [-122, 48],
    [-121, 46],
    [-121, 41],
    [-118, 37],
    [-117, 36],
    [-114, 46],
    [-112, 45],
    [-110, 44],
    [-109, 42],
    [-107, 40],
    [-106, 38],
    [-105, 36],
    [-81, 37],
    [-78, 40],
    [-71, 44],
  ],
  mesa: [
    [-110, 37],
    [-111, 36],
    [-109, 36],
    [-113, 38],
    [-108, 35],
    [-106, 35],
    [-112, 39],
  ],
  cactus: [
    [-113, 33],
    [-111, 32],
    [-110, 33],
    [-114, 34],
    [-112, 34],
    [-115, 33],
  ],
  wave: [
    [-128, 44],
    [-126, 39],
    [-123, 34],
    [-92, 25],
    [-86, 26],
    [-77, 30],
    [-72, 34],
    [-68, 39],
    [-87, 44],
    [-89, 48],
  ],
  lighthouse: [
    [-124, 44],
    [-123, 48],
    [-70, 43],
    [-75, 35],
    [-81, 28],
    [-86, 44],
    [-82, 42],
  ],
  sailboat: [
    [-127, 47],
    [-125, 36],
    [-94, 26],
    [-88, 27],
    [-74, 32],
    [-69, 38],
    [-87, 43],
    [-83, 45],
    [-90, 48],
  ],
}
export function addDecor(map: Map) {
  const c = palette()
  for (const kind of Object.keys(groups) as Kind[]) {
    const canvas = document.createElement('canvas')
    canvas.width = 80
    canvas.height = 80
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    ctx.scale(2, 2)
    ctx.strokeStyle = c(kind === 'wave' || kind === 'sailboat' ? 'water-deep' : 'forest')
    ctx.fillStyle = c(kind === 'mesa' || kind === 'cactus' ? 'terrain' : 'sage')
    ctx.lineWidth = 1.2
    ctx.lineJoin = 'round'
    ctx.globalAlpha = 0.65
    const path = new Path2D(
      {
        pine: 'M20 3L9 18H14L5 29H18V37H22V29H35L26 18H31Z',
        mountain: 'M3 33L16 7L23 20L28 13L38 33ZM11 18L16 22L19 16',
        mesa: 'M3 32L10 23L13 11H28L30 23L38 32ZM13 17H28M10 25H31',
        cactus: 'M19 36V8Q22 3 24 8V21H29V13H32V23Q32 26 24 26V36ZM19 23H11Q8 23 8 20V12H11V19H19',
        wave: 'M3 16Q8 10 14 16T26 16T38 16M3 25Q8 19 14 25T26 25T38 25',
        lighthouse: 'M13 35L16 13H24L27 35ZM14 13V7H26V13ZM12 7L20 2L28 7M15 23H25',
        sailboat: 'M4 29H36L30 35H10ZM20 4V27H5ZM23 10L34 26H23Z',
      }[kind],
    )
    ctx.fill(path)
    ctx.stroke(path)
    const data = ctx.getImageData(0, 0, 80, 80)
    map.addImage(`decor-${kind}`, data, { pixelRatio: 2 })
  }
  map.addSource('decor', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: (Object.entries(groups) as [Kind, [number, number][]][]).flatMap(([kind, points]) =>
        points.map((coordinates) => ({
          type: 'Feature' as const,
          properties: { kind },
          geometry: { type: 'Point' as const, coordinates },
        })),
      ),
    },
  })
  map.addLayer({
    id: 'decor',
    type: 'symbol',
    source: 'decor',
    layout: {
      'icon-image': ['concat', 'decor-', ['get', 'kind']],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.45, 5, 1, 7, 1.3],
      'icon-allow-overlap': false,
    },
    paint: { 'icon-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.65, 7, 0] },
  })
}
