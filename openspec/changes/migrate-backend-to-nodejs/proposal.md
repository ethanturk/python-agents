# Proposal: Migrate Backend Functions from Python to Node.js

## Summary
Migrate the four serverless backend API functions (agent, documents, summaries, notifications) from Python (FastAPI) to Node.js, while keeping the Python async worker (Celery tasks) unchanged. This provides a unified TypeScript stack with the frontend and enables better developer experience while preserving CPU-bound Python worker functionality.

## Motivation
- **Unified TypeScript Stack**: Frontend (Next.js) and backend functions in the same language reduces context switching
- **Better Vercel Integration**: Node.js serverless functions have better cold start performance and first-class Vercel support
- **Developer Experience**: Single language for full-stack development simplifies onboarding and maintenance
- **Smaller Deployment Packages**: Node.js dependencies are typically smaller than Python's heavy scientific stack (docling, pandas)
- **Faster Cold Starts**: Node.js functions start faster than Python in Vercel's serverless environment
- **Future Modernization**: Enables migration to modern patterns like Server Actions and Edge Functions

## Goals
1. Migrate agent_app.py to Node.js serverless function
2. Migrate documents_app.py to Node.js serverless function
3. Migrate summaries_app.py to Node.js serverless function
4. Migrate notifications_app.py to Node.js serverless function
5. Maintain 100% API compatibility with existing Python endpoints
6. Keep Python async worker (Celery tasks) unchanged for document ingestion and summarization
7. Ensure all authentication (Firebase) works identically
8. Preserve integration with external queue service for async tasks
9. Maintain database compatibility (Supabase vector DB, SQLite summaries)
10. Test all endpoints to ensure parity with Python implementation

## Non-Goals
- Migrating the Python async worker (Celery) to Node.js
- Changing the async worker implementation or behavior
- Modifying the frontend or changing its API usage
- Changing the database schemas or Supabase RPC functions
- Modifying the queue service interface or communication protocol

## Success Criteria
- All four Node.js serverless functions deploy successfully to Vercel
- Frontend can authenticate and use all endpoints without modification
- Document upload, search, and summarization workflows work identically
- Integration with Python async worker via queue service functions correctly
- All existing tests pass against Node.js endpoints
- API response formats match Python implementation byte-for-byte
- Error handling and edge cases behave identically
- No performance regression for critical operations

## Related Changes
- split-backend-serverless - Backend is already split into serverless functions
- implement-azure-queue-worker - Backend uses Azure Queue for async tasks (Python worker)

## Out of Scope
- Python async worker (Celery tasks remain in Python)
- Backend service layer logic (ingestion, summarization) - consumed by worker
- Any changes to queue service implementation
