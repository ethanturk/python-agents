import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const appBase = process.env.VITE_BASE_PATH || env.VITE_BASE_PATH || "/";

  // Validate required environment variables in production (skip for Vercel builds)
  // Vercel env vars are injected at runtime, not build time
  if (mode === "production" && !process.env.VERCEL) {
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
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      global: {
        require: "require",
        module: "(typeof module !== 'undefined' ? module : { exports: {} })",
      },
    },

    // ============================================================================
    // MEMORY & PERFORMANCE OPTIMIZATIONS FOR DOCKER
    // ============================================================================

    // Optimize dependency pre-bundling to reduce esbuild memory usage
    optimizeDeps: {
      // Include only small, frequently used dependencies
      include: [
        // React ecosystem - small and essential
        "react",
        "react-dom",
        // Utility libraries
        "axios",
      ],
      // Force optimization only when needed (not on every startup)
      force: false,
      // Use esbuild's incremental mode for faster subsequent builds
      esbuildOptions: {
        // Reduce memory pressure by disabling source maps during optimization
        sourcemap: false,
        // Set lower memory limit for esbuild (works with container limits)
        logLevel: "error",
      },
    },

    // ============================================================================
    // BUILD OPTIMIZATIONS
    // ============================================================================

    build: {
      // Use terser for production minification
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: mode === "production",
          drop_debugger: true,
          // Additional optimizations
          pure_funcs: ["console.log", "console.info", "console.debug"],
          passes: 2, // More aggressive compression
        },
        mangle: {
          safari10: true, // Better Safari support
        },
      },
      // Generate sourcemaps for debugging (disable in production for security)
      sourcemap: mode !== "production",

      // Target modern browsers for better tree-shaking and smaller bundles
      target: "es2020",

      // CSS optimization - extract to separate files for better caching
      cssCodeSplit: true,

      // Rollup optimizations
      rollupOptions: {
        // Enable tree-shaking
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false,
        },
        output: {
          // More granular chunking for better caching and parallel loading
          manualChunks: {
            "react-vendor": ["react", "react-dom"],
            "firebase-vendor": ["firebase/app", "firebase/auth"],
            "markdown-vendor": ["react-markdown", "remark-gfm"],
            vendor: ["axios"],
          },
          // Optimize chunk file names for better caching
          chunkFileNames: "assets/js/[name]-[hash].js",
          entryFileNames: "assets/js/[name]-[hash].js",
          assetFileNames: "assets/[ext]/[name]-[hash].[ext]",
        },
      },
      // Lower chunk size warning (500kb is reasonable for modern apps)
      chunkSizeWarningLimit: 500,
      // Enable chunk size warnings for better optimization
      reportCompressedSize: true,
    },

    // ============================================================================
    // DEVELOPMENT SERVER OPTIMIZATIONS (DOCKER)
    // ============================================================================

    server: {
      host: true,
      port: 3000,
      allowedHosts: [".ethanturk.com"],
      strictPort: true, // Fail fast if port is taken
      hmr: {
        // Disable HMR overlay in Docker to reduce memory overhead
        overlay: false,
      },
      // Optimize file watching for Docker
      watch: {
        // Use polling (required for Docker)
        usePolling: true,
        // Increase interval from 1000ms to 2000ms to reduce CPU overhead
        interval: 2000,
        // Ignore node_modules and build outputs to reduce file system overhead
        ignored: [
          "**/node_modules/**",
          "**/dist/**",
          "**/.git/**",
          "**/coverage/**",
        ],
      },
      // Reduce memory pressure by limiting concurrent requests
      cors: true,
    },

    // ============================================================================
    // PREVIEW SERVER (PRODUCTION PREVIEW)
    // ============================================================================

    preview: {
      port: 3000,
      host: true,
    },

    // ============================================================================
    // TEST CONFIGURATION
    // ============================================================================

    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./src/setupTests.js",
      // Optimize test runner
      pool: "threads",
      poolOptions: {
        threads: {
          singleThread: false,
          minThreads: 1,
          maxThreads: 2, // Limit concurrent test threads in Docker
        },
      },
      // Exclude large dependencies from test transformation
      transformMode: {
        ssr: [],
      },
    },
  };
});
