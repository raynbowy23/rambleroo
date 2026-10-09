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

it('gives Mount Greylock mountain ground and lets editorial evidence override catalog inference', () => {
  const road = catalog.find((r) => r.id === 'mount-greylock-scenic-byway-2569')!
  const path = [
    [
      [0, 0],
      [1, 1],
    ],
  ]
  expect(generateSpec(road, path).ground).toBe('alpine-plateau')
  expect(read(`public/data/dioramas/${road.id}.json`).ground).toBe('alpine-plateau')
  const story: BywayStory = {
    id: road.id,
    tagline: '',
    intro: [],
    sources: [],
    reviewed: false,
    moments: [
      { title: 'Town', kind: 'roadside', scene: 'town', text: '' },
      { title: 'Peak', kind: 'roadside', scene: 'mountain', text: '' },
    ],
  }
  const inferred = { ...road, scene: 'prairie' as const }
  expect(generateSpec(inferred, path, story).ground).toBe('alpine-plateau')
  story.moments.push(
    { title: 'Forest', kind: 'roadside', scene: 'forest', text: '' },
    { title: 'Woods', kind: 'roadside', scene: 'forest', text: '' },
  )
  expect(generateSpec(inferred, path, story).ground).toBe('forested-ridges')
  story.motifs = ['rolling-ridges']
  expect(generateSpec(inferred, path, story).ground).toBe('alpine-plateau')
  story.motifs = ['lake-wide']
  expect(generateSpec(inferred, path, story).ground).toBe('river-valley')
})

it('keeps Outer Banks lighthouses small and separated in daylight and at night', () => {
  const spec = read('public/data/dioramas/outer-banks-scenic-byway-12834.json') as DioramaSpec
  for (const hour of [12, 21]) {
    const built = buildScene(spec, defaultGarage, { hour, season: 'summer', weather: 'clear' })
    const towers = built.landmarkGroups.filter((_, i) => spec.landmarks[i].model === 'lighthouse-on-rock')
    expect(towers).toHaveLength(2)
    expect(Math.hypot(towers[0].position.x - towers[1].position.x, towers[0].position.z - towers[1].position.z)).toBeGreaterThanOrEqual(1.8)
    // The prototype is 1.445 units tall, including its rocky base.
    for (const tower of towers) expect(tower.scale.y * 1.445).toBeLessThanOrEqual(8 / 3 + 0.00001)
    built.dispose()
  }
})

it('keeps the road surface and visitor above the terrain on the reviewed miniatures', () => {
  const ids = [
    'route-1-big-sur-coast-highway-2301',
    'talimena-scenic-drive-2485',
    'kenton-to-keys-state-scenic-byway-994001',
    'mount-greylock-scenic-byway-2569',
    'outer-banks-scenic-byway-12834',
  ]
  for (const id of ids) {
    const built = buildScene(read(`public/data/dioramas/${id}.json`), defaultGarage, { hour: 12, season: 'summer', weather: 'clear' })
    for (let i = 0; i <= 1000; i++) {
      const p = built.route.sample(i / 1000)
      expect(p.y + 0.045, id).toBeGreaterThan(built.route.height(p.x, p.z))
    }
    built.dispose()
  }
})
