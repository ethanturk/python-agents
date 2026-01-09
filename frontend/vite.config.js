/* global process */
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const appBase = process.env.VITE_BASE_PATH || env.VITE_BASE_PATH || "/";

  // Validate required environment variables in production
  if (mode === "production") {
    const requiredEnvVars = ["VITE_API_BASE", "VITE_FIREBASE_API_KEY"];
    const missing = requiredEnvVars.filter((varName) => !env[varName]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}\n` +
          "Please ensure all required variables are set in your .env file.",
      );
    }
  }

  return {
    base: appBase,
    plugins: [react()],

    // Build optimizations
    build: {
      // Enable minification
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: mode === "production", // Remove console.log in production
          drop_debugger: true,
        },
      },
      // Generate sourcemaps for debugging (disable in production for security)
      sourcemap: mode !== "production",
      // Optimize chunk splitting
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks for better caching
            "react-vendor": ["react", "react-dom"],
            "mui-vendor": [
              "@mui/material",
              "@emotion/react",
              "@emotion/styled",
            ],
            "firebase-vendor": ["firebase/auth"],
            "markdown-vendor": ["react-markdown", "remark-gfm"],
          },
        },
      },
      // Increase chunk size warning limit (default is 500kb)
      chunkSizeWarningLimit: 1000,
    },

    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./src/setupTests.js",
    },

    server: {
      host: true,
      port: 3000,
      allowedHosts: [".ethanturk.com"],
      watch: {
        // Use polling for Docker environments to avoid file watcher crashes
        usePolling: true,
        interval: 1000,
      },
    },
  };
});
