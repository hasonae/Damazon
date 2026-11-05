import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { damazonAppConfig } from '@damazon/configurations/vite/app.config.mjs';

const basePath = process.env.VITE_BASE_PATH ?? '/';

/**
 * Administrative console.
 *
 * This is a separate application from the customer PWA and shares only the
 * design system's neutral primitives. Nothing consumer-facing is imported here,
 * and the consumer bundle contains no administrative code (ADR-0008).
 *
 * The console is professional, minimal, and animation-free. The visual language
 * comes entirely from the `professional` token set, selected by the
 * `data-dz-theme` attribute the shell sets on the document element.
 */
export default {
  ...damazonAppConfig({ port: 5174 }),
  base: basePath,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'favicon-32.png',
        'favicon-48.png',
        'apple-touch-icon.png',
        'damazon-logo.png',
      ],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${basePath}index.html`,
        // Staff data is never cached: an offline console showing stale orders or
        // payouts is worse than a clear offline state.
        runtimeCaching: [],
      },
      manifest: {
        name: 'دامازون - لوحة الإدارة',
        short_name: 'الإدارة',
        description: 'لوحة إدارة منصة دامازون',
        lang: 'ar',
        dir: 'rtl',
        start_url: basePath,
        scope: basePath,
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#faf9f8',
        theme_color: '#453d35',
        categories: ['business', 'productivity'],
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
