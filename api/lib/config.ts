/**
 * Configuration for Node.js serverless functions.
 * Ported from backend/common/config.py
 */

export const config = {
  // Base URL for services
  BASE_URL: process.env.BASE_URL,

  // OpenAI / Local LLM Configuration
  OPENAI_API_BASE: process.env.OPENAI_API_BASE,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL,
  OPENAI_EMBEDDING_DIMENSIONS: parseInt(
    process.env.OPENAI_EMBEDDING_DIMENSIONS || "1536",
    10,
  ),

  // API URL
  API_URL: process.env.API_URL,

  // Supabase Configuration
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,
  DATABASE_CONN_STRING: process.env.DATABASE_CONN_STRING,
  VECTOR_TABLE_NAME: process.env.VECTOR_TABLE_NAME,

  // Azure Storage Configuration
  AZURE_STORAGE_CONNECTION_STRING: process.env.AZURE_STORAGE_CONNECTION_STRING,
  AZURE_STORAGE_CONTAINER_NAME: process.env.AZURE_STORAGE_CONTAINER_NAME,
  AZURE_STORAGE_ACCOUNT_NAME: process.env.AZURE_STORAGE_ACCOUNT_NAME,

  // Celery Configuration (for Python worker - not used by Node.js)
  CELERY_BROKER_URL: process.env.CELERY_BROKER_URL,
  CELERY_QUEUE_NAME: process.env.CELERY_QUEUE_NAME,

  // Deployment Configuration
  RUN_WORKER_EMBEDDED: process.env.RUN_WORKER_EMBEDDED,

  // Firebase Configuration
  FIREBASE_REQUIRED: process.env.FIREBASE_REQUIRED,

  // Queue Service Configuration
  QUEUE_PROVIDER: process.env.QUEUE_PROVIDER,
  QUEUE_SERVICE_URL: process.env.QUEUE_SERVICE_URL,

  // SQLite Database Configuration
  SQLITE_DB_PATH: process.env.SQLITE_DB_PATH ,
};
