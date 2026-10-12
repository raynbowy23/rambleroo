// Starts the Worker (Wrangler on 8787, for /api) and the app (Vite on 5173) together; Ctrl+C stops both, and if either one exits the
// other is stopped too. Open http://localhost:5173. Usage: npm run dev:all
import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'

// A Wrangler already running (from `npm run dev:api` in another terminal) is reused rather than started twice.
const listening = (port) =>
  new Promise((resolve) => {
    const socket = createConnection({ port, host: '127.0.0.1' })
    socket.once('connect', () => (socket.destroy(), resolve(true)))
    socket.once('error', () => resolve(false))
  })
const apiRunning = await listening(8787)
if (apiRunning) console.log('[dev:all] Wrangler is already running on 8787; starting only Vite.')
const children = [...(apiRunning ? [] : [['api', 'npm run dev:api']]), ['app', 'npm run dev']].map(([name, command]) => {
  const child = spawn(command, { shell: true, stdio: 'inherit', detached: process.platform !== 'win32' })
  child.on('exit', (code) => {
    if (!stopping) console.log(`\n[dev:all] ${name} stopped${code ? ` (exit ${code})` : ''}; stopping the other one.`)
    stop(code ?? 0)
  })
  return child
})
let stopping = false
function stop(code) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (child.exitCode !== null) continue
    // Each one runs in its own process group, so the shell, npm and the server under it all stop.
    try {
      if (process.platform === 'win32') child.kill()
      else process.kill(-child.pid, 'SIGTERM')
    } catch {}
  }
  setTimeout(() => process.exit(code), 500)
}
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
