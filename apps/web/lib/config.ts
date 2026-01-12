// API Base URL - MUST be set via environment variable
// No fallback to hardcoded value for security reasons
if (!process.env.NEXT_PUBLIC_API_BASE) {
  // Only throw in browser/client-side if strictly needed, or warn
  if (typeof window !== "undefined") {
    console.warn(
      "NEXT_PUBLIC_API_BASE environment variable is not set. " +
        "Please create a .env.local file with NEXT_PUBLIC_API_BASE=<your-api-url>",
    );
  }
}

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";
