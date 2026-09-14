import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Mentes que Aprenden - Gestión Clínica',
        short_name: 'Mentes que Aprenden',
        description: 'Sistema de gestión clínica interdisciplinaria',
        theme_color: '#7c5cbf',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'es',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
