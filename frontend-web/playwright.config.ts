import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    headless: true,
    baseURL: 'http://127.0.0.1:5174',
    // trace: 'on-first-retry',
  },
});
