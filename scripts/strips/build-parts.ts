// Builds every part of a multi-part road (content/strips/<id>.json `parts`), then writes a `parts` list into each part file
// and makes the first part the default strip at public/data/strips/<id>.json, so existing links keep working.
// Usage: npx tsx scripts/strips/build-parts.ts historic-route-66-2489
import { readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const ROOT = new URL('../../', import.meta.url)
const id = process.argv[2]
if (!id) throw new Error('usage: build-parts.ts <bywayId>')
const content = JSON.parse(await readFile(new URL(`content/strips/${id}.json`, ROOT), 'utf8'))
if (!content.parts?.length) throw new Error(`${id} has no parts`)

const manifest: { key: string; label: string; miles: number; places: number }[] = []
for (const part of content.parts) {
  const run = spawnSync('npx', ['tsx', 'scripts/strips/build-strip.ts', id, '--part', part.key], { cwd: ROOT, encoding: 'utf8' })
  if (run.status !== 0) throw new Error(`part ${part.key} failed:\n${run.stderr || run.stdout}`)
  const data = JSON.parse(await readFile(new URL(`public/data/strips/${id}.${part.key}.json`, ROOT), 'utf8'))
  manifest.push({ key: part.key, label: part.label, miles: data.main.miles, places: data.towns.length })
  console.log(`${part.label}: ${data.main.miles} mi, ${data.towns.map((t: { name: string }) => t.name).join(', ')}`)
}
for (const [i, entry] of manifest.entries()) {
  const file = new URL(`public/data/strips/${id}.${entry.key}.json`, ROOT)
  const data = JSON.parse(await readFile(file, 'utf8'))
  data.parts = manifest
  await writeFile(file, JSON.stringify(data))
  if (i === 0) await writeFile(new URL(`public/data/strips/${id}.json`, ROOT), JSON.stringify(data))
}
