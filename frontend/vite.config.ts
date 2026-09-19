import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // Em dev o PWA e a API ficam na mesma origem (como em produção atrás do Caddy),
    // então o cookie de refresh funciona sem configuração de CORS/SameSite.
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false } },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Disciplina',
        short_name: 'Disciplina',
        description: 'Rotina, metas, treinos e o seu percentual de disciplina, todo dia.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0B0D10',
        theme_color: '#0B0D10',
        categories: ['productivity', 'health', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        navigateFallback: '/index.html',
        // A API nunca passa pelo fallback de navegação nem pelo cache de assets.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Leitura offline do próprio perfil (última resposta conhecida).
            urlPattern: /\/api\/v1\/users\/me$/,
            handler: 'NetworkFirst',
            method: 'GET',
            options: { cacheName: 'api-me', networkTimeoutSeconds: 4, expiration: { maxEntries: 1 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
