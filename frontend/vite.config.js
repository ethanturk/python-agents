import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
  server: {
    host: true,
    port: 3000,
    allowedHosts: ['localhost', '127.0.0.1', '0.0.0.0', '*.home.ethanturk.com']
  }
})
