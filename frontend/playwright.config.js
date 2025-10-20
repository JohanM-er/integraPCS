// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report' }]],
  timeout: 60000, // 60 seconds

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    viewport: { width: 1920, height: 1080 },
    actionTimeout: 15000,
    navigationTimeout: 15000,
    screenshot: {
      mode: 'only-on-failure',
      fullPage: true
    },
    video: process.env.CI ? 'on-first-retry' : 'off'
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      }
    }
  ],

  // Do not auto-start a web server; assume frontend/backend are already running
  webServer: undefined
});