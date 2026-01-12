# Spec: Azure Queue Service Provider

## ADDED Requirements

### Requirement: Azure Queue Implementation
The system MUST implement Azure Storage Queue as a queue service provider for async task processing.

#### Scenario: Submit task to Azure Queue
Given a client ID is configured (e.g., southhaven)
And an Azure Storage connection string is configured
When a task is submitted to the queue service
Then the system connects to Azure Storage Queue with name "{client_id}-tasks"
And the task message is serialized to JSON with task_type, payload, and webhook_url
And a unique task ID (UUID) is returned

#### Scenario: Per-client queue isolation
Given multiple app instances (southhaven, demo, prod)
When tasks are submitted from different clients
Then each client uses its own queue (southhaven-tasks, demo-tasks, prod-tasks)
And tasks are isolated between clients

### Requirement: Dynamic Queue Naming
The system MUST generate queue names dynamically based on the CLIENT_ID environment variable.

#### Scenario: Client ID determines queue name
Given CLIENT_ID environment variable is set to "southhaven"
When the AzureQueueService is initialized
Then the queue name must be "southhaven-tasks"

#### Scenario: Default client ID fallback
Given CLIENT_ID environment variable is not set
When the AzureQueueService is initialized
Then the queue name must default to "default-tasks"

### Requirement: Task Message Format
The system MUST use a consistent message format for all queue messages.

#### Scenario: Message contains task metadata
Given a task is submitted with type "ingest" and payload {"filename": "doc.pdf"}
When the message is created
Then the message must include task_type, payload, task_id, and webhook_url
And the total message size must be under Azure Queue's 64KB limit

#### Scenario: Large payloads reference Azure Blob Storage
Given a task payload exceeds 64KB (e.g., large file content)
When the task is submitted
Then the message payload must contain only metadata (filename, document_set, etc.)
And actual file content must be referenced from Azure Blob Storage

### Requirement: Azure Queue Integration
The system MUST use the same Azure Storage account instance used for Blob Storage.

#### Scenario: Shared storage account
Given AZURE_STORAGE_CONNECTION_STRING is configured
When AzureQueueService is initialized
Then the system must use the same connection string for both queues and blobs
And queue operations must use QueueServiceClient from azure-storage-queue

### Requirement: Error Handling
The system MUST handle Azure Queue errors gracefully.

#### Scenario: Azure Queue connection fails
Given the AZURE_STORAGE_CONNECTION_STRING is invalid or missing
When a task is submitted
Then the system must raise a RuntimeError with descriptive message
And log the error with appropriate severity

#### Scenario: Queue operation timeout
Given an Azure Queue operation exceeds timeout threshold
When the operation is attempted
Then the system must retry with exponential backoff
And fail after max retries with clear error message
