# Tasks: Migrate Backend Functions from Python to Node.js

## Phase 1: Project Setup

### 1. Create Node.js serverless function structure
- [x] Create `api/agent/` directory with `index.ts` and `package.json`
- [x] Create `api/documents/` directory with `index.ts` and `package.json`
- [x] Create `api/summaries/` directory with `index.ts` and `package.json`
- [x] Create `api/notifications/` directory with `index.ts` and `package.json`
- [x] Create `backend-nodejs/common/` directory for shared utilities
- [x] Validate: Directory structure matches Vercel serverless conventions

### 2. Configure TypeScript for serverless functions
- [x] Create root `tsconfig.json` for monorepo TypeScript configuration
- [x] Configure path aliases for common utilities (`@common/*`)
- [x] Set target to ES2020 and module to ESNext
- [x] Enable strict mode for type safety
- [x] Validate: TypeScript compiles without errors

### 3. Install Node.js dependencies
- [x] Install Fastify in all function directories
- [x] Install `@supabase/supabase-js` for database access
- [x] Install `firebase-admin` for authentication
- [x] Install `@azure/storage-blob` for file storage
- [x] Install `openai` for LLM API
- [x] Install `sql.js` for SQLite access (changed from better-sqlite3 for serverless compatibility)
- [x] Install `pino` for logging
- [x] Validate: All packages install successfully in each function

### 4. Set up shared common utilities
- [x] Create `backend-nodejs/common/config.ts` for environment variables
- [x] Create `backend-nodejs/common/auth.ts` for Firebase token verification
- [x] Create `backend-nodejs/common/types.ts` for TypeScript interfaces
- [x] Create `backend-nodejs/common/logger.ts` for pino logger instance
- [x] Validate: Common utilities import correctly in all functions

### 5. Create API utility functions
- [x] Create Supabase client wrapper in `backend-nodejs/common/supabase.ts`
- [x] Create Azure Storage client wrapper in `backend-nodejs/common/azure.ts`
- [x] Create queue service HTTP client in `backend-nodejs/common/queue.ts`
- [x] Create SQLite database access in `backend-nodejs/common/database.ts`
- [x] Validate: Utility functions can be imported and used

### 6. Configure environment variables
- [x] Document all required environment variables in each function's README
- [x] Create `.env.example` files for local development
- [x] Ensure compatibility with existing Python environment variables
- [x] Validate: Environment variables load correctly

## Phase 2: Migrate Notifications Function

### 7. Implement notifications endpoint structure
- [x] Create Vercel serverless function in `api/notifications/index.ts`
- [x] Add `/health` endpoint
- [x] Implement Firebase authentication middleware (auth utilities ready)
- [x] Validate: Health endpoint responds correctly

### 8. Implement notification queue
- [x] Create in-memory notification queue class in `backend-nodejs/common/notifications.ts`
- [x] Implement `push` method for adding messages
- [x] Implement `get_since` method for long-polling
- [x] Add async locking mechanism
- [x] Validate: Queue stores and retrieves messages correctly

### 9. Implement poll endpoint
- [x] Add `/poll` GET endpoint
- [x] Implement long-polling logic with 20s timeout
- [x] Support `since_id` query parameter
- [x] Return messages in correct format
- [x] Validate: Poll endpoint returns new messages or empty array

### 10. Implement notify endpoint
- [x] Add `/internal/notify` POST endpoint
- [x] Validate notification request structure
- [x] Save summary to SQLite for completed summarizations
- [x] Push notification to queue
- [x] Validate: Notify endpoint saves summaries and queues notifications

### 11. Test notifications function
- [ ] Write unit tests for notification queue
- [ ] Write integration tests for poll/notify endpoints
- [ ] Test authentication with valid/invalid tokens
- [ ] Test long-polling behavior
- [ ] Validate: All tests pass

## Phase 3: Migrate Agent Function

### 12. Implement agent endpoint structure
- [x] Create Vercel serverless function in `api/agent/index.ts`
- [x] Add `/health` endpoint
- [x] Implement Firebase authentication middleware (auth utilities ready)
- [x] Validate: Health endpoint responds correctly

### 13. Implement sync agent endpoint
- [x] Add `/agent/sync` POST endpoint
- [x] Initialize OpenAI client with configuration
- [x] Implement LLM prompt call
- [x] Return response in correct format
- [x] Validate: Sync endpoint returns LLM response

### 14. Implement async agent endpoints
- [x] Add `/agent/async` POST endpoint
- [x] Submit task to queue service via HTTP
- [x] Return task_id to client
- [x] Add `/agent/status/{task_id}` GET endpoint
- [x] Query queue service for task status
- [x] Validate: Async endpoints submit and track tasks correctly

### 15. Implement search endpoint (RAG)
- [x] Add `/agent/search` POST endpoint
- [x] Call Supabase `match_documents` RPC function
- [x] Pass query embedding, threshold, count, and document_set
- [x] Return formatted search results
- [x] Validate: Search returns relevant documents with similarity scores

### 16. Test agent function
- [ ] Write unit tests for sync agent endpoint
- [ ] Write integration tests for async agent endpoints
- [ ] Write tests for search/RAG endpoint
- [ ] Test authentication with valid/invalid tokens
- [ ] Validate: All tests pass

## Phase 4: Migrate Summaries Function

### 17. Implement summaries endpoint structure
- [x] Create Vercel serverless function in `api/summaries/index.ts`
- [x] Add `/health` endpoint
- [x] Implement Firebase authentication middleware (auth utilities ready)
- [x] Initialize SQLite database connection
- [x] Validate: Health endpoint and database connection work

### 18. Implement get summaries endpoint
- [x] Add `/agent/summaries` GET endpoint
- [x] Query SQLite for all summaries
- [x] Return formatted summary list
- [x] Validate: Returns all stored summaries

### 19. Implement summary QA endpoint
- [x] Add `/agent/summary_qa` POST endpoint
- [x] Query SQLite for specific summary
- [x] Call LLM with summary as context
- [x] Return QA response
- [x] Validate: QA uses correct summary context

### 20. Implement search QA endpoint
- [x] Add `/agent/search_qa` POST endpoint
- [x] Format search results as context string
- [x] Call LLM with search context
- [x] Return QA response
- [x] Validate: QA uses search results as context

### 21. Implement summarize endpoint
- [x] Add `/agent/summarize` POST endpoint
- [x] Submit summarization task to queue service
- [x] Return task_id and webhook URL
- [x] Validate: Task submission works correctly

### 22. Test summaries function
- [ ] Write unit tests for all endpoints
- [ ] Write integration tests for SQLite operations
- [ ] Test authentication with valid/invalid tokens
- [ ] Validate: All tests pass

## Phase 5: Migrate Documents Function

### 23. Implement documents endpoint structure
- [x] Create Vercel serverless function in `api/documents/index.ts`
- [x] Add `/health` endpoint
- [x] Implement Firebase authentication middleware (auth utilities ready)
- [x] Validate: Health endpoint responds correctly

### 24. Implement list documents endpoint
- [x] Add `/agent/documents` GET endpoint
- [x] Query Supabase for distinct filenames
- [x] Format results with id, filename, document_set, chunk_count
- [x] Validate: Returns correct document list

### 25. Implement list document sets endpoint
- [x] Add `/agent/documentsets` GET endpoint
- [x] Query Supabase for distinct document sets
- [x] Return formatted list
- [x] Validate: Returns all document sets

### 26. Implement upload endpoint
- [x] Add `/agent/upload` POST endpoint
- [x] Parse multipart/form-data (files + document_set)
- [x] Validate and sanitize document_set
- [x] Upload files to Azure Storage
- [x] Submit ingestion tasks to queue service
- [x] Validate: Upload saves files and queues tasks

### 27. Implement delete endpoint
- [x] Add `/agent/documents/{filename}` DELETE endpoint
- [x] Delete file from Azure Storage
- [x] Delete documents from Supabase (vector DB)
- [x] Validate: File and documents are removed

### 28. Implement file proxy endpoint
- [x] Add `/agent/files/{document_set}/{filename}` GET endpoint
- [x] Download file from Azure Storage
- [x] Set correct Content-Type header
- [x] Return file content
- [x] Validate: File downloads with correct content type

### 29. Test documents function
- [ ] Write unit tests for all endpoints
- [ ] Write integration tests for file upload/delete
- [ ] Test authentication with valid/invalid tokens
- [ ] Validate: All tests pass

## Phase 6: Integration Testing

### 30. Set up integration test environment
- [ ] Create test environment configuration
- [ ] Mock external services (queue, storage, etc.) for testing
- [ ] Set up test data in Supabase and SQLite
- [ ] Validate: Test environment is ready

### 31. Test document upload workflow end-to-end
- [ ] Upload test document via Node.js API
- [ ] Verify file in Azure Storage
- [ ] Verify task submitted to queue
- [ ] Verify notification received after processing
- [ ] Validate: Complete workflow works

### 32. Test search workflow end-to-end
- [ ] Upload test documents (via Python worker)
- [ ] Search via Node.js API
- [ ] Verify search results match expected
- [ ] Validate: Search returns correct results

### 33. Test summarization workflow end-to-end
- [ ] Submit summarization via Node.js API
- [ ] Verify task submitted to queue
- [ ] Verify summary saved to SQLite
- [ ] QA the summary via Node.js API
- [ ] Validate: Complete workflow works

### 34. Compare API responses with Python version
- [ ] Run identical requests against Python and Node.js APIs
- [ ] Compare response structures and formats
- [ ] Compare error responses
- [ ] Fix any inconsistencies
- [ ] Validate: Responses are byte-for-byte identical

## Phase 7: Performance Testing

### 35. Benchmark cold start times
- [ ] Measure cold start for each Node.js function
- [ ] Compare with Python baseline
- [ ] Identify any regressions
- [ ] Optimize if needed
- [ ] Validate: Cold starts meet or exceed targets

### 36. Benchmark API response times
- [ ] Measure response times for all endpoints
- [ ] Compare with Python baseline
- [ ] Identify performance bottlenecks
- [ ] Validate: No performance regression

### 37. Load test critical endpoints
- [ ] Run load tests on search endpoint
- [ ] Run load tests on upload endpoint
- [ ] Monitor for errors and timeouts
- [ ] Validate: System handles load without degradation

## Phase 8: Frontend Integration

### 38. Verify frontend authentication works
- [ ] Test login flow with Node.js backend
- [ ] Verify Firebase tokens are accepted
- [ ] Test protected endpoints with auth
- [ ] Validate: Authentication works seamlessly

### 39. Verify document UI works
- [ ] Test document upload via frontend
- [ ] Test document list view
- [ ] Test document deletion
- [ ] Validate: Document UI functions correctly

### 40. Verify search UI works
- [ ] Test search via frontend
- [ ] Test search results display
- [ ] Test document set filtering
- [ ] Validate: Search UI functions correctly

### 41. Verify summarization UI works
- [ ] Test document summarization via frontend
- [ ] Test summary history view
- [ ] Test summary QA
- [ ] Validate: Summarization UI functions correctly

### 42. Verify notifications work
- [ ] Test notification polling via frontend
- [ ] Verify task completion notifications
- [ ] Verify error notifications
- [ ] Validate: Notifications work seamlessly

## Phase 9: Deployment

### 43. Configure Vercel for Node.js functions
- [ ] Update `vercel.json` for Node.js runtime
- [ ] Configure environment variables for production
- [ ] Set up build commands
- [ ] Validate: Vercel configuration is correct

### 44. Deploy to preview environment
- [ ] Deploy all Node.js functions to Vercel preview
- [ ] Verify all health endpoints respond
- [ ] Run smoke tests against preview deployment
- [ ] Validate: Preview deployment works

### 45. Run full regression tests on preview
- [ ] Execute all integration tests against preview
- [ ] Test all user workflows end-to-end
- [ ] Verify error handling
- [ ] Validate: All tests pass

### 46. Deploy to production
- [ ] Deploy Node.js functions to production
- [ ] Monitor deployment health
- [ ] Verify all endpoints respond
- [ ] Validate: Production deployment successful

### 47. Monitor production for issues
- [ ] Set up monitoring and alerts
- [ ] Monitor error rates
- [ ] Monitor response times
- [ ] Monitor cold start frequencies
- [ ] Validate: No critical issues

## Phase 10: Cleanup

### 48. Update documentation
- [ ] Update AGENTS.md with Node.js development commands
- [ ] Update SERVERLESS_DEPLOYMENT.md for Node.js
- [ ] Document Node.js specific setup and troubleshooting
- [ ] Validate: Documentation is complete

### 49. Archive Python serverless functions
- [ ] Move Python serverless files to `archive/`
- [ ] Update CI/CD to remove Python function builds
- [ ] Update deployment scripts
- [ ] Validate: Old code is properly archived

### 50. Remove Python function dependencies
- [ ] Remove Python serverless-specific packages from requirements
- [ ] Update docker-compose files if needed
- [ ] Clean up unused Python files
- [ ] Validate: Project structure is clean

## Dependencies
- Phase 1 tasks 1-6 must complete before Phase 2
- Phase 2 (notifications) must complete before Phase 3
- Phase 3 (agent) must complete before Phase 4
- Phase 4 (summaries) must complete before Phase 5
- Phase 5 (documents) must complete before Phase 6
- Phase 6 (integration testing) must complete before Phase 7
- Phase 7 (performance testing) must complete before Phase 8
- Phase 8 (frontend integration) must complete before Phase 9
- Phase 9 (deployment) must complete before Phase 10

## Parallelizable Work
- Tasks 7-10 (notifications implementation) can be done in parallel with research on other functions
- Tasks 16 (agent tests) can be written while implementing agent function
- Tasks 22 (summaries tests) can be written while implementing summaries function
- Tasks 29 (documents tests) can be written while implementing documents function
- Tasks 35-37 (performance testing) can run in parallel
- Tasks 38-42 (frontend integration testing) can run in parallel
