import path from "path";
import { fileURLToPath } from "url";

// Get directory of this config file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */

  // For monorepo setups - tells Next.js where the app root is
  outputFileTracingRoot: path.join(__dirname, ".."),

  // Explicitly disable Turbopack for now due to workspace issues
  // turbopack: false,
};

export default nextConfig;
