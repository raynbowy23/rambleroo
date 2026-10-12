// Splits the road lines (public/data/byways.geojson) into what the app needs at each scale, so the first map never waits on full detail:
// public/data/byways-overview.geojson holds every road simplified for the country and regional view (the explore map swaps to full detail
// once zoomed in to OVERVIEW_MAX_ZOOM in src/features/map/layers.ts), and public/data/geometry/<bywayId>.json holds one road's full lines for its selection, page,
// postcard and 3D view. Every catalog road gets a file, empty when it has no lines, so pages never ask for a missing one.
// Runs at the end of build-catalog.ts; on its own: npx tsx scripts/ingest/split-geometry.ts
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises'
import type { Feature, FeatureCollection, MultiLineString } from 'geojson'

const ROOT = new URL('../../', import.meta.url)
const OUT = new URL('public/data/geometry/', ROOT)

/** Degrees a simplified line may stray from the real one: about a pixel at zoom 7 (OVERVIEW_MAX_ZOOM), so below it the lines look the same. */
export const OVERVIEW_TOLERANCE = 0.01

type Line = number[][]
/** Douglas–Peucker: keep the ends, then any point further than `tolerance` from the line between the points kept around it. */
export function simplify(line: Line, tolerance: number): Line {
  if (line.length < 3) return line
  const keep = new Uint8Array(line.length)
  keep[0] = keep[line.length - 1] = 1
  const stack: [number, number][] = [[0, line.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    const [ax, ay] = line[a],
      [bx, by] = line[b]
    const dx = bx - ax,
      dy = by - ay,
      length = dx * dx + dy * dy
    let far = -1,
      farthest = tolerance
    for (let i = a + 1; i < b; i++) {
      const [px, py] = line[i]
      const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)) : 0
      const distance = Math.hypot(px - ax - t * dx, py - ay - t * dy)
      if (distance > farthest) [far, farthest] = [i, distance]
    }
    if (far > 0) {
      keep[far] = 1
      stack.push([a, far], [far, b])
    }
  }
  return line.filter((_, i) => keep[i])
}

const round = (n: number) => Math.round(n * 1000) / 1000

/** The files split-geometry.ts writes, keyed by path under public/data/, from the full lines and the catalog's road ids. */
export function geometryFiles(full: FeatureCollection<MultiLineString>, roadIds: string[]) {
  const overview = {
    ...full,
    features: full.features.map((f): Feature<MultiLineString> => ({
      ...f,
      geometry: {
        ...f.geometry,
        coordinates: f.geometry.coordinates.map((line) => simplify(line, OVERVIEW_TOLERANCE).map(([x, y]) => [round(x), round(y)])),
      },
    })),
  }
  const files: Record<string, string> = { 'byways-overview.geojson': JSON.stringify(overview) }
  for (const id of roadIds)
    files[`geometry/${id}.json`] = JSON.stringify({
      type: 'FeatureCollection',
      features: full.features.filter((f) => f.properties?.id === id),
    })
  return files
}

export async function splitGeometry() {
  const read = async <T>(path: string) => JSON.parse(await readFile(new URL(path, ROOT), 'utf8')) as T
  const catalog = await read<{ byways: { id: string }[] }>('public/data/catalog.json')
  const files = geometryFiles(
    await read<FeatureCollection<MultiLineString>>('public/data/byways.geojson'),
    catalog.byways.map((b) => b.id),
  )
  await mkdir(OUT, { recursive: true })
  for (const old of await readdir(OUT)) if (!(`geometry/${old}` in files)) await rm(new URL(old, OUT))
  for (const [name, text] of Object.entries(files)) await writeFile(new URL(`public/data/${name}`, ROOT), text)
  return Object.keys(files).length
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(`${await splitGeometry()} geometry files written`)
