import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  test: {
    poolOptions: { forks: { execArgv: ['--experimental-sqlite'] } },
    projects: [
      { extends: true, test: { name: 'worker', environment: 'node', include: ['worker/**/*.test.ts'], pool: 'forks' } },
      { extends: true, test: { name: 'app', environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] } },
      { extends: true, test: { name: 'ingest', environment: 'node', include: ['scripts/**/*.test.ts'] } },
    ],
  },
})
