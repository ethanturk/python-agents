// API Base URL - MUST be set via environment variable
// No fallback to hardcoded value for security reasons
if (!import.meta.env.VITE_API_BASE) {
  throw new Error(
    "VITE_API_BASE environment variable is not set. " +
      "Please create a .env file with VITE_API_BASE=<your-api-url>",
  );
}

export const API_BASE = import.meta.env.VITE_API_BASE;
