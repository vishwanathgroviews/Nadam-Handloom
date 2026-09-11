import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Bind every interface, not just loopback, so the dev server is reachable
    // at the machine's LAN address too (e.g. testing from a phone alongside
    // the admin app) — Vite defaults to localhost-only otherwise.
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
