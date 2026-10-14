import { defineConfig, devices } from '@playwright/test'

// Browser checks (e2e/): automated accessibility with axe-core on the main pages, light and dark.
// Run with `npm run test:a11y`. Uses the app at TEST_BASE_URL, or starts `npm run dev` on port 3000.
const baseURL = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  retries: 1, // the database pooler sometimes drops a connection for a few seconds
  workers: 1,
  reporter: [['list']],
  // Reduced motion: scroll-in animations are checked finished, the way people with animations off see them.
  use: { baseURL, ...devices['Pixel 7'], reducedMotion: 'reduce' },
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : { command: 'npm run dev', url: baseURL, reuseExistingServer: true, timeout: 180_000 },
})
