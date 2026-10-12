// Splits the street-frame lists (content/streetview.json for the whole road, content/streetview-moments.json for story moments) into
// one file per road that the road page fetches on demand, so a visitor never downloads every road's frames to see one road's.
// public/data/streetview/<bywayId>.json holds { road, moments }; every catalog road gets a file, empty when it has no frames, so pages
// never ask for a missing one. Runs at the end of discover.ts, moments.ts and build-catalog.ts; on its own: npx tsx scripts/streetview/split.ts
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises'
import type { StreetView } from '../../src/lib/types.ts'

const ROOT = new URL('../../', import.meta.url)
const OUT = new URL('public/data/streetview/', ROOT)

/** The files split.ts writes, keyed by file name, from the two frame lists and the catalog's road ids. */
export function streetViewFiles(road: StreetView[], moments: StreetView[], roadIds: string[]) {
  const files: Record<string, string> = {}
  for (const id of roadIds)
    files[`${id}.json`] = JSON.stringify({ road: road.filter((v) => v.bywayId === id), moments: moments.filter((v) => v.bywayId === id) })
  return files
}

export async function splitStreetViews() {
  const read = async <T>(path: string) => JSON.parse(await readFile(new URL(path, ROOT), 'utf8')) as T
  const catalog = await read<{ byways: { id: string }[] }>('public/data/catalog.json')
  const files = streetViewFiles(
    await read<StreetView[]>('content/streetview.json'),
    await read<StreetView[]>('content/streetview-moments.json'),
    catalog.byways.map((b) => b.id),
  )
  await mkdir(OUT, { recursive: true })
  for (const old of await readdir(OUT)) if (!(old in files)) await rm(new URL(old, OUT))
  for (const [name, text] of Object.entries(files)) await writeFile(new URL(name, OUT), text)
  return Object.keys(files).length
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(`${await splitStreetViews()} street-frame files written`)
