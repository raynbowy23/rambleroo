import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import Ajv from 'ajv'
import type { BywaySummary, BywayStory, SceneFamily } from '../../src/lib/types'
import type { DioramaSpec, Model } from '../../src/components/art/diorama3d/spec'
import { motifModels, momentModels } from './rules'

type Point = number[]
interface Strip {
  main: { path: Point[]; miles: number }
  towns: { name: string; mile: number; at: Point; on: string }[]
}
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'))
const distance = (a: Point, b: Point) => Math.hypot((a[0] - b[0]) * Math.cos((a[1] * Math.PI) / 180), a[1] - b[1])
function lengths(path: Point[]) {
  const result = [0]
  for (let i = 1; i < path.length; i++) result.push(result[i - 1] + distance(path[i - 1], path[i]))
  return result
}
export function fraction(path: Point[], point: Point) {
  const ds = lengths(path)
  let best = Infinity,
    at = 0
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      cos = Math.cos((a[1] * Math.PI) / 180)
    const dx = (b[0] - a[0]) * cos,
      dy = b[1] - a[1]
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * cos * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
    const d = distance(point, [a[0] + t * (b[0] - a[0]), a[1] + t * dy])
    if (d < best) {
      best = d
      at = (ds[i - 1] + t * (ds[i] - ds[i - 1])) / (ds.at(-1) || 1)
    }
  }
  return at
}
/** Retain the largest bends first, including both endpoints; no invented switchbacks. */
export function simplify(path: Point[], limit = 56) {
  const kept = new Set([0, path.length - 1])
  while (kept.size < Math.min(limit, path.length)) {
    const indices = [...kept].sort((a, b) => a - b)
    let best = -1,
      error = -1
    for (let k = 1; k < indices.length; k++) {
      const start = indices[k - 1],
        end = indices[k],
        a = path[start],
        b = path[end]
      const dx = b[0] - a[0],
        dy = b[1] - a[1]
      for (let i = start + 1; i < end; i++) {
        const p = path[i],
          t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
        const d = Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
        if (d > error) {
          error = d
          best = i
        }
      }
    }
    if (best < 0) break
    kept.add(best)
  }
  return [...kept].sort((a, b) => a - b).map((i) => path[i].slice(0, 2))
}
/** Join only matching endpoints, never span an unmapped gap. */
export function connectedPaths(paths: Point[][]) {
  const pool = paths.map((path) => path.slice()),
    chains: Point[][] = []
  while (pool.length) {
    let chain = pool.shift()!
    let changed = true
    while (changed) {
      changed = false
      for (let i = 0; i < pool.length; i++) {
        const path = pool[i],
          start = chain[0],
          end = chain.at(-1)!
        if (distance(end, path[0]) < 0.00001) chain = chain.concat(path.slice(1))
        else if (distance(end, path.at(-1)!) < 0.00001) chain = chain.concat([...path].reverse().slice(1))
        else if (distance(start, path.at(-1)!) < 0.00001) chain = path.slice(0, -1).concat(chain)
        else if (distance(start, path[0]) < 0.00001) chain = [...path].reverse().slice(0, -1).concat(chain)
        else continue
        pool.splice(i, 1)
        changed = true
        break
      }
    }
    chains.push(chain)
  }
  return chains
}
export function generateSpec(road: BywaySummary, paths: Point[][], story?: BywayStory, strip?: Strip): DioramaSpec {
  // A strip supplies an ordered main route. Otherwise use the longest mapped component,
  // avoiding fictitious road connections between disconnected catalog branches.
  let path = (strip?.main.path ?? connectedPaths(paths).sort((a, b) => (lengths(b).at(-1) ?? 0) - (lengths(a).at(-1) ?? 0))[0]).filter(
    (p, i, a) => i === 0 || distance(p, a[i - 1]) > 0,
  )
  if (path.length < 2) throw new Error(`Missing route: ${road.id}`)
  const anchored = story?.moments.filter((m) => m.at) ?? []
  let reversed = false
  if (anchored.length > 1 && fraction(path, anchored[0].at!) > fraction(path, anchored.at(-1)!.at!)) {
    path = [...path].reverse()
    reversed = true
  }
  const scene: SceneFamily = story?.moments[0]?.scene ?? road.scene
  const cliff = ['california', 'pacific-northwest', 'alaska', 'hawaii'].includes(road.region)
  const ground: DioramaSpec['ground'] = {
    coast: cliff ? 'coastal-cliff' : 'low-shore',
    mountain: 'alpine-plateau',
    forest: 'forested-ridges',
    river: 'river-valley',
    desert: 'desert-mesas',
    prairie: 'prairie-grid',
    town: 'main-street',
  }[scene] as DioramaSpec['ground']
  const motifs = new Set([...(story?.motifs ?? []), ...(story?.moments.flatMap((m) => m.motifs ?? []) ?? [])])
  const elevation = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8,
      hill = Math.sin(t * Math.PI) ** 2
    return [
      t,
      Number(
        (scene === 'mountain'
          ? 0.45 + hill * 1.65
          : scene === 'forest'
            ? 0.35 + hill * 0.7
            : scene === 'coast' && cliff
              ? 0.85 + hill * 0.3
              : 0.2 + hill * 0.12
        ).toFixed(3),
      ),
    ]
  })
  const landmarks: DioramaSpec['landmarks'] = []
  let previous = 0
  for (const [i, moment] of (story?.moments ?? []).entries()) {
    const at = Math.max(previous, moment.at ? fraction(path, moment.at) : (i + 1) / ((story?.moments.length ?? 0) + 1))
    previous = at
    for (const model of momentModels(moment))
      landmarks.push({
        name: moment.title,
        model,
        at,
        offset: 'roadside',
        notes: `Story moment ${i + 1}; ${moment.kind}. ${moment.at ? 'Projected coordinate, kept in driving order.' : 'Illustrative position in driving order.'}`,
      })
  }
  const dressing: DioramaSpec['dressing'] = []
  const add = (model: Model, at: number, side = 1, distance = 1.2, scale = 1) => dressing.push({ model, at, side, distance, scale })
  // Story-wide motifs have no named location: draw as unlabelled editorial scenery.
  for (const motif of story?.motifs ?? [])
    if (!landmarks.some((l) => l.model === motifModels[motif])) add(motifModels[motif], 0.5, -1, 1.4, 1.5)
  for (let i = 0; i < 12; i++) {
    const at = (i + 0.5) / 12,
      side = i % 2 ? 1 : -1
    if (scene === 'forest' || scene === 'mountain' || road.themes.includes('forest'))
      add(['rockies', 'alaska', 'pacific-northwest'].includes(road.region) ? 'conifer' : 'hardwood', at, side, 0.8 + (i % 3) * 0.4, 1.2)
    else if (scene === 'prairie') {
      add('field', at, side, 1.3, 1.3)
      if (i % 3 === 0) add('hardwood', at, side, 1.9, 0.8)
    } else if (scene === 'town' && i % 2 === 0) add('town-blocks', at, side, 0.85, 0.8)
    else if (scene === 'desert' && i % 4 === 0) add('mesa', at, side, 1.6, 1.3)
    else if (scene === 'coast' && i % 3 === 0) add('sandbar', at, 1, 1.5, 1.4)
  }
  if (scene === 'river') add('river', 0.5, 1, 0.8)
  if (scene === 'desert') add('sandbar', 0.5, -1, 0.7, 1.8)
  const towns = (strip?.towns ?? [])
    .map((t) => ({
      name: t.name,
      at:
        t.on === 'main' && strip!.main.miles > 0
          ? Math.max(0, Math.min(1, reversed ? 1 - t.mile / strip!.main.miles : t.mile / strip!.main.miles))
          : fraction(path, t.at),
      landmark: landmarks.find((l) => l.name === t.name && ['town-blocks', 'false-front-town'].includes(l.model))?.name ?? '',
    }))
    .sort((a, b) => a.at - b.at)
  return {
    authored: false,
    bywayId: road.id,
    title: road.name,
    longitude: road.center[0],
    ground,
    palette: scene,
    snowInWinter: ['rockies', 'alaska', 'new-england', 'upper-midwest', 'great-lakes'].includes(road.region),
    road: {
      shape: 'from-geometry',
      profile: motifs.has('switchbacks')
        ? 'switchbacks'
        : scene === 'coast' && cliff
          ? 'cliff-shelf'
          : scene === 'river'
            ? 'valley-floor'
            : ['town', 'prairie'].includes(scene)
              ? 'level'
              : 'rolling',
      lanes: 2,
      coordinates: simplify(path),
      elevation,
    },
    landmarks,
    dressing,
    towns,
    sources: [
      ...(story ? [`content/stories/${road.id}.json`] : []),
      ...(strip ? [`public/data/strips/${road.id}.json`] : []),
      'public/data/byways.geojson',
      'public/data/catalog.json',
    ],
    geometryNotes: `${strip ? 'Strip main route' : 'Longest connected mapped chain; disconnected branches omitted'}, simplified to 56 bends. ${reversed ? 'Reversed to story order. ' : ''}Elevation is a smooth illustrative scene profile, not surveyed heights. Terrain, vegetation and water are schematic; only editorial evidence authorizes landmarks.`,
  }
}
export function generate(root = resolve('.')) {
  const catalog = read(`${root}/public/data/catalog.json`).byways as BywaySummary[]
  const features = read(`${root}/public/data/byways.geojson`).features as {
    properties: { id: string }
    geometry: { type: string; coordinates: Point[] | Point[][] }
  }[]
  const validate = new Ajv().compile(read(`${root}/content/dioramas/schema.json`))
  const directory = `${root}/public/data/dioramas`
  mkdirSync(directory, { recursive: true })
  let named = 0,
    authored = 0
  for (const road of catalog) {
    const file = `${directory}/${road.id}.json`,
      existing = existsSync(file) ? read(file) : null
    let spec: DioramaSpec
    if (existing?.authored === true) {
      spec = existing
      authored++
    } else {
      const f = features.find((f) => f.properties.id === road.id)!
      const storyPath = `${root}/content/stories/${road.id}.json`,
        stripPath = `${root}/public/data/strips/${road.id}.json`
      spec = generateSpec(
        road,
        f.geometry.type === 'LineString' ? [f.geometry.coordinates as Point[]] : (f.geometry.coordinates as Point[][]),
        existsSync(storyPath) ? read(storyPath) : undefined,
        existsSync(stripPath) ? read(stripPath) : undefined,
      )
    }
    if (!validate(spec)) throw new Error(`${road.id}: ${JSON.stringify(validate.errors)}`)
    if (spec.landmarks.length) named++
    if (!spec.authored) writeFileSync(file, JSON.stringify(spec, null, 2) + '\n')
  }
  console.log(
    `${catalog.length} specs: ${authored} authored, ${named} with named landmarks, ${catalog.length - named} terrain/towns without named landmarks.`,
  )
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) generate()
