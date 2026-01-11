# Node.js Backend

This directory contains the Node.js serverless backend functions migrated from Python FastAPI.

## Architecture

The Node.js backend consists of four Vercel serverless functions:

1. **`api/agent/index.ts`** - Agent API endpoints
   - `/agent/sync` - Synchronous LLM chat
   - `/agent/async` - Submit async agent task to queue
   - `/agent/status/{task_id}` - Get async task status
   - `/agent/search` - RAG vector search

2. **`api/documents/index.ts`** - Documents API endpoints
   - `/agent/documents` - List all documents
   - `/agent/documentsets` - List document sets
   - `/agent/upload` - Upload documents (POST multipart/form-data)
   - `/agent/documents/{filename}` - Delete document (DELETE)
   - `/agent/files/{document_set}/{filename}` - Download file

3. **`api/summaries/index.ts`** - Summaries API endpoints
   - `/agent/summaries` - Get all summaries
   - `/agent/summary_qa` - QA on summary (POST)
   - `/agent/search_qa` - QA on search results (POST)
   - `/agent/summarize` - Submit summarization task (POST)

4. **`api/notifications/index.ts`** - Notifications API endpoints
   - `/poll` - Long-polling notifications (GET)
   - `/internal/notify` - Internal notification webhook (POST)

## Common Utilities

The `backend-nodejs/common/` directory contains shared utilities:

- `config.ts` - Environment configuration
- `auth.ts` - Firebase authentication
- `types.ts` - TypeScript type definitions
- `logger.ts` - Pino structured logging
- `llm.ts` - OpenAI LLM client
- `supabase.ts` - Supabase vector DB client
- `azure.ts` - Azure Storage client
- `queue.ts` - Queue service HTTP client
- `database.ts` - SQLite database (sql.js for serverless)
- `notifications.ts` - In-memory notification queue

## Environment Variables

See `.env.nodejs.example` for all required environment variables.

Key variables:
- `OPENAI_API_BASE`, `OPENAI_API_KEY`, `OPENAI_MODEL` - LLM configuration
- `SUPABASE_URL`, `SUPABASE_KEY` - Vector database
- `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER_NAME` - File storage
- `QUEUE_PROVIDER`, `QUEUE_SERVICE_URL` - Queue service
- `FIREBASE_REQUIRED`, `GOOGLE_APPLICATION_CREDENTIALS` - Authentication
- `SQLITE_DB_PATH` - Summaries database location

## Development

```bash
# Install dependencies
npm install

# Type check
npm run typecheck

# Lint
npm run lint

# Format
npm run format

# Run locally (with Vercel CLI)
vercel dev
```

## Deployment

Deploy to Vercel:
```bash
vercel --prod
```

Each function is deployed as an independent Vercel serverless function.

## Notes

- **Python Worker Unchanged**: The Python async worker (Celery tasks) remains unchanged and continues to handle document ingestion and summarization.
- **Queue Service**: Node.js functions communicate with the queue service via HTTP, maintaining compatibility with the Python worker.
- **SQLite**: Uses `sql.js` instead of `better-sqlite3` for serverless compatibility (pure JavaScript, no native bindings).
- **Firebase**: Optional authentication - set `FIREBASE_REQUIRED=true` for production.

## Testing

Tests are not yet implemented (tasks 11, 16, 22, 29 pending).
