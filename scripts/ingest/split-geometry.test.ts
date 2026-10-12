import { expect, it } from 'vitest'
import { geometryFiles, simplify } from './split-geometry'

it('drops points within the tolerance and keeps the ends and real bends', () => {
  expect(
    simplify(
      [
        [0, 0],
        [1, 0.001],
        [2, 0],
        [3, 1],
      ],
      0.01,
    ),
  ).toEqual([
    [0, 0],
    [2, 0],
    [3, 1],
  ])
  expect(
    simplify(
      [
        [0, 0],
        [1, 1],
      ],
      0.01,
    ),
  ).toEqual([
    [0, 0],
    [1, 1],
  ])
})

it('writes a rounded overview and one full file per catalog road, empty when it has no lines', () => {
  const road = (id: string, coordinates: number[][][]) => ({
    type: 'Feature' as const,
    properties: { id },
    geometry: { type: 'MultiLineString' as const, coordinates },
  })
  const files = geometryFiles(
    {
      type: 'FeatureCollection',
      features: [
        road('a', [
          [
            [0.12345, 0],
            [1, 0.0001],
            [2, 0],
          ],
        ]),
      ],
    },
    ['a', 'b'],
  )
  expect(JSON.parse(files['byways-overview.geojson']).features[0].geometry.coordinates).toEqual([
    [
      [0.123, 0],
      [2, 0],
    ],
  ])
  expect(JSON.parse(files['geometry/a.json']).features[0].geometry.coordinates[0]).toHaveLength(3)
  expect(JSON.parse(files['geometry/b.json']).features).toEqual([])
})
