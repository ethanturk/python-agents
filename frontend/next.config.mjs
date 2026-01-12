import path from "path";
import { fileURLToPath } from "url";

// Get the directory of this config file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */

  // For monorepo setups - tells Next.js where the app root is
  outputFileTracingRoot: __dirname,

  turbopack: {
    // Set Turbopack root to current directory
    root: __dirname,
  },
};

export default nextConfig;
