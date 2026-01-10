# Backend Deployment Guide for Vercel

## Overview

This backend is deployed as a Vercel serverless function using the Mangum adapter to wrap the FastAPI application.

## Project Structure

```
python-agents/
├── api/                    # Vercel serverless functions
│   ├── index.py           # Main entry point for API
│   └── .vercelignore      # Files to exclude from deployment
├── backend/               # Backend application code
│   ├── backend_app.py     # FastAPI application
│   ├── services/          # Service layer
│   ├── config.py          # Configuration
│   └── requirements.txt   # Python dependencies
├── frontend/              # React frontend
└── vercel.json           # Vercel configuration
```

## Environment Variables

Set these in your Vercel project settings (Environment Variables tab):

### Required
- `OPENAI_API_KEY` - OpenAI API key for LLM operations
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase anon/service key
- `OPENAI_API_BASE` - OpenAI API base URL (or LM Studio endpoint)
- `OPENAI_MODEL` - LLM model name (e.g., gpt-4, gpt-3.5-turbo)
- `OPENAI_EMBEDDING_MODEL` - Embedding model (e.g., text-embedding-ada-002)
- `AZURE_STORAGE_CONNECTION_STRING` - Azure Storage connection string
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_PRIVATE_KEY` - Firebase service account private key

### Optional (with defaults)
- `CELERY_BROKER_URL` - RabbitMQ/Redis connection string
- `CELERY_QUEUE_NAME` - Celery queue name (default: default)
- `RUN_WORKER_EMBEDDED` - Run Celery worker in-process (default: false)
- `MONITORED_DIR` - Directory to monitor for new files
- `MAX_FILE_SIZE` - Maximum file upload size in bytes (default: 100MB)
- `MAX_FILES_PER_UPLOAD` - Maximum files per upload (default: 10)
- `ALLOWED_ORIGINS` - Comma-separated CORS origins

## Deployment Steps

1. **Link your project to Vercel** (if not already linked):
   ```bash
   vercel link
   ```

2. **Set environment variables** in Vercel dashboard or via CLI:
   ```bash
   vercel env add OPENAI_API_KEY
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_KEY
   # ... add all required variables
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

## API Routes

The backend will be available at:
- `https://your-domain.vercel.app/api/*` → Proxied to FastAPI

Main endpoints:
- `POST /api/agent/sync` - Synchronous agent
- `POST /api/agent/async` - Async agent with task
- `GET /api/agent/status/{task_id}` - Check task status
- `POST /api/agent/ingest` - Ingest documents
- `POST /api/agent/search` - Search documents (RAG)
- `GET /api/agent/documents` - List documents
- `GET /api/agent/documentsets` - List document sets
- `DELETE /api/agent/documents/{filename}` - Delete document
- `POST /api/agent/upload` - Upload files
- `GET /api/agent/files/{document_set}/{filename}` - Proxy file from Azure
- `POST /api/agent/summarize` - Summarize document
- `GET /api/agent/summaries` - Get summary history
- `POST /api/agent/summary_qa` - QA on summary
- `POST /api/agent/search_qa` - QA on search results
- `WS /api/ws` - WebSocket endpoint

## Important Notes

1. **Celery Workers**: Vercel serverless functions are not suitable for running Celery workers. For background tasks:
   - Use a separate VPC or worker deployment (e.g., Railway, Render, AWS ECS)
   - Or use Vercel Cron Jobs for scheduled tasks
   - Or integrate with a message queue service (e.g., AWS Lambda + SQS)

2. **WebSocket Support**: WebSockets may not be fully supported on Vercel. Consider:
   - Using a separate WebSocket service (e.g., Pusher, Socket.io)
   - Or using Server-Sent Events (SSE) for real-time updates

3. **Timeouts**: Vercel serverless functions have execution time limits:
   - Hobby: 10 seconds
   - Pro: 60 seconds
   - For long-running tasks, use background jobs

4. **File Uploads**: Large file uploads may hit Vercel limits. For production:
   - Use direct uploads to Azure Storage
   - Or use a dedicated file upload service

5. **Database**: The current setup uses SQLite which is not suitable for serverless. Consider:
   - Supabase Postgres (already configured for vectors)
   - Or Vercel Postgres

## Monitoring

- View logs in Vercel dashboard under the "Logs" tab
- Monitor performance in "Analytics" tab
- Set up alerts for errors in "Settings" → "Notifications"

## Troubleshooting

**"Module not found" errors**: Ensure all dependencies are in `backend/requirements.txt`

**Timeouts**: Break long-running tasks into smaller chunks or use background jobs

**Environment variables not set**: Check Vercel project settings and redeploy after adding

**CORS errors**: Verify `ALLOWED_ORIGINS` includes your frontend domain
