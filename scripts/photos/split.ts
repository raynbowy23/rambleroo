// Splits the photo registry (content/photos.json, the file the photo scripts edit) into what the app fetches on demand, so the list of
// photos is never part of the main script: public/data/photos/covers.json holds each road's cover photo (its first photo that is not
// a town photo) for cards and list pages, and public/data/photos/<bywayId>.json holds all of one road's photos, town photos included,
// for its page, postcards and strip map. Every catalog road gets a file, empty when it has no photos, so pages never ask for a missing one.
// Runs at the end of build-catalog.ts and fetch.ts; on its own: npx tsx scripts/photos/split.ts
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises'
import type { Photo } from '../../src/lib/types.ts'

const ROOT = new URL('../../', import.meta.url)
const OUT = new URL('public/data/photos/', ROOT)

/** The files split.ts writes, keyed by file name, from the registry and the catalog's road ids. */
export function photoFiles(photos: Photo[], roadIds: string[]) {
  const files: Record<string, string> = {}
  const covers: Record<string, Photo> = {}
  for (const photo of photos) if (!photo.town && !covers[photo.bywayId]) covers[photo.bywayId] = photo
  files['covers.json'] = JSON.stringify(covers)
  for (const id of roadIds) files[`${id}.json`] = JSON.stringify(photos.filter((photo) => photo.bywayId === id))
  return files
}

export async function splitPhotos() {
  const photos = JSON.parse(await readFile(new URL('content/photos.json', ROOT), 'utf8')) as Photo[]
  const catalog = JSON.parse(await readFile(new URL('public/data/catalog.json', ROOT), 'utf8')) as { byways: { id: string }[] }
  const files = photoFiles(
    photos,
    catalog.byways.map((b) => b.id),
  )
  await mkdir(OUT, { recursive: true })
  for (const old of await readdir(OUT)) if (!(old in files)) await rm(new URL(old, OUT))
  for (const [name, text] of Object.entries(files)) await writeFile(new URL(name, OUT), text)
  return Object.keys(files).length
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(`${await splitPhotos()} photo files written`)
