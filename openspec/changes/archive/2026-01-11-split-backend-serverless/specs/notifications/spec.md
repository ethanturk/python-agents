# Spec: Notifications API (Serverless)

## ADDED Requirements

### Requirement: Long-Polling Notifications Endpoint
The system MUST provide an endpoint for clients to poll for notifications.

#### Scenario: Client polls for new notifications
Given the user is authenticated
When the user GETs `/poll?since_id=123`
Then the system waits up to 20 seconds for new messages
And returns all messages with IDs greater than since_id
Or returns empty list if no messages arrive within timeout

#### Scenario: No since_id provided
Given the user is authenticated
When the user GETs `/poll` without since_id parameter
Then the system defaults since_id to 0
And returns all messages in the queue

### Requirement: Internal Notify Endpoint (Webhook)
The system MUST provide a webhook endpoint for external services to send notifications.

#### Scenario: Queue service sends completed notification
Given an external queue service completes a task
When the queue service POSTs to `/internal/notify` with task completion details
Then the system processes the notification
And pushes the notification to the in-memory queue
And returns success status

#### Scenario: Completed task with result
Given a queue service sends a notification with status "completed"
And the notification contains a result
When the system processes the notification
Then the system saves the result to the summaries database (if applicable)
And pushes the notification to the queue for clients

#### Scenario: Failed task notification
Given a queue service sends a notification with status "failed"
When the system processes the notification
Then the system does not save to database
And pushes the notification to the queue for clients

### Requirement: In-Memory Notification Queue
The system MUST maintain an in-memory notification queue for polling.

#### Scenario: Push notification to queue
Given the system receives a notification from external service
When the system pushes the notification to the queue
Then the notification is assigned a unique ID
And the queue maintains at most 1000 messages (maxlen)

#### Scenario: Queue overflow
Given the notification queue has 1000 messages
When a new notification arrives
Then the oldest message is removed to make space
And the new message is added to the queue

### Requirement: SSE Endpoint Removal
The SSE endpoint MUST be removed as it's not supported by Vercel.

#### Scenario: SSE endpoint removed
Given the system is deployed to Vercel serverless
When a client tries to connect to `/sse`
Then the system returns a 503 error with message "SSE not supported in serverless deployment. Use /poll instead."

### Requirement: WebSocket Endpoint Removal
The WebSocket endpoint MUST be removed as it's not supported by Vercel.

#### Scenario: WebSocket endpoint removed
Given the system is deployed to Vercel serverless
When a client tries to connect to `/ws`
Then the system returns a 503 error with message "WebSocket not supported in serverless deployment."

### Requirement: Notifications Function Dependencies
The notifications serverless function MUST have minimal dependencies.

#### Scenario: Minimal dependency set
Given the notifications function is being built
When the function includes only fastapi and python-dotenv
And excludes all heavy dependencies (LLM, storage, vector DB)
Then the function size is under 50MB for fastest cold starts

#### Scenario: No external service dependencies
Given the notifications function is being built
When the function only manages in-memory queue
Then the notifications function should not include supabase, azure-storage-blob, or pydantic-ai

### Requirement: Broadcast Notification to SSE (Deprecated)
The broadcast to SSE functionality SHALL be kept for backwards compatibility but will not be used in Vercel deployment.

#### Scenario: Broadcast to SSE (no-op in serverless)
Given the system receives a notification from external service
When the system broadcasts to SSE manager
Then the broadcast attempt should not cause errors in serverless environment
And the notification is only delivered via polling
