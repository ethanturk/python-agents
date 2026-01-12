/**
 * Application constants
 * Centralized location for magic numbers and configuration values
 */

// Time constants (milliseconds)
export const TIME = {
  ONE_SECOND: 1000,
  ONE_MINUTE: 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
} as const;

// WebSocket configuration
export const WEBSOCKET = {
  RECONNECT_DELAY: 3000, // 3 seconds
  MAX_RECONNECT_ATTEMPTS: 10,
} as const;

// Storage keys
export const STORAGE_KEYS = {
  SUMMARIZATION_STATE: "summarization_state_v1",
  USER_PREFERENCES: "user_preferences",
} as const;

// Summarization configuration
export const SUMMARIZATION = {
  CACHE_EXPIRY_TIME: TIME.ONE_DAY, // 24 hours
  REQUEST_TIMEOUT: TIME.FIVE_MINUTES, // 5 minutes
  MAX_RETRY_ATTEMPTS: 3,
} as const;

// Search configuration
export const SEARCH = {
  MIN_QUERY_LENGTH: 2,
  DEFAULT_LIMIT: 25,
  DEBOUNCE_DELAY: 300, // milliseconds
} as const;

// Upload configuration
export const UPLOAD = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  BATCH_SIZE: 64,
  ALLOWED_EXTENSIONS: [
    ".pdf",
    ".docx",
    ".doc",
    ".txt",
    ".md",
    ".xlsx",
    ".xls",
    ".csv",
    ".pptx",
    ".ppt",
  ] as const,
} as const;

// UI configuration
export const UI = {
  SNACKBAR_DURATION: 6000, // 6 seconds
  LOADING_DEBOUNCE: 200, // milliseconds
  ANIMATION_DURATION: 300, // milliseconds
} as const;

const constants = {
  TIME,
  WEBSOCKET,
  STORAGE_KEYS,
  SUMMARIZATION,
  SEARCH,
  UPLOAD,
  UI,
};

export default constants;
