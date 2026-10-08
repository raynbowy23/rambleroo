// Picks a few Mapillary street-level frames along each byway for the "From the road" strip.
// Only image ids and credit are stored; the Worker fetches the picture itself at request time, since Mapillary image URLs expire.
// A frame qualifies when it is a flat (not 360°) photo taken on the mapped line and looking along the road. The best one per stretch of road wins.
// Usage: npx tsx scripts/streetview/discover.ts [byway-id ...]   (no ids = every byway; existing picks are kept unless --refresh)
// Needs MAPILLARY_TOKEN in the environment or in .dev.vars.
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { StreetView } from '../../src/lib/types'
import { ROOT, search, nearest, samples, turn, sleep, rejectedImage, type Image, type Pt } from './lib'

const OUT = new URL('content/streetview.json', ROOT)
const PER_ROAD = 3
const SAMPLES = 12 // points tried per road, spread evenly
const ON_ROAD_M = 25
const ALONG_DEG = 35

async function pick(id: string, lines: Pt[][]): Promise<StreetView[]> {
  const points = samples(lines, SAMPLES)
  const found: { img: Image; stretch: number; score: number }[] = []
  for (const [i, [lon, lat]] of points.entries()) {
    for (const img of await search(lon, lat)) {
      // Flat, landscape, ordinary-lens frames only: no 360° panoramas, fisheye distortion or phones held upright.
      if (rejectedImage.has(img.id) || img.is_pano || (img.camera_type && img.camera_type !== 'perspective')) continue
      if (!img.width || !img.height || img.width <= img.height) continue
      const at = img.geometry.coordinates
      const { d, heading } = nearest(at, lines)
      const look = img.computed_compass_angle ?? img.compass_angle
      if (d > ON_ROAD_M || look === undefined) continue
      // Looking up or down the road, not out a side window.
      if (Math.min(turn(look, heading), turn(look, heading + 180)) > ALONG_DEG) continue
      const years = (Date.now() - img.captured_at) / 3.156e10
      found.push({
        img,
        stretch: Math.floor((i * PER_ROAD) / points.length),
        score: (img.quality_score ?? 0.5) - Math.min(years, 12) * 0.02,
      })
    }
    await sleep(150)
  }
  const chosen: StreetView[] = []
  // One frame per stretch of road, and never two from the same drive, so the strip shows different days and drivers.
  const used = new Set<string>()
  const drivers = new Set<string>()
  for (let stretch = 0; stretch < PER_ROAD; stretch++) {
    const open = found.filter((f) => f.stretch === stretch && !used.has(f.img.sequence ?? f.img.id)).sort((a, b) => b.score - a.score)
    // A different driver if there is one; the same driver on another day otherwise.
    const best = open.find((f) => !drivers.has(f.img.creator?.username ?? '')) ?? open[0]
    if (!best) continue
    const { img } = best
    used.add(img.sequence ?? img.id)
    drivers.add(img.creator?.username ?? '')
    chosen.push({
      bywayId: id,
      id: img.id,
      at: img.geometry.coordinates.map((n) => +n.toFixed(5)) as Pt,
      captured: new Date(img.captured_at).toISOString().slice(0, 10),
      creator: img.creator?.username ?? 'Mapillary contributor',
    })
  }
  return chosen
}

const args = process.argv.slice(2)
const refresh = args.includes('--refresh')
const wanted = args.filter((a) => !a.startsWith('--'))
const geo = JSON.parse(await readFile(new URL('public/data/byways.geojson', ROOT), 'utf8')) as {
  features: { properties: { id: string }; geometry: { coordinates: Pt[][] } }[]
}
const roads = new Map<string, Pt[][]>()
for (const f of geo.features) roads.set(f.properties.id, [...(roads.get(f.properties.id) ?? []), ...f.geometry.coordinates])
const existing: StreetView[] = existsSync(OUT) ? JSON.parse(await readFile(OUT, 'utf8')) : []
// Roads already searched, including those where nothing qualified, so a stopped run resumes where it left off.
const TRIED = new URL('data/streetview-tried.json', ROOT)
const tried = new Set<string>([
  ...(existsSync(TRIED) ? (JSON.parse(await readFile(TRIED, 'utf8')) as string[]) : []),
  ...existing.map((v) => v.bywayId),
])
const ids = (wanted.length ? wanted : [...roads.keys()]).filter((id) => refresh || !tried.has(id))
let views = existing.filter((v) => !ids.includes(v.bywayId))
const save = () =>
  Promise.all([
    writeFile(
      OUT,
      JSON.stringify(
        views.sort((a, b) => a.bywayId.localeCompare(b.bywayId) || a.id.localeCompare(b.id)),
        null,
        2,
      ) + '\n',
    ),
    writeFile(TRIED, JSON.stringify([...tried].sort()) + '\n'),
  ])
// A few roads at a time; Mapillary allows 10,000 searches a minute and each road makes about a dozen.
const WORKERS = Number(args.find((a) => a.startsWith('--workers='))?.split('=')[1] ?? 4)
let next = 0,
  finished = 0,
  writing = Promise.resolve()
await Promise.all(
  Array.from({ length: WORKERS }, async () => {
    while (next < ids.length) {
      const id = ids[next++]
      const lines = roads.get(id)
      if (!lines) {
        console.warn(`unknown byway ${id}`)
        continue
      }
      const chosen = await pick(id, lines)
      views = [...views.filter((v) => v.bywayId !== id), ...chosen]
      tried.add(id)
      console.log(`${++finished}/${ids.length} ${id}: ${chosen.length}`)
      // Save as we go so a long run can be stopped and resumed.
      writing = writing.then(save)
      await writing
    }
  }),
)
