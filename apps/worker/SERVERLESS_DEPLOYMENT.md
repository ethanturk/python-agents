# Serverless Deployment Guide

This guide explains how to deploy the backend to Vercel serverless functions.

## Architecture Overview

The backend is split into 4 domain-specific Vercel functions with minimal dependencies:

### Minimal Dependency Strategy
Each serverless function has its own `requirements.txt` with only necessary dependencies:
- **Agent**: `api/agent/requirements.txt` - pydantic-ai, litellm, supabase, nest_asyncio
- **Documents**: `api/documents/requirements.txt` - fastapi, azure-storage-blob, supabase
- **Summaries**: `api/summaries/requirements.txt` - pydantic-ai, supabase, fastapi
- **Notifications**: `api/notifications/requirements.txt` - fastapi only

### Lazy Loading Pattern
Heavy dependencies use lazy imports to minimize cold start time and bundle size:
- **firebase-admin**: Only imported when auth is used (optional for dev)
- **boto3/azure.queue**: Only loaded when `QUEUE_PROVIDER=sqs` or `azure`
- **Embedding models**: Initialized on first use, not import time

### Function Isolation
Each function has:
- `api/{function}/requirements.txt` - Minimal dependencies
- `api/{function}/models.py` - Pydantic models (duplicated for minimal size)
- `api/{function}/service.py` - Thin wrapper calling backend services
- `api/{function}/index.py` - Vercel handler with Mangum

Shared code remains in `backend/` directory:
- `backend/common/` - Config and auth with lazy imports
- `backend/services/` - Business logic services

The backend is split into 4 domain-specific Vercel functions:

| Function | Endpoints | Dependencies | Purpose |
|----------|-----------|--------------|---------|
| `api/agent` | `/agent/sync`, `/agent/async`, `/agent/status`, `/agent/search` | pydantic-ai, litellm, supabase, nest_asyncio, fastapi | LLM queries and RAG |
| `api/documents` | `/agent/upload`, `/agent/documents`, `/agent/documentsets`, `/agent/delete`, `/agent/files` | fastapi, azure-storage-blob, supabase | File operations |
| `api/summaries` | `/agent/summaries`, `/agent/summary_qa`, `/agent/search_qa`, `/agent/summarize` | pydantic-ai, supabase, fastapi | Cached summaries |
| `api/notifications` | `/poll`, `/internal/notify` | fastapi only | Notifications (polling) |

## Deployment Steps

### 1. Configure Environment Variables

Create `.env` or set in Vercel dashboard:

```bash
# Required for all functions
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...;...

# Queue service (default: mock for dev)
QUEUE_PROVIDER=mock

# For AWS SQS (if QUEUE_PROVIDER=sqs)
AWS_SQS_QUEUE_URL=https://sqs.region.amazonaws.com/...

# For Azure Queue (if QUEUE_PROVIDER=azure)
AZURE_QUEUE_NAME=tasks

# Optional: Firebase auth
FIREBASE_REQUIRED=true
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### 2. Deploy to Vercel

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### 3. Test Deployment

```bash
# Test health endpoint
curl https://your-app.vercel.app/api/agent/health

# Test sync agent (requires auth token)
curl -X POST https://your-app.vercel.app/api/agent/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello"}'
```

## Queue Service Setup

### Mock Queue (Development)

For development without external queue:

```bash
QUEUE_PROVIDER=mock
```

This uses an in-memory mock that instantly completes tasks.

### AWS SQS (Production)

```bash
QUEUE_PROVIDER=sqs
AWS_SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/myqueue
```

### Azure Queue Storage (Production)

```bash
QUEUE_PROVIDER=azure
AZURE_QUEUE_NAME=tasks
```

## Known Limitations

1. **No WebSockets**: `/ws` endpoint not available (use `/poll` instead)
2. **No SSE**: `/sse` endpoint not available (use `/poll` instead)
3. **No Celery**: Async tasks use external queue service
4. **File Upload**: Files must be < 100MB and allowlisted extensions
5. **Cold Starts**: First request may take 2-5 seconds

## Migration from Containerized

If migrating from Docker Compose to Vercel:

1. Remove WebSocket/SSE code from frontend (replace with `/poll`)
2. Update async task endpoints to handle 503 responses if queue not configured
3. Test locally with `QUEUE_PROVIDER=mock` first
4. Deploy to Vercel preview environment before production

## Troubleshooting

### Function Size Exceeds 250MB

If a function exceeds Vercel's limit:
- Verify `api/{function}/requirements.txt` only contains necessary dependencies
- Heavy dependencies like `docling[vlm]`, `pandas`, `celery` are excluded from serverless functions
- Use `.vercelignore` to exclude unnecessary files from deployment
- Check `backend/services/` for accidental heavy imports (should use lazy loading)

### Queue Tasks Not Processing

- Verify `QUEUE_PROVIDER` is set correctly
- Check queue credentials (AWS SQS URL, Azure connection string)
- Use mock queue for development: `QUEUE_PROVIDER=mock`

### Auth Errors

- Verify `GOOGLE_APPLICATION_CREDENTIALS` is set
- Check Firebase project ID matches
- For testing, you can set `FIREBASE_REQUIRED=false` (no auth)
