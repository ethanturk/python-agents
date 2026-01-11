# Tasks: Split Backend API into Serverless Functions

## Phase 1: Foundation (No Breaking Changes)

### 1. Create shared common layer
- [ ] Create `backend/common/` directory
- [ ] Extract `config.py` to `backend/common/config.py`
- [ ] Extract `auth.py` to `backend/common/auth.py`
- [ ] Extract `api/models.py` to `backend/common/models.py`
- [ ] Create `backend/common/deps.py` for shared dependencies
- [ ] Write tests for common utilities
- [ ] Validate: All imports work from existing `backend_app.py`

### 2. Create domain-specific app files
- [ ] Create `backend/agent_app.py` with agent endpoints
  - [ ] Copy `/health` endpoint
  - [ ] Copy `/agent/sync` endpoint
  - [ ] Copy `/agent/async` endpoint (modify for queue service)
  - [ ] Copy `/agent/status/{task_id}` endpoint (modify for queue service)
  - [ ] Copy `/agent/search` endpoint
- [ ] Create `backend/documents_app.py` with document endpoints
  - [ ] Copy `/agent/upload` endpoint
  - [ ] Copy `/agent/documents` endpoint
  - [ ] Copy `/agent/documentsets` endpoint
  - [ ] Copy `/agent/documents/{filename}` endpoint
  - [ ] Copy `/agent/files/{document_set}/{filename}` endpoint
- [ ] Create `backend/summaries_app.py` with summary endpoints
  - [ ] Copy `/agent/summaries` endpoint
  - [ ] Copy `/agent/summary_qa` endpoint
  - [ ] Copy `/agent/search_qa` endpoint
- [ ] Create `backend/notifications_app.py` with notification endpoints
  - [ ] Copy `/poll` endpoint
  - [ ] Copy `/internal/notify` endpoint
- [ ] Validate: Each app file imports from common layer

### 3. Create dependency files for each function
- [ ] Create `backend/requirements-agent.txt` (pydantic-ai, langchain-openai, litellm, supabase)
- [ ] Create `backend/requirements-documents.txt` (fastapi, azure-storage-blob, supabase)
- [ ] Create `backend/requirements-summaries.txt` (fastapi, pydantic-ai, python-dotenv)
- [ ] Create `backend/requirements-notifications.txt` (fastapi, python-dotenv)
- [ ] Validate: Each requirements.txt installs successfully

## Phase 2: Vercel Function Setup

### 4. Create Vercel function entry points
- [ ] Create `api/agent/index.py` wrapping `agent_app.py` with Mangum
- [ ] Create `api/documents/index.py` wrapping `documents_app.py` with Mangum
- [ ] Create `api/summaries/index.py` wrapping `summaries_app.py` with Mangum
- [ ] Create `api/notifications/index.py` wrapping `notifications_app.py` with Mangum
- [ ] Validate: Each function imports correctly

### 5. Configure Vercel routing
- [ ] Create or update `vercel.json` with rewrite rules
  - [ ] `/agent/*` → `api/agent`
  - [ ] `/poll` → `api/notifications`
  - [ ] `/internal/notify` → `api/notifications`
- [ ] Validate: Vercel routing configuration is valid JSON

## Phase 3: Remove Incompatible Features

### 6. Remove WebSocket and SSE endpoints
- [ ] Remove `/ws` endpoint from all apps
- [ ] Remove `/sse` endpoint from all apps
- [ ] Remove `services/websocket.py` dependency
- [ ] Remove `services/sse_manager.py` dependency
- [ ] Validate: No WebSocket/SSE imports remain in domain apps

### 7. Remove Celery dependencies
- [ ] Remove `celery` and `redis` from all requirements files
- [ ] Remove `async_tasks.py` imports from domain apps
- [ ] Add error returns for removed endpoints
  - [ ] `/agent/ingest` → 503 error
  - [ ] `/agent/summarize` → 503 error
- [ ] Validate: No Celery imports remain

## Phase 4: Queue Service Integration

### 8. Create queue service abstraction layer
- [ ] Create `backend/services/queue_service.py` with interface
  - [ ] `submit_task(task_type, payload)`
  - [ ] `get_task_status(task_id)`
  - [ ] `cancel_task(task_id)`
- [ ] Implement AWS SQS adapter (or Azure Queue Storage)
- [ ] Update `/agent/async` to use queue service
- [ ] Update `/agent/status/{task_id}` to use queue service
- [ ] Write unit tests for queue service
- [ ] Validate: Queue operations work end-to-end

### 9. Update file upload to trigger queue tasks
- [ ] Modify `/agent/upload` to submit ingestion task to queue service
- [ ] Update `/internal/notify` to handle queue service webhooks
- [ ] Validate: File upload triggers queue task

### 10. Update summarization to use queue service
- [ ] Create queue handler for summarization tasks
- [ ] Configure queue service to call `/internal/notify` on completion
- [ ] Validate: Summarization task flow works

## Phase 5: Testing and Validation

### 11. Write integration tests for each domain
- [ ] Write tests for agent endpoints (`/agent/sync`, `/agent/search`)
- [ ] Write tests for document endpoints (`/agent/upload`, `/agent/documents`)
- [ ] Write tests for summary endpoints (`/agent/summaries`, `/agent/summary_qa`)
- [ ] Write tests for notification endpoints (`/poll`, `/internal/notify`)
- [ ] Validate: All tests pass

### 12. Size validation
- [ ] Build agent function and measure size (< 250MB)
- [ ] Build documents function and measure size (< 250MB)
- [ ] Build summaries function and measure size (< 250MB)
- [ ] Build notifications function and measure size (< 250MB)
- [ ] Validate: All functions under size limit

### 13. Cold start performance testing
- [ ] Measure cold start time for agent function
- [ ] Measure cold start time for documents function
- [ ] Measure cold start time for summaries function
- [ ] Measure cold start time for notifications function
- [ ] Validate: Cold starts under 5 seconds

### 14. Frontend compatibility testing
- [ ] Test frontend with agent endpoints
- [ ] Test frontend with document upload
- [ ] Test frontend with document search
- [ ] Test frontend with summaries
- [ ] Test frontend with notification polling
- [ ] Validate: All frontend features work

## Phase 6: Documentation and Cleanup

### 15. Update documentation
- [ ] Update AGENTS.md with serverless deployment instructions
- [ ] Update API documentation to reflect removed WebSocket/SSE endpoints
- [ ] Add queue service configuration guide
- [ ] Update environment variable documentation
- [ ] Validate: Documentation is complete and accurate

### 16. Cleanup monolithic code (optional)
- [ ] Mark `backend_app.py` as deprecated for production
- [ ] Keep `backend_app.py` for local development
- [ ] Update Docker files to use domain apps
- [ ] Validate: Local development still works

## Dependencies
- Tasks 1-3 must complete before Phase 2
- Tasks 4-5 must complete before Phase 3
- Tasks 6-7 must complete before Phase 4
- Tasks 8-10 must complete before Phase 5
- Tasks 11-14 must complete before Phase 6

## Parallelizable Work
- Tasks 2 (each domain app can be created in parallel)
- Tasks 3 (each requirements file can be created in parallel)
- Tasks 4 (each Vercel function can be created in parallel)
- Tasks 11 (test suites can be written in parallel)
- Tasks 12-13 (validation can be done in parallel)
