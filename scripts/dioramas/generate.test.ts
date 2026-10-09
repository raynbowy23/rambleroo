// @vitest-environment node
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import Ajv from 'ajv'
import type { BywayStory, BywaySummary } from '../../src/lib/types'
import type { DioramaSpec } from '../../src/components/art/diorama3d/spec'
import { buildScene, triangleCount } from '../../src/components/art/diorama3d/scene'
import { defaultGarage } from '../../src/lib/garage'
import { supportedModels, motifModels } from './rules'
import { generateSpec, generate, connectedPaths } from './generate'
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'))
const catalog = read('public/data/catalog.json').byways as BywaySummary[]
const stories = new Map(
  readdirSync('content/stories')
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f.slice(0, -5), read(`content/stories/${f}`) as BywayStory]),
)
const validate = new Ajv().compile(read('content/dioramas/schema.json'))
const generic = new Set([
  'conifer',
  'hardwood',
  'cypress',
  'field',
  'town-blocks',
  'mesa',
  'sandbar',
  'river',
  'surf',
  'fog-bank',
  'snowfield',
  'alpine-lake',
  'sea-stack',
])
describe('catalog miniatures', () => {
  for (const road of catalog)
    it(road.id, () => {
      const spec = read(`public/data/dioramas/${road.id}.json`) as DioramaSpec
      expect(validate(spec), JSON.stringify(validate.errors)).toBe(true)
      const story = stories.get(road.id),
        allowed = supportedModels(story)
      for (const landmark of spec.landmarks) {
        // The three preserved authored scenes predate title-only rules. Their specific
        // houses / outlooks / town fronts are explicitly described in the story prose.
        const prose = story?.moments.map((m) => m.title + ' ' + m.text).join(' ') ?? ''
        const authoredEvidence =
          spec.authored &&
          ((landmark.model === 'farmhouse' && prose.includes(landmark.name)) ||
            (landmark.model === 'overlook-pullout' && /outlook|vista point|overlook/i.test(prose)) ||
            (landmark.model === 'false-front-town' && prose.includes(landmark.name)))
        expect(allowed.has(landmark.model) || authoredEvidence, `${road.id}: unsupported ${landmark.model}`).toBe(true)
        if (!spec.authored) expect(story?.moments.some((m) => m.title === landmark.name)).toBe(true)
      }
      for (const d of spec.dressing) expect(generic.has(d.model) || allowed.has(d.model), `unsupported dressing ${d.model}`).toBe(true)
      if (!story) expect(spec.landmarks).toEqual([])
      const built = buildScene(spec, defaultGarage, { hour: 21, season: 'summer', weather: 'clear' })
      expect(triangleCount(built.scene) - triangleCount(built.driver)).toBeLessThanOrEqual(2000)
      expect(built.townAnchors.map((t) => t.name)).toEqual(spec.towns.map((t) => t.name))
      for (const p of built.route.points) expect(p.toArray().every(Number.isFinite)).toBe(true)
      built.dispose()
    })
})
it('only requests specific landmarks with editorial evidence', () => {
  const road = catalog[0],
    path = [
      [0, 0],
      [1, 1],
    ]
  const plain = generateSpec(road, [path])
  expect(plain.landmarks).toEqual([])
  const story: BywayStory = {
    id: road.id,
    tagline: '',
    intro: [],
    sources: [],
    reviewed: false,
    moments: [{ title: 'A lighthouse in a road name is insufficient', kind: 'roadside', scene: 'coast', text: '' }],
  }
  expect(generateSpec(road, [path], story).landmarks).toEqual([])
  story.moments[0].motifs = ['lighthouse']
  expect(generateSpec(road, [path], story).landmarks[0].model).toBe('lighthouse-on-rock')
  expect(Object.keys(motifModels)).toHaveLength(23)
})

it('preserves authored bytes and joins only connected geometry', () => {
  const root = mkdtempSync('/tmp/rambleroo-dioramas-')
  try {
    mkdirSync(`${root}/public/data/dioramas`, { recursive: true })
    mkdirSync(`${root}/content/dioramas`, { recursive: true })
    const id = 'beartooth-highway-2281'
    const original = readFileSync(`public/data/dioramas/${id}.json`, 'utf8')
    writeFileSync(`${root}/public/data/dioramas/${id}.json`, original)
    writeFileSync(`${root}/public/data/catalog.json`, JSON.stringify({ byways: catalog.filter((r) => r.id === id) }))
    writeFileSync(`${root}/public/data/byways.geojson`, JSON.stringify({ features: [] }))
    writeFileSync(`${root}/content/dioramas/schema.json`, readFileSync('content/dioramas/schema.json'))
    generate(root)
    expect(readFileSync(`${root}/public/data/dioramas/${id}.json`, 'utf8')).toBe(original)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
  expect(
    connectedPaths([
      [
        [0, 0],
        [1, 1],
      ],
      [
        [2, 2],
        [1, 1],
      ],
      [
        [10, 10],
        [11, 11],
      ],
    ]),
  ).toEqual([
    [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    [
      [10, 10],
      [11, 11],
    ],
  ])
})
