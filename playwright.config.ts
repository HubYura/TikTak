/* Автотести інтерфейсу: справжній браузер ганяє урок, гру, «Тепер ти!» і 3D-вежу.
   Ловлять те, чого не бачать модульні тести: зламану верстку, зайві оверлеї, кнопки, що не працюють.

     npm run e2e                       # потрібен Chromium Playwright (у CI ставиться сам)
     CHROMIUM=/шлях/до/chromium npm run e2e   # або свій */

import { defineConfig, devices } from '@playwright/test';

const PORT = 5180;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 760 },
    launchOptions: {
      executablePath: process.env.CHROMIUM || undefined,
      // WebGL без відеокарти — програмно, як на CI-серверах
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']
    },
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 760 } } }
  ],
  // Dev-сервер: у ньому є налагоджувальні хуки (__learn, __tower3d)
  webServer: { command: `npx vite --port ${PORT} --strictPort`, port: PORT, reuseExistingServer: !process.env.CI, timeout: 60_000 }
});
