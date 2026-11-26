import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';

// Tout est servi par l'application elle-même : aucun CDN, aucune police externe.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html'), labo: resolve(__dirname, 'labo.html') },
      output: {
        // moteurs d'IA dans des fichiers à part : ils ne sont chargés que par la page labo
        manualChunks: (id) => (id.includes('@mlc-ai/web-llm') ? 'ia-webllm' : id.includes('@wllama/wllama') ? 'ia-wllama' : undefined),
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icone.svg', 'icone-192.png', 'icone-512.png'],
      manifest: {
        name: 'Diallo Correction',
        short_name: 'Diallo Correction',
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
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,wasm,json}'],
        // Les moteurs d'IA (≈ 6 Mo + 11 Mo) ne sont pas préchargés pour tout le monde :
        // ils sont mis en cache à la première ouverture du labo (même origine, jamais Internet).
        globIgnores: ['**/ia-*.js', '**/*.wasm', 'ocr/**'],
        // Lecture des photos (OCR, ≈ 5 à 6 Mo) : téléchargée une seule fois, à la demande
        // (bouton « Préparer la lecture hors ligne » ou première lecture), puis gardée.
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/packs\//, /labo\.html/],
        cleanupOutdatedCaches: true,
        // Aucune règle de cache vers Internet : seuls des fichiers de l'application elle-même.
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/assets\/(ia-.*\.js|.*\.wasm)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'oc-moteurs-ia' },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/ocr\/[^/]+$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'oc-ocr' },
          },
        ],
      },
    }),
  ],
});
