import { defineConfig } from '@playwright/test';

const external = Boolean(process.env.BASE_URL);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: process.env.TEST_HTML_REPORT ?? 'playwright-report', open: 'never' }]],
  outputDir: process.env.TEST_OUTPUT_DIR ?? 'test-results',
  timeout: 20_000,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:4188',
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  ...(external ? {} : {
    webServer: [
      {
        command: 'node server.mjs',
        url: 'http://127.0.0.1:4188/api/health',
        reuseExistingServer: !process.env.CI,
        timeout: 15_000,
        env: {
          PATCHLOOP_HOST: '127.0.0.1',
          PATCHLOOP_PORT: '4188',
          PATCHLOOP_DATA_DIR: '.patchloop/e2e-state',
        },
      },
      {
        command: 'node demo-template/server.mjs',
        url: 'http://127.0.0.1:4180/api/health',
        reuseExistingServer: !process.env.CI,
        timeout: 15_000,
        env: {
          PATCHLOOP_HOST: '127.0.0.1',
          PATCHLOOP_PORT: '4180',
          PATCHLOOP_DATA_DIR: '.patchloop/e2e-demo-state',
        },
      },
    ],
  }),
});
