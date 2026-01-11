# notifications-function Specification

## Purpose
TBD - created by archiving change optimize-serverless-dependencies. Update Purpose after archive.
## Requirements
### Requirement: Minimal Notifications Function Dependencies
The notifications serverless function MUST only include fastapi as its dependency.

#### Scenario: Notifications function builds successfully
Given the notifications function requirements.txt includes only fastapi
When the function is built for Vercel deployment
Then the build completes successfully
And the unzipped function size is less than 50MB

#### Scenario: Notifications function excludes all AI and storage dependencies
Given the notifications function is being built
When the requirements.txt excludes pydantic-ai, litellm, supabase, azure-storage-blob, docling, pandas, and celery
Then the notifications function still provides all required endpoints
And all operations use in-memory data structures only

### Requirement: Notifications Function Endpoints
The notifications serverless function MUST provide polling and notification endpoints using in-memory queue.

#### Scenario: Poll endpoint works
Given the user is authenticated
And notifications have been pushed to the queue
When the user GETs to `/poll` with a since_id parameter
Then the system returns notifications since that ID
And waits up to 20 seconds for new notifications

#### Scenario: Notify endpoint works
Given a task completes
When the system POSTs to `/internal/notify` with notification details
Then the system pushes the notification to the in-memory queue
And returns success status

#### Scenario: Notification persistence
Given the notification queue is in-memory
When notifications are pushed
Then they persist for up to 1000 messages
And older messages are discarded when the queue is full

### Requirement: Notifications Function Size Constraint
The notifications serverless function MUST remain significantly smaller than other functions.

#### Scenario: Function size validation
Given the notifications function is built with only fastapi
When the deployment package is inspected
Then the unzipped total size is less than 50MB
And the function has the smallest size among all serverless functions

#### Scenario: Cold start performance
Given the notifications function is deployed with minimal dependencies
When a cold start occurs
Then the cold start time is under 1 second
And the function initializes almost instantly

### Requirement: No External Dependencies
The notifications serverless function MUST not depend on any external services for core functionality.

#### Scenario: Pure FastAPI implementation
Given the notifications function is running
When notifications are pushed or polled
Then all operations use only in-memory data structures
And no database or storage connections are required
And the function operates independently of other services

#### Scenario: Database integration optional
Given the notifications function receives a notification with summary data
When the notification status is completed and a result is provided
Then the system attempts to save to SQLite database
And database errors are logged but do not prevent notification delivery
