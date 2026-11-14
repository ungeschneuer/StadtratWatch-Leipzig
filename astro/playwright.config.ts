import { defineConfig, devices } from '@playwright/test';

// End-to-end and accessibility tests against the built site (npm run build), served below its base path as on GitHub
// Pages.
const base = process.env.SITE_BASE ?? '/StadtratWatch-Leipzig';
const port = 4329;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://localhost:${port}${base}/`,
    trace: 'off',
    // Locally the installed Chrome; in CI the Chromium that `playwright install` fetched.
    channel: process.env.CI ? undefined : 'chrome',
  },
  projects: [
    { name: 'desktop-light', use: { ...devices['Desktop Chrome'], colorScheme: 'light' } },
    { name: 'phone-dark', use: { ...devices['Pixel 7'], colorScheme: 'dark' } },
  ],
  webServer: {
    command: `node e2e/serve.mjs ${port} ${base}`,
    url: `http://localhost:${port}${base}/`,
    reuseExistingServer: !process.env.CI,
  },
});
