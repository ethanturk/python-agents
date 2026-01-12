# Tasks: Implement Azure Queue Service and Async Worker

## Phase 1: Azure Queue Service Implementation

### 1. Enhance AzureQueueService
- [ ] Update AzureQueueService to use dynamic queue naming
  - [ ] Read CLIENT_ID environment variable (default: "default")
  - [ ] Set queue_name to "{CLIENT_ID}-tasks"
  - [ ] Update AzureQueueService documentation
- [ ] Test queue naming with different CLIENT_ID values
- [ ] Validate: Queue names follow naming convention

### 2. Implement message format validation
- [ ] Create message model/validator in queue_service.py
  - [ ] Validate message size under 64KB limit
  - [ ] Add warnings for large payloads
  - [ ] Test with various message sizes
- [ ] Validate: Messages fit within Azure Queue limits

### 3. Implement error handling and retry logic
- [ ] Add retry decorator for Azure Queue operations
  - [ ] Implement exponential backoff for retries
  - [ ] Add timeout handling for queue operations
  - [ ] Add logging for all queue operations
- [ ] Write unit tests for retry logic
- [ ] Validate: Transient errors are retried appropriately

### 4. Update queue service initialization
- [ ] Ensure AzureQueueService uses same AZURE_STORAGE_CONNECTION_STRING
  - [ ] Verify QueueServiceClient uses correct credentials
  - [ ] Add connection validation on initialization
  - [ ] Add unit tests for connection scenarios
- [ ] Validate: Worker can connect to same storage account as frontend

## Phase 2: Async Worker Implementation

### 5. Create worker entry point
- [ ] Create worker/async_worker.py
  - [ ] Implement main loop with queue polling
  - [ ] Add graceful shutdown handling (SIGTERM, SIGINT)
  - [ ] Implement visibility timeout renewal
  - [ ] Add startup logging with configuration
- [ ] Validate: Worker starts and polls queue continuously

### 6. Implement task router
- [ ] Create task router in worker/async_worker.py
  - [ ] Map task_type to handler functions
  - [ ] Handle unknown task_type gracefully
  - [ ] Add logging for task routing
  - [ ] Test with each task type
- [ ] Validate: Tasks are routed to correct handlers

### 7. Implement document ingestion handler
- [ ] Create IngestionHandler class
  - [ ] Download file from Azure Blob Storage
  - [ ] Process with Docling to extract text
  - [ ] Generate embeddings with OpenAI API
  - [ ] Index chunks in Supabase vector DB
  - [ ] Handle errors and retry on failure
- [ ] Write integration tests for ingestion flow
- [ ] Validate: Documents are ingested and searchable

### 8. Implement summarization handler
- [ ] Create SummarizationHandler class
  - [ ] Download file from Azure Blob Storage
  - [ ] Generate summary using LLM
  - [ ] Save summary to database
  - [ ] Handle large files (chunking if needed)
- [ ] Write integration tests for summarization
- [ ] Validate: Summaries are saved and retrievable

### 9. Implement webhook notification service
- [ ] Create NotificationService class in worker/
  - [ ] Implement send_webhook() method
  - [ ] Handle network errors with retry
  - [ ] Support both success and failure notifications
  - [ ] Add logging for webhook delivery
- [ ] Write unit tests for webhook service
- [ ] Validate: Frontend receives completion notifications

## Phase 3: Worker Configuration and Deployment

### 10. Create systemd service file
- [ ] Create worker/async-worker.service template
  - [ ] Configure ExecStart to point to async_worker.py
  - [ ] Set Restart=always for auto-restart
  - [ ] Add Environment=CLIENT_ID= parameter
  - [ ] Configure logging to syslog
  - [ ] Create install script
- [ ] Validate: Service file installs and starts correctly

### 11. Create environment configuration template
- [ ] Create worker/.env.example file
  - [ ] Document all required environment variables
  - [ ] Include CLIENT_ID, AZURE_STORAGE_CONNECTION_STRING, etc.
  - [ ] Add comments for each variable
- [ ] Create validation script to check configuration
- [ ] Validate: All required variables are documented

### 12. Add worker monitoring
- [ ] Implement health check endpoint (optional HTTP server)
  - [ ] Add Prometheus metrics (optional)
  - [ ] Log queue depth and processing latency
  - [ ] Add alert triggers for errors
- [ ] Create monitoring dashboard queries
- [ ] Validate: Worker health can be monitored

## Phase 4: Integration and Testing

### 13. Integrate worker with queue service
- [ ] Update frontend queue submission to include CLIENT_ID in payload
- [ ] Test end-to-end flow: submit → queue → worker → webhook
- [ ] Verify per-client queue isolation works
- [ ] Test with multiple CLIENT_ID values
- [ ] Validate: Multi-tenant flow works correctly

### 14. Test worker task processing
- [ ] Submit ingestion task to queue
  - [ ] Verify worker processes and indexes document
  - [ ] Submit summarization task to queue
  - [ ] Verify worker generates and saves summary
  - [ ] Test error scenarios (invalid file, missing blob)
- [ ] Validate: All task types work end-to-end

### 15. Test worker reliability
- [ ] Test worker with network interruptions
  - [ ] Test graceful shutdown
  - [ ] Test worker auto-restart on failure
  - [ ] Test with poison messages
  - [ ] Monitor resource usage during operation
- [ ] Validate: Worker handles failures gracefully

## Phase 5: Documentation and Cleanup

### 16. Create worker deployment guide
- [ ] Create worker/DEPLOYMENT.md
  - [ ] Document systemd service setup
  - [ ] Document environment variable configuration
  - [ ] Add troubleshooting section
  - [ ] Include monitoring and scaling considerations
- [ ] Validate: Documentation is complete and accurate

### 17. Update AGENTS.md
- [ ] Add worker service section to AGENTS.md
  - [ ] Document CLIENT_ID configuration
  - [ ] Update task submission flow
  - [ ] Add webhook notification details
- [ ] Include multi-tenant setup instructions
- [ ] Validate: Documentation reflects new architecture

## Dependencies
- Tasks 1-4 must complete before Phase 2
- Tasks 5-9 must complete before Phase 3
- Tasks 10-12 must complete before Phase 4
- Tasks 13-15 must complete before Phase 5

## Parallelizable Work
- Tasks 7-8 (task handlers can be developed in parallel)
- Tasks 13-14 (integration tests can be written in parallel)
- Tasks 15-16 (testing and documentation can overlap)
