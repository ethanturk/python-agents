import "@testing-library/jest-dom";
import { vi } from "vitest";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { summaries: [] } })),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
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
