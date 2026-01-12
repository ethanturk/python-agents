import path from "path";
import { fileURLToPath } from "url";

// Get the directory of this config file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */

  // For monorepo setups - tells Next.js where the app root is
  outputFileTracingRoot: path.join(__dirname, ".."),

  turbopack: {
    // Set Turbopack root to parent directory for monorepo
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
