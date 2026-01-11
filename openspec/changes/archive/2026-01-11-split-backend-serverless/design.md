# Design: Serverless Function Architecture

## Current Architecture
```
FastAPI (backend_app.py)
├── Agent endpoints (/agent/*)
├── Document endpoints (/agent/*)
├── Summary endpoints (/agent/*)
├── WebSocket/SSE endpoints (/ws, /sse)
└── Celery async tasks
```

## Proposed Architecture

### Domain Separation
```
Vercel Functions
├── api/agent/         (Agent domain)
│   ├── POST /agent/sync
│   ├── POST /agent/async (redirects to queue service)
│   ├── GET /agent/status/{task_id} (polls queue service)
│   └── POST /agent/search
├── api/documents/     (Documents domain)
│   ├── POST /agent/upload
│   ├── GET /agent/documents
│   ├── GET /agent/documentsets
│   ├── DELETE /agent/documents/{filename}
│   └── GET /agent/files/{document_set}/{filename}
├── api/summaries/     (Summaries domain)
│   ├── GET /agent/summaries
│   ├── POST /agent/summary_qa
│   ├── POST /agent/search_qa
│   └── POST /agent/summarize (redirects to queue service)
└── api/notifications/ (Notifications domain)
    ├── GET /poll
    └── POST /internal/notify (webhook from queue service)
```

### Dependency Organization

#### Shared Layer (`backend/common/`)
```python
common/
├── config.py          # Configuration management
├── auth.py            # Firebase authentication
├── models.py          # Pydantic request/response models
└── deps.py            # Shared dependencies (headers, validation)
```

#### Agent Function (`api/agent/`)
```python
# Dependencies
- pydantic-ai
- langchain-openai
- litellm
- supabase

# Excluded
- celery
- docling
- pandas (not needed for agent operations)
```

#### Documents Function (`api/documents/`)
```python
# Dependencies
- fastapi
- azure-storage-blob
- supabase

# Excluded
- pydantic-ai (not needed for document listing)
- docling (ingestion moved to queue service)
```

#### Summaries Function (`api/summaries/`)
```python
# Dependencies
- fastapi
- pydantic-ai
- supabase
- python-dotenv

# Excluded
- azure-storage-blob (not needed for cached summaries)
- celery
```

#### Notifications Function (`api/notifications/`)
```python
# Dependencies
- fastapi
- python-dotenv

# Excluded
- All heavy dependencies (minimal polling endpoint)
```

## Async Task Strategy

### External Queue Service Integration
Replace Celery with a cloud-native queue service (AWS SQS, Azure Queue Storage, or similar):

```
Current: FastAPI → RabbitMQ → Celery Worker → LLM/DB
Proposed: Vercel Function → Queue Service → Vercel Function (worker)
```

### Queue Service Responsibilities
1. **Task Submission**: Vercel functions submit tasks to queue
2. **Task Processing**: Separate Vercel functions process tasks as workers
3. **Status Polling**: Client polls queue service for task status
4. **Webhook Notifications**: Queue service calls `/internal/notify` on completion

### Removed Features
- **WebSocket (`/ws`)**: Not supported by Vercel
- **SSE (`/sse`)**: Not supported by Vercel, replaced with `/poll`
- **Celery**: Not compatible with serverless, replaced with queue service
- **Embedded Worker**: Only applicable to containerized deployments

## Request Routing

### API Gateway Pattern
Each domain function serves as its own API gateway:

```python
# api/agent/index.py
from mangum import Mangum
from agent_app import app

handler = Mangum(app, lifespan="off")

# Route pattern: /api/agent/* → api/agent/index.py
```

### Path Rewriting
Existing `APIPathPrefixMiddleware` will handle path rewriting for each function independently.

## Data Flow

### Document Upload (Current Approach - Preserved)
```
Frontend → api/documents/upload → Azure Storage → Queue Service
        ↓
    Vector DB (processed by queue worker)
```

### Agent Query
```
Frontend → api/agent/search → Supabase Vector DB → LLM → Response
```

### Notification Polling
```
Frontend → api/notifications/poll → In-memory Queue → Response
```

## Trade-offs

### Pros
- **Smaller bundle sizes**: Each function only includes required dependencies
- **Independent scaling**: Agent function can scale differently from documents
- **Faster cold starts**: Fewer dependencies to import on startup
- **Clear boundaries**: Domains are isolated, reducing coupling

### Cons
- **More deployment targets**: 4 functions instead of 1 monolith
- **Shared code duplication**: Some utilities may need to be duplicated
- **Increased complexity**: More files and functions to maintain
- **No WebSockets**: Real-time features limited to polling

## Implementation Considerations

### Shared Code Management
- Use `backend/common/` for shared utilities
- Each function copies common code during deployment
- Consider using Vercel Lambda Layers if sharing becomes problematic

### Environment Variables
- Each function reads from `config.py`
- No changes needed to existing `.env` structure

### Database Connections
- Use connection pooling with external services (Supabase, Queue Service)
- Close connections in `lifespan` shutdown

### Error Handling
- Maintain current error response format
- Add specific errors for removed features (WebSockets, Celery)

## Migration Strategy

### Phase 1: Prepare (No Breaking Changes)
1. Create `backend/common/` with shared code
2. Create separate FastAPI apps for each domain
3. Keep monolithic `backend_app.py` for local development

### Phase 2: Deploy Serverless
1. Deploy domain functions to Vercel
2. Update frontend API URLs to point to Vercel
3. Keep containerized deployment for development

### Phase 3: Cleanup
1. Remove removed features (WebSocket, Celery) from codebase
2. Update documentation
3. Deprecate monolithic `backend_app.py` (optional)
