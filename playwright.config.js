import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir:  './src/tests/e2e',
  testMatch:'**/*.e2e.js',

  // Un worker a la vez — los tests comparten localStorage del browser
  workers: 1,
  fullyParallel: false,

  timeout:     35_000,   // máximo por test
  retries:     1,        // 1 reintento en CI antes de marcar como fallado
  reporter:    [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],

  // Playwright levanta el servidor automáticamente en CI (cuando no hay uno corriendo)
  webServer: {
    command:             'npm run dev',
    url:                 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout:             30_000,
  },

  use: {
    baseURL:        'http://localhost:3000',
    headless:       true,
    viewport:       { width: 1280, height: 800 },
    actionTimeout:  12_000,
    navigationTimeout: 20_000,
    screenshot:     'only-on-failure',
    video:          'retain-on-failure',
    trace:          'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use:  { ...devices['Desktop Chrome'] },
    },
  ],
})
