# Tasks for Optimize Serverless Dependencies

## 1. Create Minimal Requirements Files
- [x] Create `api/agent/requirements.txt` with agent-specific dependencies
- [x] Create `api/documents/requirements.txt` with documents-specific dependencies
- [x] Create `api/summaries/requirements.txt` with summaries-specific dependencies
- [x] Create `api/notifications/requirements.txt` with notifications-specific dependencies
- [x] Validate each requirements.txt installs successfully

## 2. Refactor Common Module for Lazy Imports
- [x] Update `backend/common/__init__.py` to use lazy imports for optional dependencies
- [x] Move `get_current_user` to use conditional import with graceful fallback
- [x] Ensure config exports don't trigger heavy dependency loads
- [x] Test common module imports without installing full requirements

## 3. Isolate Agent Function
- [x] Move agent-specific models to `api/agent/models.py`
- [x] Create minimal agent service wrapper in `api/agent/service.py`
- [x] Update `api/agent/index.py` to use isolated code
- [x] Test agent endpoints with minimal dependencies only

## 4. Isolate Documents Function
- [x] Move documents-specific models to `api/documents/models.py`
- [x] Create minimal documents service wrapper in `api/documents/service.py`
- [x] Update `api/documents/index.py` to use isolated code
- [x] Test documents endpoints with minimal dependencies only

## 5. Isolate Summaries Function
- [x] Move summaries-specific models to `api/summaries/models.py`
- [x] Create minimal summaries service wrapper in `api/summaries/service.py`
- [x] Update `api/summaries/index.py` to use isolated code
- [x] Verify run_qa_agent uses only pydantic-ai Agent (not litellm embeddings)
- [x] Test summaries endpoints with minimal dependencies only

## 6. Isolate Notifications Function
- [x] Move notifications-specific models to `api/notifications/models.py`
- [x] Create minimal notifications implementation in `api/notifications/service.py`
- [x] Update `api/notifications/index.py` to use isolated code
- [x] Test notifications endpoints with minimal dependencies only

## 7. Refactor Backend Services for Conditional Loading
- [x] Update `services/queue_service.py` to lazily load boto3/azure.queue
- [x] Ensure `services/vector_db.py` doesn't load embedding models on import
- [x] Update `services/llm.py` to use lazy initialization
- [x] Test service imports with minimal dependency sets

## 8. Update Vercel Configuration
- [x] Verify `vercel.json` configuration for each function
- [x] Add `.vercelignore` entries to exclude unnecessary files from deployment
- [x] Validate each function's build process

## 9. Integration Testing
- [x] Deploy agent function and verify size < 250MB
- [x] Deploy documents function and verify size < 250MB
- [x] Deploy summaries function and verify size < 250MB
- [x] Deploy notifications function and verify size < 250MB
- [x] Run end-to-end tests for all endpoints
- [x] Verify cold start performance improvements

## 10. Documentation Updates
- [x] Update `README.md` with deployment instructions for minimal dependencies
- [x] Update `SERVERLESS_DEPLOYMENT.md` with dependency requirements
- [x] Document the lazy loading pattern in `AGENTS.md`
