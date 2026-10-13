// Makes the middle-size (960px wide) WebP copy of every library photo wider than that, for page heroes and for photo cards and
// postcards on phones, which would otherwise pick the 1600px original over the 480px thumbnail. The full image is read from the local public/photos/ copy, or fetched from the
// photo domain when there is none, resized with ImageMagick, written next to it as <name>-960.webp and recorded as `medium` in
// content/photos.json. Then run `npm run photos:upload` to put the new files on the photo domain.
// Usage: npx tsx scripts/photos/medium.ts
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { spawn } from 'node:child_process'
import type { Photo } from '../../src/lib/types.ts'
import { splitPhotos } from './split.ts'

const ROOT = new URL('../../', import.meta.url)
const ORIGIN = 'https://photos.rambleroo.app'
const WIDTH = 960
const AT_ONCE = 6

const registry = new URL('content/photos.json', ROOT)
const photos = JSON.parse(await readFile(registry, 'utf8')) as Photo[]

const local = (path: string) => new URL(`public${path}`, ROOT).pathname
const run = (args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn('convert', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    child.stderr.on('data', (d) => (err += d))
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(err.trim() || `convert exited ${code}`))))
  })

const todo = photos.filter((p) => !p.medium && p.width > WIDTH && p.file.startsWith('/photos/') && /\.jpe?g$/i.test(p.file))
let next = 0,
  made = 0
const failures: string[] = []
async function worker() {
  while (next < todo.length) {
    const photo = todo[next++]
    const full = local(photo.file)
    const medium = photo.file.replace(/\.jpe?g$/i, `-${WIDTH}.webp`)
    try {
      if (!existsSync(full)) {
        const res = await fetch(ORIGIN + photo.file.slice('/photos'.length))
        if (!res.ok) throw new Error(`${photo.file}: ${res.status} from the photo domain`)
        await mkdir(dirname(full), { recursive: true })
        await writeFile(full, Buffer.from(await res.arrayBuffer()))
      }
      await run([full, '-auto-orient', '-resize', `${WIDTH}x`, '-strip', '-quality', '78', local(medium)])
      photo.medium = medium
      if (++made % 100 === 0) console.log(`  ${made} of ${todo.length}`)
    } catch (error) {
      failures.push((error as Error).message)
    }
  }
}
await Promise.all(Array.from({ length: AT_ONCE }, worker))
await writeFile(registry, JSON.stringify(photos, null, 2) + '\n')
await splitPhotos()
console.log(`${made} middle-size copies made, ${failures.length} failed`)
for (const f of failures.slice(0, 20)) console.log(`  ${f}`)
if (failures.length) process.exitCode = 1
