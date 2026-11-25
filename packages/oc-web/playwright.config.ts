import { defineConfig, devices } from '@playwright/test';

// Un « projet » par navigateur visé. Les moteurs réels sont trois : Chromium (Chrome, Edge,
// Samsung Internet, Opera), Gecko (Firefox) et WebKit (Safari, et TOUS les navigateurs sur iPhone/iPad).
//
// - `npm run test:avion`       → projets Chromium (navigateur fourni avec cet environnement)
// - `npm run test:navigateurs` → tous les projets ; il faut d'abord
//                                `npx playwright install --with-deps chromium firefox webkit msedge`
//   (c'est ce que fait la vérification automatique GitHub : .github/workflows/navigateurs.yml)
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'off' },
  projects: [
    { name: 'android-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'pc-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'pc-edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    { name: 'pc-firefox', use: { ...devices['Desktop Firefox'] } },
    // Playwright ne sait pas émuler Firefox Android (isMobile) : écran de téléphone seulement.
    { name: 'mobile-firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 412, height: 915 } } },
    { name: 'iphone-safari', use: { ...devices['iPhone 13'] } },
    { name: 'ipad-safari', use: { ...devices['iPad (gen 7)'] } },
    { name: 'mac-safari', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    cwd: import.meta.dirname,
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
});
