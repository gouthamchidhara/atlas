import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'] },
      manifest: {
        name: 'Cardwise',
        short_name: 'Cardwise',
        description: 'Local-first card tracker: spending, rewards, payments and alerts.',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#1a1b1f',
        theme_color: '#1a1b1f',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Add transaction', url: './#transactions' },
          { name: 'Payments', url: './#payments' },
          { name: 'Alerts', url: './#alerts' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
