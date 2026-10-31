// Vite builds the website into plain files (dist/) that nginx serves; nothing runs on the
// server for the website itself. During development /api goes to the local server.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = process.env.NH_API_URL || 'http://localhost:4300';
// Saree and collection photos come from the shop's media bucket (S3_PUBLIC_URL on the server).
const MEDIA = process.env.NH_MEDIA_ORIGIN || 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com';
// Razorpay's checkout script and the one it loads itself (fraud checks).
const RZP_SCRIPTS = 'https://checkout.razorpay.com https://cdn.razorpay.com';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.NH_WEB_PORT || 5180),
    strictPort: true,
    // The browser talks to one address: same-origin cookies, exactly like production.
    proxy: { '/api': { target: API, changeOrigin: false }, '/uploads': { target: API, changeOrigin: false } },
  },
  // `npm run preview` serves the built files with the same strict security policy as the live
  // nginx (docs/deployment/live-v2-server.md), so a page that breaks it shows up here first.
  preview: {
    port: Number(process.env.NH_WEB_PORT || 5180),
    strictPort: true,
    proxy: { '/api': API, '/uploads': API },
    headers: {
      // W6: Razorpay's window (its script, its frame, its calls; its loader adds a small inline
      // style) and the payment feature inside its frame.
      'Content-Security-Policy': `default-src 'self'; script-src 'self' ${RZP_SCRIPTS}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${MEDIA} https://*.razorpay.com; font-src 'self'; connect-src 'self' https://fcmregistrations.googleapis.com https://firebaseinstallations.googleapis.com https://*.razorpay.com; frame-src https://api.razorpay.com https://api-dark.razorpay.com https://checkout-static-next.razorpay.com; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`,
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self "https://api.razorpay.com")',
    },
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    // Firebase is loaded separately, only when a customer turns notifications on.
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.js'],
    css: false,
    restoreMocks: true,
  },
});
