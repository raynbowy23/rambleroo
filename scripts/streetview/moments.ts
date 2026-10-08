// Picks a Mapillary frame for story moments that have no photograph, so the card shows the real road there instead of an illustration.
// Only "roadside" and "town" moments qualify: for a short walk or a separate excursion, a frame from the road would not show the place.
// Roadside picks are checked by eye; moments whose frame does not show the place go in rejects.json and are skipped after that.
// A frame must be on the mapped line within MAX_M of the moment's anchor; frames facing the anchor score higher.
// Usage: npx tsx scripts/streetview/moments.ts [byway-id ...]   Writes content/streetview-moments.json.
import { readFile, readdir, writeFile } from 'node:fs/promises'
import type { BywayStory, Photo, StreetView } from '../../src/lib/types'
import { ROOT, search, nearest, metres, bearing, turn, sleep, rejects, rejectedImage, type Pt } from './lib'

const OUT = new URL('content/streetview-moments.json', ROOT)
const MAX_M = 500
const ON_ROAD_M = 25

const geo = JSON.parse(await readFile(new URL('public/data/byways.geojson', ROOT), 'utf8')) as {
  features: { properties: { id: string }; geometry: { coordinates: Pt[][] } }[]
}
const roads = new Map<string, Pt[][]>()
for (const f of geo.features) roads.set(f.properties.id, [...(roads.get(f.properties.id) ?? []), ...f.geometry.coordinates])
const photos = JSON.parse(await readFile(new URL('content/photos.json', ROOT), 'utf8')) as Photo[]
const photographed = new Set(photos.filter((p) => p.moment).map((p) => `${p.bywayId}|${p.moment}`))
const refused = new Set(rejects.moments.map((r) => `${r.bywayId}|${r.moment}`))

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const files = (await readdir(new URL('content/stories/', ROOT))).filter((f) => f.endsWith('.json'))
const views: StreetView[] = []
let tried = 0
for (const file of files) {
  const story = JSON.parse(await readFile(new URL(`content/stories/${file}`, ROOT), 'utf8')) as BywayStory
  if (wanted.length && !wanted.includes(story.id)) continue
  const lines = roads.get(story.id)
  if (!lines) continue
  const taken = new Set<string>()
  for (const m of story.moments) {
    if (
      !m.at ||
      (m.kind !== 'roadside' && m.kind !== 'town') ||
      photographed.has(`${story.id}|${m.title}`) ||
      refused.has(`${story.id}|${m.title}`)
    )
      continue
    tried++
    let best: { view: StreetView; score: number } | undefined
    for (const img of await search(m.at[0], m.at[1], 0.005)) {
      if (rejectedImage.has(img.id) || taken.has(img.id)) continue
      if (img.is_pano || (img.camera_type && img.camera_type !== 'perspective')) continue
      if (!img.width || !img.height || img.width <= img.height) continue
      const at = img.geometry.coordinates
      const away = metres(at, m.at as Pt)
      const look = img.computed_compass_angle ?? img.compass_angle
      if (away > MAX_M || look === undefined || nearest(at, lines).d > ON_ROAD_M) continue
      // Facing the place matters for a roadside sight; in a town any view along the street will do.
      const facing = turn(look, bearing(at, m.at as Pt))
      if (m.kind === 'roadside' && away > 60 && facing > 50) continue
      const years = (Date.now() - img.captured_at) / 3.156e10
      const score = (img.quality_score ?? 0.5) - away / 2000 - Math.min(years, 12) * 0.02 - (away > 60 ? facing / 900 : 0)
      if (!best || score > best.score)
        best = {
          score,
          view: {
            bywayId: story.id,
            moment: m.title,
            id: img.id,
            at: at.map((n) => +n.toFixed(5)) as Pt,
            captured: new Date(img.captured_at).toISOString().slice(0, 10),
            creator: img.creator?.username ?? 'Mapillary contributor',
          },
        }
    }
    if (best) {
      views.push(best.view)
      taken.add(best.view.id)
    }
    console.log(`${story.id} · ${m.title}: ${best ? best.view.id : '-'}`)
    await sleep(150)
  }
}
await writeFile(OUT, JSON.stringify(views, null, 2) + '\n')
console.log(`${views.length} of ${tried} moments have a frame`)
