import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [tailwindcss(), react(), VitePWA({
    strategies: 'injectManifest',
    srcDir: 'src/pwa',
    filename: 'sw.js',
    registerType: 'prompt',
    injectRegister: false,
    manifest: {
      name: 'Life Abroad', short_name: 'Life Abroad',
      description: 'Learn English by living a new life abroad.',
      start_url: '/', scope: '/', display: 'standalone',
      background_color: '#f6f0e4', theme_color: '#426f61',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    injectManifest: {
      globPatterns: ['index.html', 'assets/**/*.{js,css,png,mp3}', 'icons/*.png', 'manifest.webmanifest'],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    },
  })],
  server: { port: 8082, strictPort: true },
  // Read workspace source so schema changes cannot leave a stale CommonJS prebundle.
  resolve: { alias: { '@life-abroad/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)) } },
  preview: { port: 8082, strictPort: true },
  build: { assetsInlineLimit: 0 },
});
