// Builds every part of a multi-part road (content/strips/<id>.json `parts`), then writes a `parts` list into each part file
// and makes the first part the default strip at public/data/strips/<id>.json, so existing links keep working.
// Usage: npx tsx scripts/strips/build-parts.ts historic-route-66-2489
import { readFile, writeFile, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const ROOT = new URL('../../', import.meta.url)
const id = process.argv[2]
if (!id) throw new Error('usage: build-parts.ts <bywayId>')
const contentUrl = new URL(`content/strips/${id}.json`, ROOT)
const content = JSON.parse(await readFile(contentUrl, 'utf8'))
// --pieces N: split a road broken up within one state into its N longest connected sections; weak sections are dropped.
const pieces = process.argv.includes('--pieces') ? Number(process.argv[process.argv.indexOf('--pieces') + 1]) : 0
if (pieces) content.parts = Array.from({ length: pieces }, (_, i) => ({ key: `p${i + 1}`, piece: i + 1 }))
if (!content.parts?.length) throw new Error(`${id} has no parts`)
const kept: typeof content.parts = []

const manifest: { key: string; label: string; miles: number; places: number }[] = []
for (const part of content.parts) {
  // The builder reads parts from the content file, so write the working list first.
  await writeFile(contentUrl, JSON.stringify(content, null, 2) + '\n')
  const run = spawnSync('npx', ['tsx', 'scripts/strips/build-strip.ts', id, '--part', part.key], { cwd: ROOT, encoding: 'utf8' })
  if (run.status !== 0) {
    if (!pieces) throw new Error(`part ${part.key} failed:\n${run.stderr || run.stdout}`)
    console.log(`skip section ${part.piece}: build failed`)
    continue
  }
  const data = JSON.parse(await readFile(new URL(`public/data/strips/${id}.${part.key}.json`, ROOT), 'utf8'))
  const mainPlaces = data.towns.filter((t: { on: string }) => t.on === 'main').length
  if (pieces && (data.main.miles < 10 || mainPlaces < 2 || !data.stretches.length)) {
    console.log(`skip section ${part.piece}: ${data.main.miles} mi, ${mainPlaces} places`)
    await rm(new URL(`public/data/strips/${id}.${part.key}.json`, ROOT), { force: true })
    continue
  }
  kept.push(part)
  // Piece parts without a label are named for their end towns ("Mankato to Ortonville").
  const main = data.towns.filter((t: { on: string }) => t.on === 'main')
  const label = part.label ?? (main.length >= 2 ? `${main[0].name} to ${main[main.length - 1].name}` : `Section ${part.piece}`)
  if (!part.label) {
    data.title = `${data.title} · ${label}`
    data.part = { key: part.key, label }
    await writeFile(new URL(`public/data/strips/${id}.${part.key}.json`, ROOT), JSON.stringify(data))
  }
  manifest.push({ key: part.key, label, miles: data.main.miles, places: data.towns.length })
  console.log(`${label}: ${data.main.miles} mi, ${data.towns.map((t: { name: string }) => t.name).join(', ')}`)
}
// Piece sections run in travel order: west→east for mostly east–west roads, north→south otherwise.
if (pieces) {
  const centres = new Map<string, [number, number]>()
  for (const part of kept) {
    const data = JSON.parse(await readFile(new URL(`public/data/strips/${id}.${part.key}.json`, ROOT), 'utf8'))
    const pts: [number, number][] = data.main.path
    centres.set(part.key, [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length])
  }
  const xs = [...centres.values()].map((c) => c[0])
  const ys = [...centres.values()].map((c) => c[1])
  const eastWest = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys)
  const rank = (key: string) => (eastWest ? centres.get(key)![0] : -centres.get(key)![1])
  kept.sort((a: { key: string }, b: { key: string }) => rank(a.key) - rank(b.key))
  manifest.sort((a, b) => rank(a.key) - rank(b.key))
}
content.parts = kept
await writeFile(contentUrl, JSON.stringify(content, null, 2) + '\n')
if (manifest.length < 2) {
  // Nothing to split: rebuild the road as a single strip.
  delete content.parts
  await writeFile(contentUrl, JSON.stringify(content, null, 2) + '\n')
  for (const entry of manifest) await rm(new URL(`public/data/strips/${id}.${entry.key}.json`, ROOT), { force: true })
  spawnSync('npx', ['tsx', 'scripts/strips/build-strip.ts', id], { cwd: ROOT, encoding: 'utf8' })
  console.log(`${id}: fewer than two usable sections; kept as one strip`)
  process.exit(0)
}
// The default part (first, unless one is marked default) also serves the plain strip URL.
const defaultKey = (kept.find((p: { default?: boolean }) => p.default) ?? kept[0]).key
for (const entry of manifest) {
  const file = new URL(`public/data/strips/${id}.${entry.key}.json`, ROOT)
  const data = JSON.parse(await readFile(file, 'utf8'))
  data.parts = manifest
  await writeFile(file, JSON.stringify(data))
  if (entry.key === defaultKey) await writeFile(new URL(`public/data/strips/${id}.json`, ROOT), JSON.stringify(data))
}
