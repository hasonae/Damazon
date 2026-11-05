import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { damazonAppConfig } from '@damazon/configurations/vite/app.config.mjs';

const basePath = process.env.VITE_BASE_PATH ?? '/';

/**
 * Customer, merchant, restaurant, delivery-company, and driver application.
 *
 * The app is a single installable PWA that changes mode by active role. It is
 * deployed separately from the admin console (ADR-0008), and nothing
 * administrative is reachable from this bundle.
 */
export default {
  ...damazonAppConfig({ port: 5173 }),
  base: basePath,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon-32.png',
        'favicon-48.png',
        'apple-touch-icon.png',
        'damazon-logo.png',
      ],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${basePath}index.html`,
        runtimeCaching: [
          {
            // Product and business imagery is immutable once uploaded, so it is
            // safe to cache for a long period.
            urlPattern: /\/media\/.*\.(?:png|jpe?g|webp|avif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'damazon-media',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Reference data such as categories changes rarely and is safe to
            // serve stale while offline.
            urlPattern: /\/api\/v1\/(categories|cities|stores|restaurants)(\?|$)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'damazon-reference',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      manifest: {
        name: 'دامازون',
        short_name: 'دامازون',
        description: 'سوق سوريا الإلكتروني: مطاعم، بقالة، متاجر، وتوصيل.',
        lang: 'ar',
        dir: 'rtl',
        start_url: basePath,
        scope: basePath,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fcf6f1',
        theme_color: '#8c5a3f',
        categories: ['shopping', 'food', 'business'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
};
