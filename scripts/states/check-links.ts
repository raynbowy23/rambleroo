// Run by hand with npx tsx scripts/states/check-links.ts; requests are sequential and spaced one second apart.
import { readdir, readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import type { StateChapter } from '../../src/lib/types.ts'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const headers = { 'User-Agent': 'Rambleroo/0.1 (state chapter link checker)' }

export async function checkLink(url: string, request: typeof fetch = fetch, pause: () => Promise<void> = () => sleep(1000)) {
  const issues = new Set<string>()
  async function attempt(method: 'HEAD' | 'GET') {
    let current = url
    for (let redirects = 0; redirects <= 10; redirects++) {
      await pause()
      const response = await request(current, { method, headers, redirect: 'manual', signal: AbortSignal.timeout(20000) })
      await response.body?.cancel()
      const location = response.headers.get('location')
      if (response.status >= 300 && response.status < 400 && location) {
        const next = new URL(location, current)
        if (next.host !== new URL(current).host) issues.add(`different-host redirect: ${current} -> ${next.href}`)
        if (!['http:', 'https:'].includes(next.protocol)) throw new Error(`unsupported redirect: ${next.href}`)
        current = next.href
      } else return response.status
    }
    throw new Error('more than 10 redirects')
  }
  let status: number
  try {
    try {
      status = await attempt('HEAD')
    } catch {
      status = 0
    }
    if (status < 200 || status >= 400) status = await attempt('GET')
    if (status < 200 || status >= 400) issues.add(`HTTP ${status}`)
  } catch (error) {
    issues.add(error instanceof Error ? error.message : String(error))
  }
  return [...issues]
}

async function main() {
  const directory = new URL('../../content/states/', import.meta.url)
  const urls = new Map<string, Set<string>>()
  for (const file of (await readdir(directory)).filter((file) => file.endsWith('.json')).sort()) {
    const chapter: StateChapter = JSON.parse(await readFile(new URL(file, directory), 'utf8'))
    const links = [...chapter.sources, ...chapter.programs.flatMap((program) => program.members)].flatMap((entry) =>
      entry.url ? [entry.url] : [],
    )
    for (const url of links) {
      if (!urls.has(url)) urls.set(url, new Set())
      urls.get(url)!.add(chapter.code)
    }
  }
  let flagged = 0
  for (const [url, chapters] of urls) {
    const issues = await checkLink(url)
    if (issues.length) flagged++
    console.log(`${issues.length ? 'CHECK' : 'OK'} [${[...chapters].join(', ')}] ${url}`)
    for (const issue of issues) console.log(`  ${issue}`)
  }
  console.log(`${urls.size} URLs checked; ${flagged} need review.`)
  if (flagged) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
