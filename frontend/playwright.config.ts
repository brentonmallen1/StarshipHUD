import { defineConfig, devices } from '@playwright/test';

// Smoke tests run against a throwaway backend + Vite dev server on uncommon
// ports so they never collide with a running dev stack or container.
const API_PORT = 18731;
const WEB_PORT = 18732;
const DATA_DIR = 'e2e/.data';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        // Locally, drive the installed Google Chrome (no browser download);
        // CI installs Playwright's Chromium instead
        channel: process.env.CI ? undefined : 'chrome',
      },
    },
  ],
  webServer: [
    {
      // Fresh seeded database every run; auth disabled (trusted-table mode)
      command:
        `rm -rf ${DATA_DIR} && mkdir -p ${DATA_DIR} && cd ../backend && ` +
        `DATABASE_URL=sqlite+aiosqlite:///../frontend/${DATA_DIR}/e2e.db ` +
        `UPLOADS_DIR=../frontend/${DATA_DIR}/uploads AUTH_ENABLED=false ` +
        `uv run uvicorn app.main:app --host 127.0.0.1 --port ${API_PORT}`,
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}` },
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
