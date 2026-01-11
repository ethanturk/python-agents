# Tasks: Split Backend API into Serverless Functions

## Phase 1: Foundation (No Breaking Changes)

### 1. Create shared common layer
- [x] Create `backend/common/` directory
- [x] Extract `config.py` to `backend/common/config.py`
- [x] Extract `auth.py` to `backend/common/auth.py`
- [x] Extract `api/models.py` to `backend/common/models.py`
- [x] Create `backend/common/deps.py` for shared dependencies
- [x] Write tests for common utilities
- [x] Validate: All imports work from existing `backend_app.py`

### 2. Create domain-specific app files
- [x] Create `backend/agent_app.py` with agent endpoints
  - [x] Copy `/health` endpoint
  - [x] Copy `/agent/sync` endpoint
  - [x] Copy `/agent/async` endpoint (modify for queue service)
  - [x] Copy `/agent/status/{task_id}` endpoint (modify for queue service)
  - [x] Copy `/agent/search` endpoint
- [x] Create `backend/documents_app.py` with document endpoints
  - [x] Copy `/agent/upload` endpoint
  - [x] Copy `/agent/documents` endpoint
  - [x] Copy `/agent/documentsets` endpoint
  - [x] Copy `/agent/documents/{filename}` endpoint
  - [x] Copy `/agent/files/{document_set}/{filename}` endpoint
- [x] Create `backend/summaries_app.py` with summary endpoints
  - [x] Copy `/agent/summaries` endpoint
  - [x] Copy `/agent/summary_qa` endpoint
  - [x] Copy `/agent/search_qa` endpoint
- [x] Create `backend/notifications_app.py` with notification endpoints
  - [x] Copy `/poll` endpoint
  - [x] Copy `/internal/notify` endpoint
- [x] Validate: Each app file imports from common layer

### 3. Create dependency files for each function
- [x] Create `backend/requirements-agent.txt` (pydantic-ai, langchain-openai, litellm, supabase)
- [x] Create `backend/requirements-documents.txt` (fastapi, azure-storage-blob, supabase)
- [x] Create `backend/requirements-summaries.txt` (fastapi, pydantic-ai, python-dotenv)
- [x] Create `backend/requirements-notifications.txt` (fastapi, python-dotenv)
- [x] Validate: Each requirements.txt installs successfully

## Phase 2: Vercel Function Setup

### 4. Create Vercel function entry points
- [x] Create `api/agent/index.py` wrapping `agent_app.py` with Mangum
- [x] Create `api/documents/index.py` wrapping `documents_app.py` with Mangum
- [x] Create `api/summaries/index.py` wrapping `summaries_app.py` with Mangum
- [x] Create `api/notifications/index.py` wrapping `notifications_app.py` with Mangum
- [x] Validate: Each function imports correctly

### 5. Configure Vercel routing
- [x] Create or update `vercel.json` with rewrite rules
  - [x] `/agent/*` → `api/agent`
  - [x] `/poll` → `api/notifications`
  - [x] `/internal/notify` → `api/notifications`
- [x] Validate: Vercel routing configuration is valid JSON

## Phase 3: Remove Incompatible Features

### 6. Remove WebSocket and SSE endpoints
- [x] Remove `/ws` endpoint from all apps (never added to domain apps)
- [x] Remove `/sse` endpoint from all apps (never added to domain apps)
- [x] Remove `services/websocket.py` dependency (not used in domain apps)
- [x] Remove `services/sse_manager.py` dependency (not used in domain apps)
- [x] Validate: No WebSocket/SSE imports remain in domain apps

### 7. Remove Celery dependencies
- [x] Remove `celery` and `redis` from all requirements files
- [x] Remove `async_tasks.py` imports from domain apps (not used)
- [x] Add error returns for removed endpoints
  - [x] `/agent/ingest` → 503 error
  - [x] `/agent/summarize` → 503 error (updated to use queue)
- [x] Validate: No Celery imports remain

## Phase 4: Queue Service Integration

### 8. Create queue service abstraction layer
- [x] Create `backend/services/queue_service.py` with interface
  - [x] `submit_task(task_type, payload)`
  - [x] `get_task_status(task_id)`
  - [x] `cancel_task(task_id)`
- [x] Implement AWS SQS adapter (or Azure Queue Storage)
- [x] Update `/agent/async` to use queue service
- [x] Update `/agent/status/{task_id}` to use queue service
- [x] Write unit tests for queue service
- [x] Validate: Queue operations work end-to-end

### 9. Update file upload to trigger queue tasks
- [x] Modify `/agent/upload` to submit ingestion task to queue service
- [x] Update `/internal/notify` to handle queue service webhooks
- [x] Validate: File upload triggers queue task

### 10. Update summarization to use queue service
- [x] Create queue handler for summarization tasks
- [x] Configure queue service to call `/internal/notify` on completion
- [x] Validate: Summarization task flow works

## Phase 5: Testing and Validation

### 11. Write integration tests for each domain
- [x] Write tests for agent endpoints (`/agent/sync`, `/agent/search`)
- [x] Write tests for document endpoints (`/agent/upload`, `/agent/documents`)
- [x] Write tests for summary endpoints (`/agent/summaries`, `/agent/summary_qa`)
- [x] Write tests for notification endpoints (`/poll`, `/internal/notify`)
- [x] Validate: All tests pass

### 12. Size validation
- [x] Build agent function and measure size (< 250MB)
- [x] Build documents function and measure size (< 250MB)
- [x] Build summaries function and measure size (< 250MB)
- [x] Build notifications function and measure size (< 250MB)
- [x] Validate: All functions under size limit

### 13. Cold start performance testing
- [x] Measure cold start time for agent function
- [x] Measure cold start time for documents function
- [x] Measure cold start time for summaries function
- [x] Measure cold start time for notifications function
- [x] Validate: Cold starts under 5 seconds

### 14. Frontend compatibility testing
- [x] Test frontend with agent endpoints
- [x] Test frontend with document upload
- [x] Test frontend with document search
- [x] Test frontend with summaries
- [x] Test frontend with notification polling
- [x] Validate: All frontend features work

## Phase 6: Documentation and Cleanup

### 15. Update documentation
- [x] Update AGENTS.md with serverless deployment instructions
- [x] Update API documentation to reflect removed WebSocket/SSE endpoints
- [x] Add queue service configuration guide (SERVERLESS_DEPLOYMENT.md)
- [x] Update environment variable documentation
- [x] Validate: Documentation is complete and accurate

### 16. Cleanup monolithic code (optional)
- [ ] Mark `backend_app.py` as deprecated for production
- [x] Keep `backend_app.py` for local development
- [ ] Update Docker files to use domain apps
- [x] Validate: Local development still works

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
