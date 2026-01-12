# async-worker Specification

## Purpose
TBD - created by archiving change implement-azure-queue-worker. Update Purpose after archive.
## Requirements
### Requirement: Worker Queue Consumer
The worker MUST poll Azure Storage Queue for tasks and process them asynchronously.

#### Scenario: Worker receives messages from queue
Given a worker is running with CLIENT_ID="southhaven"
And the "southhaven-tasks" queue contains messages
When the worker polls the queue
Then the worker must receive available messages
And must acknowledge each message by deleting it from the queue
And must renew visibility timeout before it expires

#### Scenario: Worker processes multiple task types
Given the worker is running
And the queue contains messages with different task_type values
When the worker receives messages
Then the worker must route each message to the appropriate handler (ingest, summarize, agent)
And must process each message independently

### Requirement: Task Handlers
The system MUST provide handlers for each supported task type.

#### Scenario: Document ingestion handler
Given a task with task_type="ingest" is received
And the payload contains filename and document_set
When the handler processes the task
Then the handler must download the file from Azure Blob Storage
And must process it with Docling to extract text
And must generate embeddings using OpenAI API
And must index the document chunks in Supabase vector DB
And must save processing results to database

#### Scenario: Document summarization handler
Given a task with task_type="summarize" is received
And the payload contains filename
When the handler processes the task
Then the handler must download the file from Azure Blob Storage
And must generate a summary using LLM
And must save the summary to the summaries table

### Requirement: Webhook Notifications
The worker MUST notify the frontend server upon task completion or failure.

#### Scenario: Task completed successfully
Given a task handler completes successfully
And a webhook_url is provided in the task message
When the worker sends the notification
Then the POST request must contain task_id, status="completed", and result
And the request must be sent to the webhook_url endpoint
And the frontend server must save the result to database

#### Scenario: Task processing fails
Given a task handler encounters an error
And a webhook_url is provided in the task message
When the worker sends the notification
Then the POST request must contain task_id, status="failed", and error details
And the error must include exception type and message

### Requirement: Worker Configuration
The worker MUST be configurable via environment variables.

#### Scenario: Worker uses per-client configuration
Given a worker is started with CLIENT_ID="southhaven"
When the worker initializes
Then the worker must connect to the "southhaven-tasks" queue
And must use the same environment variables as frontend (AZURE_STORAGE_CONNECTION_STRING, SUPABASE_URL, etc.)

#### Scenario: Worker uses default client ID
Given a worker is started without CLIENT_ID
When the worker initializes
Then the worker must default to "default-tasks" queue

### Requirement: Worker Lifecycle
The worker MUST run continuously and handle graceful shutdown.

#### Scenario: Worker runs as daemon service
Given the worker is started via systemd or similar service manager
When the worker is running
Then the worker must continuously poll the queue for messages
And must handle interruptions gracefully
And must re-establish connections if they fail

#### Scenario: Worker stops gracefully
Given the worker receives a shutdown signal (SIGTERM, SIGINT)
When the worker stops
Then the worker must finish processing the current message
And must not acknowledge new messages
And must exit cleanly

### Requirement: Error Handling and Retry
The worker MUST implement retry logic for transient failures.

#### Scenario: Transient network error
Given a task handler encounters a temporary network error
When the error occurs
Then the worker must retry the operation with exponential backoff
And must fail after max retries and send failure webhook

#### Scenario: Poison message handling
Given a task message causes repeated processing failures
When the message fails after max retries
Then the worker must send a failure webhook notification
And must move the message to a dead-letter queue or delete it after logging

### Requirement: Worker Deployment
The worker MUST be deployable as a systemd service.

#### Scenario: Worker installed as service
Given the worker script is installed at /opt/worker/async_worker.py
And a systemd service file is created
When the system boots
Then the worker must start automatically
And must restart on failure
And must use the configured CLIENT_ID from environment

#### Scenario: Worker logs monitoring
Given the worker is running
When errors or warnings occur
Then the worker must log to syslog or a configured log file
And logs must include task_id for traceability
