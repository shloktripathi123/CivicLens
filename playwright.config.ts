import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'demo.spec.ts',
  timeout: 120000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:3100',
    headless: false,
    video: 'on',
    viewport: { width: 1280, height: 720 },
    launchOptions: { slowMo: 500 },
  },
});