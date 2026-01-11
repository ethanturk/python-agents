# Serverless Deployment Guide

This guide explains how to deploy the backend to Vercel serverless functions.

## Architecture Overview

The backend is split into 4 domain-specific Vercel functions:

| Function | Endpoints | Dependencies | Purpose |
|----------|-----------|--------------|---------|
| `api/agent` | `/agent/sync`, `/agent/async`, `/agent/status`, `/agent/search` | pydantic-ai, langchain-openai, supabase | LLM queries and RAG |
| `api/documents` | `/agent/upload`, `/agent/documents`, `/agent/delete`, `/agent/files` | azure-storage-blob, supabase | File operations |
| `api/summaries` | `/agent/summaries`, `/agent/summary_qa`, `/agent/search_qa` | pydantic-ai, supabase | Cached summaries |
| `api/notifications` | `/poll`, `/internal/notify` | FastAPI only | Notifications (polling) |

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
- Check `requirements-{function}.txt` for unnecessary dependencies
- Use `requirements-vercel.txt` as a starting point
- Remove development dependencies like pytest, black, etc.

### Queue Tasks Not Processing

- Verify `QUEUE_PROVIDER` is set correctly
- Check queue credentials (AWS SQS URL, Azure connection string)
- Use mock queue for development: `QUEUE_PROVIDER=mock`

### Auth Errors

- Verify `GOOGLE_APPLICATION_CREDENTIALS` is set
- Check Firebase project ID matches
- For testing, you can set `FIREBASE_REQUIRED=false` (no auth)
