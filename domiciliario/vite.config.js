import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const isProd = mode === 'production';
  const apiUrl = env.VITE_API_URL || (isProd ? 'https://api.tudominio.com' : 'http://localhost:3001');
  
  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'credentialless',
    'Cross-Origin-Resource-Policy': 'same-site',
  };

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${isProd ? '' : "'unsafe-eval' "}https://apis.google.com https://www.gstatic.com https://accounts.google.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://accounts.google.com ${isProd ? '' : 'http://localhost:3001 http://localhost:5173 http://localhost:5174 http://localhost:5175 http://localhost:5176'}`,
    "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com https://*.web.app",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; ');

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'logoGoPa.png'],
        workbox: {
          cleanupOutdatedCaches: true,
        },
        manifest: {
          name: 'Domiciliario',
          short_name: 'Domiciliario',
          theme_color: '#5E244E',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            { src: 'logoGoPa.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'logoGoPa.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
          ]
        }
      }),
      {
        name: 'security-headers',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            Object.entries(securityHeaders).forEach(([key, value]) => {
              res.setHeader(key, value);
            });
            res.setHeader('Content-Security-Policy', csp);
            next();
          });
        },
        configurePreviewServer(server) {
          server.middlewares.use((req, res, next) => {
            Object.entries(securityHeaders).forEach(([key, value]) => {
              res.setHeader(key, value);
            });
            res.setHeader('Content-Security-Policy', csp);
            next();
          });
        },
      }
    ],
    server: { port: 5176, proxy: { '/api': apiUrl } },
    build: { outDir: 'dist', sourcemap: false },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
      globals: true,
      css: true
    }
  };
});