# Design: Migrate Backend Functions from Python to Node.js

## Architecture Overview

### Current Architecture (Python)
```
Frontend (Next.js) → Python Serverless Functions (Vercel) → Queue Service → Python Worker (Celery)
                      ├─ agent_app.py (FastAPI)             ├─ ingest_docs_task
                      ├─ documents_app.py (FastAPI)         ├─ summarize_document_task
                      ├─ summaries_app.py (FastAPI)         └─ check_knowledge_base
                      └─ notifications_app.py (FastAPI)
```

### Target Architecture (Node.js + Python Worker)
```
Frontend (Next.js) → Node.js Serverless Functions (Vercel) → Queue Service → Python Worker (Celery)
                      ├─ agent (Express/Fastify)                         ├─ ingest_docs_task
                      ├─ documents (Express/Fastify)                     ├─ summarize_document_task
                      ├─ summaries (Express/Fastify)                     └─ check_knowledge_base
                      └─ notifications (Express/Fastify)
```

## Key Decisions

### 1. Framework Choice: Express vs Fastify
**Decision: Use Fastify**

Rationale:
- Faster performance than Express (better for serverless cold starts)
- Built-in JSON schema validation
- TypeScript-first design
- Smaller bundle size
- Async/await support out of the box

Alternatives considered:
- **Express**: Larger ecosystem, but slower and no built-in TypeScript
- **Hono**: Edge-optimized, but less mature ecosystem
- **NestJS**: Too heavy for serverless functions

### 2. Database Access Pattern
**Decision: Direct Supabase client + RPC calls**

The Node.js functions will:
- Use `@supabase/supabase-js` for direct Supabase access
- Call the existing `match_documents` RPC function for vector search
- Access SQLite summaries via direct file access or simple query API

Python services (`vector_db.py`, `supabase_service.py`) are NOT ported because:
- They are primarily consumed by the Python worker
- Worker remains in Python, so it continues to use these services
- Node.js functions access Supabase directly via client library

### 3. Authentication: Firebase Admin SDK
**Decision: Port Firebase authentication to Node.js**

Node.js will use `firebase-admin` for token verification, maintaining:
- Same JWT verification logic
- Same `get_current_user` middleware pattern
- Same error responses for invalid tokens

### 4. File Storage: Azure Storage SDK
**Decision: Port Azure Storage operations to Node.js**

Node.js will use `@azure/storage-blob` for:
- Uploading files to Azure Storage
- Downloading files (proxy endpoint)
- Managing blob containers

### 5. Queue Service Integration
**Decision: Maintain HTTP interface to external queue**

The queue service (`services/queue_service.py`) is NOT ported to Node.js. Instead:
- Node.js functions will call the queue service's HTTP endpoints
- Python worker consumes from the queue
- Queue service remains as an abstraction layer

Rationale: Queue service is an abstraction that could use different providers (mock, SQS, Azure Queue). Node.js functions don't need to know implementation details.

## Component Mapping

### Python → Node.js Mapping

| Python Module | Node.js Equivalent | Notes |
|--------------|-------------------|-------|
| `agent_app.py` | `api/agent/index.ts` | Migrate sync/async/search endpoints |
| `documents_app.py` | `api/documents/index.ts` | Migrate upload/list/delete/file proxy |
| `summaries_app.py` | `api/summaries/index.ts` | Migrate summarize/summary_qa/search_qa |
| `notifications_app.py` | `api/notifications/index.ts` | Migrate poll/internal/notify |
| `auth.py` | `common/auth.ts` | Port Firebase verification |
| `config.py` | `common/config.ts` | Port environment variable handling |
| `models.py` | `common/types.ts` | Port Pydantic models to TypeScript interfaces |

### Python Services (NOT Migrated - Used by Worker)

| Python Module | Why Not Migrated |
|--------------|------------------|
| `services/ingestion.py` | CPU-bound document processing, used by worker |
| `services/llm.py` | LLM client, used by worker for summarization |
| `services/vector_db.py` | Vector DB wrapper, used by worker for indexing |
| `services/file_management.py` | File I/O, used by worker |
| `services/azure_storage.py` | File storage, used by worker |
| `services/supabase_service.py` | Supabase REST client, used by worker |

## Data Flow

### Document Upload Workflow
```
Frontend → Node.js documents API
  1. Validate upload (sanitization)
  2. Save to Azure Storage
  3. Submit task to queue service (HTTP)
  4. Queue → Python worker (ingest_docs_task)
  5. Worker processes, indexes in Supabase
  6. Worker completes → Queue → Notify endpoint (Node.js)
  7. Node.js saves summary to SQLite
  8. Node.js queues notification for polling
```

### Search Workflow (RAG)
```
Frontend → Node.js agent API (/agent/search)
  1. Call Supabase match_documents RPC
  2. Return vector search results
  3. No queue/worker needed (sync operation)
```

### Sync Agent Workflow
```
Frontend → Node.js agent API (/agent/sync)
  1. Call OpenAI API directly (via LangChain or direct client)
  2. Return LLM response
  3. No queue/worker needed
```

## Error Handling Strategy

### Consistent Error Responses
All Node.js functions will return errors in the same format as Python:
```typescript
{
  "detail": "Error message description"
}
```

### Error Codes
- 400: Bad request (validation errors)
- 401: Unauthorized (invalid Firebase token)
- 404: Not found (document not in DB)
- 500: Internal server error (unexpected failures)
- 503: Service unavailable (queue service down, storage unavailable)

### Logging
Node.js functions will use structured logging:
```typescript
logger.info({ action: "upload", filename, documentSet });
logger.error({ action: "upload", error: error.message, stack: error.stack });
```

## Security Considerations

### Authentication
- Firebase Admin SDK token verification
- Same token validation rules as Python
- Token caching for performance

### Input Validation
- Validate filenames and document sets against the same sanitization rules
- File size limits (enforced by Azure Storage)
- Type validation for all API inputs

### Secrets Management
- Environment variables in Vercel (same as Python)
- No secrets in code
- Azure Storage connection string from environment

### CORS
- Configure CORS in Vercel (not in code)
- Allow frontend domain(s) only

## Deployment Strategy

### Phase 1: Set Up Node.js Functions
1. Create `api/agent`, `api/documents`, `api/summaries`, `api/notifications` directories
2. Install dependencies (`fastify`, `@supabase/supabase-js`, `firebase-admin`, etc.)
3. Set up TypeScript configuration

### Phase 2: Migrate One Function at a Time
1. Start with `notifications` (simplest, no DB dependencies)
2. Then `agent` (LLM API + vector search)
3. Then `summaries` (SQLite + vector search)
4. Finally `documents` (file upload + Azure Storage)

### Phase 3: Testing & Validation
1. Run tests against Node.js functions
2. Verify frontend integration
3. Load test for performance parity
4. Monitor cold start times

### Phase 4: Deployment & Cutover
1. Deploy to Vercel preview environment
2. Validate end-to-end workflows
3. Deploy to production
4. Monitor for issues

## Dependencies

### New Node.js Dependencies
```json
{
  "fastify": "^4.24.0",
  "@supabase/supabase-js": "^2.38.0",
  "firebase-admin": "^12.0.0",
  "@azure/storage-blob": "^12.17.0",
  "langchain": "^0.1.0",
  "@langchain/openai": "^0.0.14",
  "openai": "^4.20.0",
  "pydantic-ai": "^0.0.2"
}
```

### Dependencies to Remove
- All Python serverless function files (agent_app.py, documents_app.py, summaries_app.py, notifications_app.py)
- Python-specific middleware and dependencies

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Incompatible Supabase RPC behavior | Test thoroughly with vector search queries |
| LLM library differences | Use same underlying OpenAI API (langchain/openai) |
| TypeScript type errors | Strict type checking during development |
| Cold start regression | Benchmark before/after, use Fastify for performance |
| Firebase Admin SDK differences | Test token verification with sample tokens |
| Queue service communication changes | Document HTTP interface, validate integration |
| SQLite access differences | Use direct file access or query API |
| Azure Storage SDK differences | Test upload/download with sample files |

## Open Questions

1. **SQLite Access**: Should Node.js directly access the SQLite file, or should we create a query API?
   - **Recommendation**: Direct file access is simpler for a single file database. Use `better-sqlite3` package.

2. **LLM Library**: Should we use LangChain for Node.js or direct OpenAI SDK?
   - **Recommendation**: Use direct OpenAI SDK for simplicity, as we're only using chat completions (not chains).

3. **Vector Search**: Should we use Supabase client or raw PostgreSQL client?
   - **Recommendation**: Supabase client is simpler and already has RPC support built-in.

4. **Error Logging**: Should we use a logging library (pino, winston) or console?
   - **Recommendation**: Use pino for structured logging (fast, production-ready).

## Performance Targets

| Metric | Python Baseline | Node.js Target |
|--------|-----------------|----------------|
| Cold start time | ~500-1000ms | ~200-400ms |
| Sync agent response | ~2-5s | ~2-5s (same LLM) |
| Document upload (excluding worker) | ~1-2s | ~1-2s |
| Vector search | ~100-200ms | ~100-200ms (same DB) |
| Bundle size per function | ~20-30MB | ~5-10MB |
