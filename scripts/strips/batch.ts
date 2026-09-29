// Overnight coverage runner: discovers towns and builds strip maps for many byways, one child process per road so a failure
// never stops the run. Resumable: roads already in the strip index or in the skip list are not retried.
// Order: states with no strip yet, then All-American Roads, then other national byways, then state byways (longest first).
// A road is kept only with ≥ 2 towns on the main drive and ≥ 1 stretch; otherwise its files are removed and the reason logged.
// Usage: npx tsx scripts/strips/batch.ts [--limit N] [--national-only]
import { readFile, writeFile, appendFile, rm, mkdir, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const ROOT = new URL('../../', import.meta.url)
const path = (rel: string) => new URL(rel, ROOT)
const json = async <T>(rel: string, fallback?: T): Promise<T> =>
  existsSync(path(rel)) ? JSON.parse(await readFile(path(rel), 'utf8')) : (fallback as T)

interface Byway {
  id: string
  name: string
  states: string[]
  mappedMiles: number
  nationalScenicByway: boolean
  allAmericanRoad: boolean
}
const args = process.argv.slice(2)
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity
const nationalOnly = args.includes('--national-only')
const minMiles = args.includes('--min') ? Number(args[args.indexOf('--min') + 1]) : 20
const maxMiles = args.includes('--max') ? Number(args[args.indexOf('--max') + 1]) : 500
// --retry-dropped: give roads dropped for too few places another try with the wider landmark search.
const retryDropped = args.includes('--retry-dropped')

await mkdir(path('data/strips/'), { recursive: true })
const skipped = await json<Record<string, string>>('data/strips/skipped.json', {})
const catalog = (await json<{ byways: Byway[] }>('public/data/catalog.json')).byways
const indexIds = async () => new Set(await json<string[]>('public/data/strips/index.json', []))

// Buildable: a real drive, not a spur or a cross-country route.
if (retryDropped)
  for (const [id, reason] of Object.entries(skipped)) if (/town\(s\) on the main drive|no stretches/.test(reason)) delete skipped[id]
const eligible = catalog.filter((b) => b.mappedMiles >= minMiles && b.mappedMiles <= maxMiles)
const have = await indexIds()
const coveredStates = new Set(catalog.filter((b) => have.has(b.id)).flatMap((b) => b.states))
const national = (b: Byway) => b.nationalScenicByway || b.allAmericanRoad
const rank = (b: Byway) => (national(b) && b.states.some((s) => !coveredStates.has(s)) ? 0 : b.allAmericanRoad ? 1 : national(b) ? 2 : 3)
const queue = eligible
  .filter((b) => !have.has(b.id) && !skipped[b.id] && (!nationalOnly || national(b)))
  .sort((a, b) => rank(a) - rank(b) || b.mappedMiles - a.mappedMiles)
  .slice(0, limit)

const log = async (entry: Record<string, unknown>) =>
  appendFile(path('data/strips/batch-log.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n')
const run = (script: string, id: string, extra: string[] = []) =>
  spawnSync('npx', ['tsx', `scripts/strips/${script}`, id, ...extra], { cwd: ROOT, encoding: 'utf8', timeout: 3 * 60 * 60 * 1000 })

async function drop(id: string, reason: string, createdContent: boolean) {
  skipped[id] = reason
  // Write to a temp file and rename, so an interrupted run (the host once killed it for low memory) can't leave the list empty.
  await writeFile(path('data/strips/skipped.json.tmp'), JSON.stringify(skipped, null, 2) + '\n')
  await rename(path('data/strips/skipped.json.tmp'), path('data/strips/skipped.json'))
  // Only remove content this run generated; never touch hand-written files.
  if (createdContent) await rm(path(`content/strips/${id}.json`), { force: true })
  await rm(path(`public/data/strips/${id}.json`), { force: true })
  const ids = [...(await indexIds())].filter((x) => x !== id).sort()
  await writeFile(path('public/data/strips/index.json'), JSON.stringify(ids))
}

console.log(`${queue.length} roads queued`)
let kept = 0
let dropped = 0
for (const [n, b] of queue.entries()) {
  const started = Date.now()
  const createdContent = !existsSync(path(`content/strips/${b.id}.json`))
  if (createdContent) {
    const d = run('discover-towns.ts', b.id, retryDropped ? ['--wide'] : [])
    if (d.status !== 0) {
      await drop(b.id, `discovery failed: ${(d.stderr || d.stdout).split('\n').find((l) => /Error/.test(l)) ?? 'unknown'}`, createdContent)
      dropped++
      await log({ id: b.id, result: 'dropped', reason: skipped[b.id] })
      continue
    }
  }
  const r = run('build-strip.ts', b.id)
  let reason = ''
  if (r.status !== 0)
    reason = `build failed: ${
      (r.stderr || r.stdout)
        .split('\n')
        .find((l) => /Error/.test(l))
        ?.trim() ?? 'unknown'
    }`
  else {
    const data = await json<{ towns: { on: string }[]; stretches: unknown[] }>(`public/data/strips/${b.id}.json`)
    const mainTowns = data.towns.filter((t) => t.on === 'main').length
    if (mainTowns < 2) reason = `only ${mainTowns} town(s) on the main drive`
    else if (!data.stretches.length) reason = 'no stretches'
  }
  const seconds = Math.round((Date.now() - started) / 1000)
  if (reason) {
    await drop(b.id, reason, createdContent)
    dropped++
    await log({ id: b.id, result: 'dropped', reason, seconds })
    console.log(`[${n + 1}/${queue.length}] drop ${b.name}: ${reason}`)
  } else {
    kept++
    await log({ id: b.id, result: 'kept', seconds })
    console.log(`[${n + 1}/${queue.length}] keep ${b.name} (${seconds}s)`)
  }
}
console.log(`done: ${kept} kept, ${dropped} dropped, ${(await indexIds()).size} roads with strip maps`)
