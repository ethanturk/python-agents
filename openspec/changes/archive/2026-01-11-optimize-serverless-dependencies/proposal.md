# Optimize Serverless Dependencies Proposal

## Summary
Refactor serverless functions to use minimal, function-specific dependencies instead of loading all backend dependencies, resolving the 250MB unzipped size limit error.

## Why
Current deployment fails with "Serverless Function has exceeded the unzipped maximum size of 250 MB" error because all functions load all backend dependencies regardless of usage, causing excessive bundle sizes and slow cold starts.

## What Changes
- Split `backend/requirements.txt` into function-specific `requirements.txt` files in each `api/{function}/` directory
- Move shared code to `backend/common/` with lazy imports for optional dependencies
- Extract function-specific logic from backend modules into `api/{function}/` subdirectories
- Create thin wrappers around shared services to minimize imports
- Update configuration loading to avoid importing unused dependencies

## Impact
- Affected specs: agent-function, dependency-management, documents-function, notifications-function, summaries-function
- Affected code: backend/, api/agent/, api/documents/, api/summaries/, api/notifications/

## Problem Statement
The current serverless deployment architecture loads all Python dependencies from `backend/requirements.txt` into each serverless function, including:
- Document processing dependencies (docling[vlm], pypdfium2, pandas, xlrd, openpyxl)
- Task queue dependencies (celery, redis)
- All functions load all dependencies regardless of usage

This causes the "Error: A Serverless Function has exceeded the unzipped maximum size of 250 MB" when deploying to Vercel.

## Proposed Solution
Split dependencies by serverless function, creating minimal dependency sets:

### Agent Function (`api/agent/`)
**Required**: pydantic-ai, litellm, supabase, nest_asyncio, fastapi
**Excluded**: docling, pandas, celery, redis, azure-storage-blob

### Documents Function (`api/documents/`)
**Required**: fastapi, azure-storage-blob, supabase
**Excluded**: pydantic-ai, litellm, docling, pandas, celery

### Summaries Function (`api/summaries/`)
**Required**: pydantic-ai, supabase, fastapi
**Excluded**: litellm, docling, pandas, celery, redis, azure-storage-blob

### Notifications Function (`api/notifications/`)
**Required**: fastapi only
**Excluded**: All AI, storage, and processing dependencies

## Implementation Strategy

### Phase 1: Create Function-Specific Requirements
Create separate `requirements.txt` files in each `api/{function}/` directory with minimal dependencies.

### Phase 2: Refactor Code for Minimal Imports
- Move shared code to `backend/common/` with lazy imports for optional dependencies
- Update service modules to only import what they need
- Ensure authentication imports are optional with graceful fallback

### Phase 3: Isolate Function Logic
- Extract function-specific code from backend modules into `api/{function}/` subdirectories
- Create thin wrappers around shared services
- Use conditional imports for heavy dependencies

### Phase 4: Test and Validate
- Deploy each function independently to verify size constraints
- Test all endpoints to ensure functionality is preserved
- Verify cold start performance improvements

## Trade-offs
- **Pros**: Reduced bundle size, faster cold starts, cleaner separation of concerns
- **Cons**: More files to maintain, potential code duplication (mitigated by shared `common/` module)

## Dependencies
- Requires changes to all four serverless functions
- Updates to shared backend code for lazy loading patterns
- Vercel deployment configuration validation

## Success Criteria
- Each serverless function unzipped size < 250MB
- All existing functionality preserved
- No regression in endpoint behavior
