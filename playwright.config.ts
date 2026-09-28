import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  // Three browsers with WebGL maps saturate a laptop CPU; cap workers, and allow one retry so load-induced timing shows up as "flaky" in the report instead of failing the run.
  workers: 3,
  retries: 1,
  use: { baseURL: 'http://127.0.0.1:5198' },
  projects: [
    {
      name: 'desktop',
      testIgnore: '**/mobile.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
      },
    },
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
  ],
  webServer: { command: 'npx vite --port 5198 --strictPort --host 127.0.0.1', url: 'http://127.0.0.1:5198', reuseExistingServer: true },
})
