import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:5198',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: { command: 'npx vite --port 5198 --strictPort --host 127.0.0.1', url: 'http://127.0.0.1:5198', reuseExistingServer: true },
})
