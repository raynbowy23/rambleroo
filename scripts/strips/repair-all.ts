// Applies repair.ts to every published strip (and each part file) without a full rebuild, then refreshes part manifests.
// Usage: npx tsx scripts/strips/repair-all.ts [--no-connectors] [id ...]
import { readFile, readdir, writeFile, rename } from 'node:fs/promises'
import { repairStrip } from './repair.ts'

const DIR = new URL('../../public/data/strips/', import.meta.url)
const args = process.argv.slice(2)
const connectors = !args.includes('--no-connectors')
const only = args.filter((a) => !a.startsWith('--'))
const files = (await readdir(DIR)).filter(
  (f) => f.endsWith('.json') && f !== 'index.json' && (!only.length || only.some((id) => f.startsWith(id))),
)
const totals = { files: 0, removed: 0, connectors: 0 }
for (const file of files) {
  const data = JSON.parse(await readFile(new URL(file, DIR), 'utf8'))
  if (data.repaired) continue
  const report = await repairStrip(data, { connectors })
  data.repaired = true
  await writeFile(new URL(file + '.tmp', DIR), JSON.stringify(data))
  await rename(new URL(file + '.tmp', DIR), new URL(file, DIR))
  totals.files++
  totals.removed += report.removed
  totals.connectors += report.connectors
  if (report.removed || report.connectors)
    console.log(`${file}: ${report.removed} spike point(s) removed, ${report.connectors} connector(s)`)
}
// Part manifests carry each part's miles; refresh them from the repaired part files.
for (const file of files) {
  const data = JSON.parse(await readFile(new URL(file, DIR), 'utf8'))
  if (!data.parts?.length) continue
  const id = file.replace(/(\.[^.]+)?\.json$/, '').split('.')[0]
  for (const part of data.parts) {
    try {
      const partData = JSON.parse(await readFile(new URL(`${id}.${part.key}.json`, DIR), 'utf8'))
      part.miles = partData.main.miles
    } catch {
      // default part served only at <id>.json
    }
  }
  await writeFile(new URL(file, DIR), JSON.stringify(data))
}
console.log(`repaired ${totals.files} files: ${totals.removed} spike points removed, ${totals.connectors} gap connectors`)
