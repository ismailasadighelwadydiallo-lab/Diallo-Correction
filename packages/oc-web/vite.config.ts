import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';

// Tout est servi par l'application elle-même : aucun CDN, aucune police externe.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    rollupOptions: { input: { main: resolve(__dirname, 'index.html'), labo: resolve(__dirname, 'labo.html') } },
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icone.svg', 'icone-192.png', 'icone-512.png'],
      manifest: {
        name: 'Offline Correction',
        short_name: 'OffCorrection',
        description: 'Correction automatique de copies, hors ligne.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4f6f8',
        theme_color: '#0b5cad',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icone.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // Précache de toute l'application (y compris le moteur de calcul et la page labo).
        globPatterns: ['**/*.{js,css,html,svg,png,wasm,json}'],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/packs\//, /labo\.html/],
        cleanupOutdatedCaches: true,
        // Aucune règle de cache « runtime » vers Internet : rien n'est récupéré en douce.
        runtimeCaching: [],
      },
    }),
  ],
});
