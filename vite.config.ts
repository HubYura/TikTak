import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'ЧасоПарк — вчимося читати годинник',
        short_name: 'ЧасоПарк',
        description: 'Гра для дітей: читаємо аналоговий годинник і будуємо парк атракціонів.',
        lang: 'uk',
        theme_color: '#bfe9ff',
        background_color: '#eaf7ff',
        display: 'standalone',
        orientation: 'any',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Записи голосу Тіка — у кеш при першому програванні, щоб потім звучали й офлайн
        runtimeCaching: [
          { urlPattern: ({ url }) => url.pathname === '/voice/manifest.json', handler: 'StaleWhileRevalidate', options: { cacheName: 'voice-manifest' } },
          { urlPattern: ({ url }) => url.pathname.startsWith('/voice/'), handler: 'CacheFirst', options: { cacheName: 'voice', expiration: { maxEntries: 4000 } } }
        ]
      }
    })
  ]
});
