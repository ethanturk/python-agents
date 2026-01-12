import path from "path";
import { fileURLToPath } from "url";

// Get directory of this config file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:9999';

    return [
      {
        source: '/agent/summaries',
        destination: `${backendUrl}/api/summaries`,
      },
      {
        source: '/agent/summary_qa',
        destination: `${backendUrl}/api/summaries`,
      },
      {
        source: '/agent/search_qa',
        destination: `${backendUrl}/api/summaries`,
      },
      {
        source: '/agent/summarize',
        destination: `${backendUrl}/api/summaries`,
      },
      {
        source: '/agent/documents',
        destination: `${backendUrl}/api/documents`,
      },
      {
        source: '/agent/documentsets',
        destination: `${backendUrl}/api/documents`,
      },
      {
        source: '/agent/upload',
        destination: `${backendUrl}/api/documents`,
      },
      {
        source: '/agent/documents/:filename',
        destination: `${backendUrl}/api/documents`,
      },
      {
        source: '/agent/files/:path*',
        destination: `${backendUrl}/api/documents`,
      },
      {
        source: '/agent/:path*',
        destination: `${backendUrl}/api/agent/:path*`,
      },
      {
        source: '/poll',
        destination: `${backendUrl}/api/notifications`,
      },
      {
        source: '/internal/notify',
        destination: `${backendUrl}/api/notifications`,
      },
    ];
  },
};

export default nextConfig;
