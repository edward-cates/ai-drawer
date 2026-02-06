import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 30000,
  retries: 0,
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node test/e2e/server.js',
    port: 3001,
    timeout: 10000,
    reuseExistingServer: !process.env.CI,
  },
});
