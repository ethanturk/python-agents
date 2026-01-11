# Design: Serverless Dependency Optimization

## Architecture Overview

### Current Architecture
```
api/agent/index.py → backend/agent_app.py → backend/services/... → all dependencies
api/documents/index.py → backend/documents_app.py → backend/services/... → all dependencies
api/summaries/index.py → backend/summaries_app.py → backend/services/... → all dependencies
api/notifications/index.py → backend/notifications_app.py → backend/services/... → all dependencies
                              ↓
                    backend/requirements.txt (all dependencies)
```

**Problem**: Every function loads all dependencies, including heavy ones like docling[vlm], pandas, celery.

### Target Architecture
```
api/agent/requirements.txt → pydantic-ai, litellm, supabase, nest_asyncio, fastapi
api/agent/index.py → api/agent/service.py → backend/services/agent.py (minimal subset)

api/documents/requirements.txt → fastapi, azure-storage-blob, supabase
api/documents/index.py → api/documents/service.py → backend/services/vector_db.py, azure_storage.py

api/summaries/requirements.txt → pydantic-ai, supabase, fastapi
api/summaries/index.py → api/summaries/service.py → backend/services/agent.py, database.py

api/notifications/requirements.txt → fastapi only
api/notifications/index.py → api/notifications/service.py → (no external deps)
```

## Dependency Matrix

| Dependency | Agent | Documents | Summaries | Notifications |
|------------|-------|-----------|-----------|---------------|
| fastapi | ✓ | ✓ | ✓ | ✓ |
| pydantic-ai | ✓ | ✗ | ✓ | ✗ |
| litellm | ✓ | ✗ | ✓ | ✗ |
| supabase | ✓ | ✓ | ✓ | ✗ |
| nest_asyncio | ✓ | ✗ | ✗ | ✗ |
| azure-storage-blob | ✗ | ✓ | ✗ | ✗ |
| docling[vlm] | ✗ | ✗ | ✗ | ✗ |
| pandas | ✗ | ✗ | ✗ | ✗ |
| celery | ✗ | ✗ | ✗ | ✗ |
| redis | ✗ | ✗ | ✗ | ✗ |
| firebase-admin | Lazy | Lazy | Lazy | Lazy |

## Key Design Decisions

### 1. Lazy Import Pattern
Heavy dependencies (firebase-admin, boto3, azure.queue) should use lazy imports:

```python
# backend/common/auth.py
def get_current_user():
    try:
        import firebase_admin
        from firebase_admin import auth
        # ... implementation
    except ImportError:
        return None  # Graceful degradation
```

### 2. Shared Service Layer
Backend services remain in `backend/services/` but are designed to:
- Import dependencies only when methods are called
- Provide clean interfaces that work with minimal dependencies
- Use dependency injection for optional services

### 3. Function-Specific Wrappers
Each serverless function has a thin wrapper:
- `api/agent/service.py` - Wraps agent services
- `api/documents/service.py` - Wraps document services
- `api/summaries/service.py` - Wraps summary services
- `api/notifications/service.py` - Pure FastAPI implementation

### 4. Minimal Models
Pydantic models are duplicated in each function directory to avoid pulling in the full backend module chain:
- `api/agent/models.py` - AgentRequest, SearchRequest, TaskResponse
- `api/documents/models.py` - UploadFile models, validation types
- `api/summaries/models.py` - SummarizeRequest, SummaryQARequest
- `api/notifications/models.py` - NotificationRequest

## Service Isolation Strategy

### Agent Function
**Imports**: pydantic-ai, litellm, supabase, nest_asyncio
**Exposes**: `/agent/sync`, `/agent/async`, `/agent/status`, `/agent/search`
**Services Used**: `services.agent.perform_rag`, `services.agent.run_sync_agent`

### Documents Function
**Imports**: fastapi, azure-storage-blob, supabase
**Exposes**: `/agent/upload`, `/agent/documents`, `/agent/documentsets`, `/agent/delete`, `/agent/files`
**Services Used**: `services.vector_db`, `services.azure_storage`, `services.file_management`

### Summaries Function
**Imports**: pydantic-ai, supabase, fastapi
**Exposes**: `/agent/summaries`, `/agent/summary_qa`, `/agent/search_qa`, `/agent/summarize`
**Services Used**: `services.agent.run_qa_agent` (uses pydantic-ai Agent, not embeddings), `services.supabase_service` for summary storage

### Notifications Function
**Imports**: fastapi only
**Exposes**: `/poll`, `/internal/notify`
**Services Used**: None (in-memory queue)

## Implementation Considerations

### Code Duplication vs. Dependency Reduction
- **Decision**: Accept minimal code duplication (models, config) to achieve dependency reduction
- **Rationale**: Code duplication is limited to lightweight Pydantic models; heavy business logic remains in shared services

### Authentication Handling
- **Approach**: Lazy import of firebase-admin in common module
- **Fallback**: Return None or raise ImportError if auth not available
- **Note**: Auth is optional for local development; required for production

### Database Services
- **Supabase**: Used by all functions except notifications for vector search and summary storage
- **SQLite**: No longer used; all data storage migrated to Supabase
- **Connections**: Use Supabase client with connection pooling
- **Current**: Queue service supports AWS SQS, Azure Queue, and Mock implementations
- **Lazy Loading**: boto3 and azure.queue imports are deferred until provider is selected
- **Default**: Mock implementation used when no provider configured

### Database Connections
- **Supabase**: Required for all functions except notifications
- **SQLite**: Used by summaries function only (lightweight, built-in)
- **Connections**: Use connection pooling where available

## Migration Path

1. **Phase 1**: Create isolated requirements files without changing code
2. **Phase 2**: Refactor common module for lazy imports
3. **Phase 3**: Create function-specific wrappers
4. **Phase 4**: Test and deploy incrementally
5. **Phase 5**: Remove old backend_app imports from serverless functions

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Comprehensive integration testing before deployment |
| Increased code maintenance burden | Clear documentation of shared vs. isolated code |
| Version drift between functions | Use shared `backend/` services for business logic |
| Deployment complexity | Vercel configuration files for each function |
| SQLite to Supabase migration | Update database module to use Supabase for all summary operations |
