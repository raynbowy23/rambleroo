// Uploads the photo library to the public R2 bucket behind photos.rambleroo.app (infra/README.md). Every image and thumbnail named in
// content/photos.json is looked up on the photo domain and, when missing, uploaded from the local public/photos/ copy that the photo
// scripts download into (public/photos/ is gitignored). Already uploaded files are skipped, so it is safe to rerun after any photo
// script. Uses the logged-in Wrangler; nothing else needs a key.
// Usage: npm run photos:upload [-- --check]   (--check only reports what is missing)
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import type { Photo } from '../../src/lib/types.ts'

const ROOT = new URL('../../', import.meta.url)
const ORIGIN = 'https://photos.rambleroo.app'
const BUCKET = 'rambleroo-library'
const AT_ONCE = 8
const check = process.argv.includes('--check')

const photos = JSON.parse(await readFile(new URL('content/photos.json', ROOT), 'utf8')) as Photo[]
const paths = [...new Set(photos.flatMap((p) => [p.file, p.thumb].filter((f): f is string => Boolean(f))))]
for (const path of paths) if (!path.startsWith('/photos/')) throw new Error(`unexpected photo path ${path}`)

const present = async (path: string) => {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(ORIGIN + path.slice('/photos'.length), { method: 'HEAD' }).catch(() => null)
    if (res && (res.ok || res.status === 404)) return res.ok
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)))
  }
  throw new Error(`cannot reach ${ORIGIN}`)
}
const put = (path: string) =>
  new Promise<void>((resolve, reject) => {
    const key = path.slice('/photos/'.length)
    const child = spawn(
      'npx',
      [
        'wrangler',
        'r2',
        'object',
        'put',
        `${BUCKET}/${key}`,
        '--remote',
        '--file',
        new URL(`public${path}`, ROOT).pathname,
        '--content-type',
        'image/jpeg',
        '--cache-control',
        'public, max-age=604800',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    )
    let err = ''
    child.stderr.on('data', (d) => (err += d))
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${key}: ${err.split('\n').filter((l) => /error/i.test(l))[0] ?? code}`)),
    )
  })

let next = 0,
  uploaded = 0,
  missingLocal = 0,
  missing = 0
const failures: string[] = []
async function worker() {
  while (next < paths.length) {
    const path = paths[next++]
    if (await present(path)) continue
    missing++
    if (check) continue
    if (!existsSync(new URL(`public${path}`, ROOT))) {
      missingLocal++
      failures.push(`${path}: not on the photo domain and no local copy`)
      continue
    }
    try {
      await put(path)
      uploaded++
      if (uploaded % 200 === 0) console.log(`  ${uploaded} uploaded`)
    } catch (error) {
      failures.push((error as Error).message)
    }
  }
}
await Promise.all(Array.from({ length: AT_ONCE }, worker))
console.log(
  check
    ? `${paths.length} files in content/photos.json, ${missing} not on ${ORIGIN}`
    : `${paths.length} files in content/photos.json; uploaded ${uploaded}, ${missingLocal} missing locally, ${failures.length - missingLocal} failed`,
)
for (const f of failures.slice(0, 20)) console.log(`  ${f}`)
if (failures.length || (check && missing)) process.exitCode = 1
