/**
 * Configuration for Node.js serverless functions.
 * Ported from backend/common/config.py
 */

function getEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true";
}

export const config = {
  // Base URL for services
  BASE_URL: getEnv("BASE_URL", "192.168.5.204"),

  // OpenAI / Local LLM Configuration
  OPENAI_API_BASE: getEnv("OPENAI_API_BASE", "http://192.168.5.203:1234/v1"),
  OPENAI_API_KEY: getEnv("OPENAI_API_KEY", "lm-studio"),
  OPENAI_MODEL: getEnv("OPENAI_MODEL", "gpt-oss-20b"),
  OPENAI_EMBEDDING_MODEL: getEnv(
    "OPENAI_EMBEDDING_MODEL",
    "text-embedding-nomic-embed-text-v1.5",
  ),
  OPENAI_EMBEDDING_DIMENSIONS: parseInt(
    getEnv("OPENAI_EMBEDDING_DIMENSIONS", "768"),
    10,
  ),

  // API URL
  API_URL: process.env.API_URL,

  // Supabase Configuration
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,
  DATABASE_CONN_STRING: process.env.DATABASE_CONN_STRING,
  VECTOR_TABLE_NAME: getEnv("VECTOR_TABLE_NAME", "documents"),

  // Azure Storage Configuration
  AZURE_STORAGE_CONNECTION_STRING: process.env.AZURE_STORAGE_CONNECTION_STRING,
  AZURE_STORAGE_CONTAINER_NAME: getEnv(
    "AZURE_STORAGE_CONTAINER_NAME",
    "documents",
  ),
  AZURE_STORAGE_ACCOUNT_NAME: process.env.AZURE_STORAGE_ACCOUNT_NAME,

  // Celery Configuration (for Python worker - not used by Node.js)
  CELERY_BROKER_URL: process.env.CELERY_BROKER_URL,
  CELERY_QUEUE_NAME: getEnv("CELERY_QUEUE_NAME", "celery"),

  // Deployment Configuration
  RUN_WORKER_EMBEDDED: getEnvBoolean("RUN_WORKER_EMBEDDED", false),

  // Firebase Configuration
  FIREBASE_REQUIRED: getEnvBoolean("FIREBASE_REQUIRED", false),

  // Queue Service Configuration
  QUEUE_PROVIDER: getEnv("QUEUE_PROVIDER", "mock"),
  QUEUE_SERVICE_URL: process.env.QUEUE_SERVICE_URL,

  // SQLite Database Configuration
  SQLITE_DB_PATH: getEnv("SQLITE_DB_PATH", "/tmp/summaries.db"),
};
