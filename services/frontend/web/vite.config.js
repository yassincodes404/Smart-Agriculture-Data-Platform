import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const appRoot = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  root: appRoot,
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 1000,
    },
    // Allow connections from nginx proxy and Docker network
    allowedHosts: ['localhost', 'frontend', 'agri_frontend'],
    // WebSocket HMR config for Docker/nginx
    hmr: {
      // When accessed through nginx on port 80, HMR needs a specific path
      path: '__vite_hmr',
    },
    // Proxy API requests to the backend (for local dev without Nginx)
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
