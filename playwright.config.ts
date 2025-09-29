import { defineConfig } from '@playwright/test';

const PORT = process.env.PLAYWRIGHT_PORT ? Number(process.env.PLAYWRIGHT_PORT) : 4173;

export default defineConfig({
  testDir: 'playwright/tests',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${PORT}`,
    cwd: 'playground',
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
