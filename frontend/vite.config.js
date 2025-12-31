import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const appBase = process.env.VITE_APP_BASE || env.VITE_APP_BASE || '/'
  
  console.log("DEBUG: All Env Keys:", Object.keys(process.env).sort())
  console.log("DEBUG: process.env.VITE_APP_BASE:", process.env.VITE_APP_BASE)
  console.log("DEBUG: env.VITE_APP_BASE:", env.VITE_APP_BASE)
  console.log("DEBUG: Resolved Base:", appBase)
  
  return {
    base: appBase,
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
