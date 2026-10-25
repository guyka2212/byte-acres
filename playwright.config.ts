import { defineConfig } from '@playwright/test'

// Runs against local dev servers only. Chrome from this machine, no download.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // CI runners are slower than a desktop: fewer at once, and one retry for timing flakes
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['json', { outputFile: 'e2e-results/results.json' }]],
  outputDir: 'e2e-results/artifacts',
  use: { channel: 'chrome', viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'game', testIgnore: /(cloud|classes)\.spec\.ts/, use: { baseURL: 'http://localhost:4173' } },
    { name: 'cloud', testMatch: /(cloud|classes)\.spec\.ts/, use: { baseURL: 'http://localhost:4174' } },
  ],
  // production builds (one bundled worker file, like players get), with the test presets switched on
  webServer: [
    {
      command: 'npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: false,
      timeout: 180_000,
      // no cloud: empty values win over a developer's .env.local
      env: { VITE_E2E: '1', VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' },
    },
    {
      // cloud switched on, but pointed at a closed port: tests the failure paths without any real service
      command: 'npx vite build --outDir dist-e2e-cloud --emptyOutDir && npx vite preview --outDir dist-e2e-cloud --port 4174 --strictPort',
      url: 'http://localhost:4174',
      reuseExistingServer: false,
      timeout: 180_000,
      env: { VITE_E2E: '1', VITE_SUPABASE_URL: 'http://127.0.0.1:9', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e' },
    },
  ],
})
