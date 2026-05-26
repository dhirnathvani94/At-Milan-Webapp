import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: true,
    headers: {
      // Allow same-origin iframe (for the phone mockup in homepage)
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "frame-ancestors 'self'",
      // ── DEV: Prevent browser from caching JS/CSS/assets ──────────────────
      // This ensures code changes appear in the SAME browser tab immediately.
      // localStorage (login credentials) is NOT affected by these headers.
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
    },
    // No proxy needed — Vite runs inside Express (middlewareMode).
    // API calls go directly to Express on port 3000. No proxy required.
  },
  clearScreen: false,
})
