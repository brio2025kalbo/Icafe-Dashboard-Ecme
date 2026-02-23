import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path';
import dynamicImport from 'vite-plugin-dynamic-import'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), dynamicImport()],
  assetsInclude: ['**/*.md'],
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      // Auth endpoints (not prefixed with /api to match the existing Ecme contract)
      '/sign-in': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      '/sign-up': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      '/sign-out': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      '/forgot-password': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      '/reset-password': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      // Forward iCafeCloud API calls to the local proxy server (server.cjs)
      // which handles CORS and IP whitelisting.
      '/icafe-api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'build'
  }
})
