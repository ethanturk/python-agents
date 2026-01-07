import "@testing-library/jest-dom";
import { vi } from "vitest";

// Set up test environment variables
import.meta.env.VITE_API_BASE = "http://localhost:9999";
import.meta.env.VITE_FIREBASE_API_KEY = "fake-test-key"; // pragma: allowlist secret
import.meta.env.VITE_FIREBASE_AUTH_DOMAIN = "fake-test-domain.firebaseapp.com";
import.meta.env.VITE_FIREBASE_PROJECT_ID = "fake-test-project";
import.meta.env.VITE_FIREBASE_STORAGE_BUCKET = "fake-test-bucket.appspot.com";
import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID = "fake-test-sender";
import.meta.env.VITE_FIREBASE_APP_ID = "fake-test-app-id";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { summaries: [] } })),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: {
        use: vi.fn(),
        eject: vi.fn(),
      },
    },
  },
}));

// Mock matchMedia for MUI useMediaQuery
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false, // Default to false (desktop-ish if min-width)
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
