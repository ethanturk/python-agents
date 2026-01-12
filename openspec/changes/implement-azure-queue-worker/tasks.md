# Tasks: Implement Azure Queue Service and Async Worker

## Phase 1: Azure Queue Service Implementation

### 1. Enhance AzureQueueService
- [x] Update AzureQueueService to use dynamic queue naming
  - [x] Read CLIENT_ID environment variable (default: "default")
  - [x] Set queue_name to "{CLIENT_ID}-tasks"
  - [x] Update AzureQueueService documentation
- [x] Test queue naming with different CLIENT_ID values
- [x] Validate: Queue names follow naming convention

### 2. Implement message format validation
- [x] Create message model/validator in queue_service.py
  - [x] Validate message size under 64KB limit
  - [x] Add warnings for large payloads
  - [x] Test with various message sizes
- [x] Validate: Messages fit within Azure Queue limits

### 3. Implement error handling and retry logic
- [x] Add retry decorator for Azure Queue operations
  - [x] Implement exponential backoff for retries
  - [x] Add timeout handling for queue operations
  - [x] Add logging for all queue operations
- [x] Write unit tests for retry logic
- [x] Validate: Transient errors are retried appropriately

### 4. Update queue service initialization
- [x] Ensure AzureQueueService uses same AZURE_STORAGE_CONNECTION_STRING
  - [x] Verify QueueServiceClient uses correct credentials
  - [x] Add connection validation on initialization
  - [x] Add unit tests for connection scenarios
- [x] Validate: Worker can connect to same storage account as frontend

## Phase 2: Async Worker Implementation

### 5. Create worker entry point
- [x] Create worker/queue_worker.py
  - [x] Implement main loop with queue polling
  - [x] Add graceful shutdown handling (SIGTERM, SIGINT)
  - [x] Implement visibility timeout renewal
  - [x] Add startup logging with configuration
- [x] Validate: Worker starts and polls queue continuously

### 6. Implement task router
- [x] Create task router in worker/queue_worker.py
  - [x] Map task_type to handler functions
  - [x] Handle unknown task_type gracefully
  - [x] Add logging for task routing
  - [x] Test with each task type
- [x] Validate: Tasks are routed to correct handlers

### 7. Implement document ingestion handler
- [x] Create IngestionHandler class
  - [x] Download file from Azure Blob Storage
  - [x] Process with Docling to extract text
  - [x] Generate embeddings with OpenAI API
  - [x] Index chunks in Supabase vector DB
  - [x] Handle errors and retry on failure
- [x] Write integration tests for ingestion flow
- [x] Validate: Documents are ingested and searchable

### 8. Implement summarization handler
- [x] Create SummarizationHandler class
  - [x] Download file from Azure Blob Storage
  - [x] Generate summary using LLM
  - [x] Save summary to database
  - [x] Handle large files (chunking if needed)
- [x] Write integration tests for summarization
- [x] Validate: Summaries are saved and retrievable

### 9. Implement webhook notification service
- [x] Create NotificationService class in worker/
  - [x] Implement send_webhook() method
  - [x] Handle network errors with retry
  - [x] Support both success and failure notifications
  - [x] Add logging for webhook delivery
- [x] Write unit tests for webhook service
- [x] Validate: Frontend receives completion notifications

## Phase 3: Worker Configuration and Deployment

### 10. Create systemd service file
- [x] Create worker/queue-worker.service template
  - [x] Configure ExecStart to point to queue_worker.py
  - [x] Set Restart=always for auto-restart
  - [x] Add Environment=CLIENT_ID= parameter
  - [x] Configure logging to syslog
  - [x] Create install script
- [x] Validate: Service file installs and starts correctly

### 11. Create environment configuration template
- [x] Create worker/.env.example file
  - [x] Document all required environment variables
  - [x] Include CLIENT_ID, AZURE_STORAGE_CONNECTION_STRING, etc.
  - [x] Add comments for each variable
- [x] Create validation script to check configuration
- [x] Validate: All required variables are documented

### 12. Add worker monitoring
- [x] Implement health check endpoint (optional HTTP server)
  - [x] Add Prometheus metrics (optional)
  - [x] Log queue depth and processing latency
  - [x] Add alert triggers for errors
- [x] Create monitoring dashboard queries
- [x] Validate: Worker health can be monitored

## Phase 4: Integration and Testing

### 13. Integrate worker with queue service
- [x] Update frontend queue submission to include CLIENT_ID in payload
- [x] Test end-to-end flow: submit → queue → worker → webhook
- [x] Verify per-client queue isolation works
- [x] Test with multiple CLIENT_ID values
- [x] Validate: Multi-tenant flow works correctly

### 14. Test worker task processing
- [x] Submit ingestion task to queue
  - [x] Verify worker processes and indexes document
  - [x] Submit summarization task to queue
  - [x] Verify worker generates and saves summary
  - [x] Test error scenarios (invalid file, missing blob)
- [x] Validate: All task types work end-to-end

### 15. Test worker reliability
- [x] Test worker with network interruptions
  - [x] Test graceful shutdown
  - [x] Test worker auto-restart on failure
  - [x] Test with poison messages
  - [x] Monitor resource usage during operation
- [x] Validate: Worker handles failures gracefully

## Phase 5: Documentation and Cleanup

### 16. Create worker deployment guide
- [x] Create worker/WORKER_DEPLOYMENT.md
  - [x] Document systemd service setup
  - [x] Document environment variable configuration
  - [x] Add troubleshooting section
  - [x] Include monitoring and scaling considerations
- [x] Validate: Documentation is complete and accurate

### 17. Update AGENTS.md
- [x] Add worker service section to AGENTS.md
  - [x] Document CLIENT_ID configuration
  - [x] Update task submission flow
  - [x] Add webhook notification details
- [x] Include multi-tenant setup instructions
- [x] Validate: Documentation reflects new architecture

## Dependencies
- Tasks 1-4 must complete before Phase 2
- Tasks 5-9 must complete before Phase 3
- Tasks 10-12 must complete before Phase 4
- Tasks 13-15 must complete before Phase 5

## Parallelizable Work
- Tasks 7-8 (task handlers can be developed in parallel)
- Tasks 13-14 (integration tests can be written in parallel)
- Tasks 15-16 (testing and documentation can overlap)
