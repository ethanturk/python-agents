import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  console.log("DEBUG: VITE_APP_BASE:", env.VITE_APP_BASE)
  console.log("DEBUG: Mode:", mode)
  return {
    base: env.VITE_APP_BASE || '/',
    plugins: [react()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.js',
    },
    server: {
      host: true,
      port: 3000,
      allowedHosts: ['.ethanturk.com']
    }
  }
})
