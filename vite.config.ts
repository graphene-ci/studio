import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      // Connect RPCs go same-origin in dev; graphene-server listens on :7233.
      '/graphene.management.v1.': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:7233',
        changeOrigin: true,
      },
    },
  },
})
