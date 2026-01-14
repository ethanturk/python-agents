# async-worker Spec Delta

## MODIFIED Requirements

### Requirement: Worker Queue Consumer
The worker MUST support both single-task and polling execution modes for processing Azure Storage Queue tasks.

#### Scenario: Single-task mode via environment variable
Given TASK_DATA environment variable is set with a JSON task payload
When the worker starts
Then the worker must parse the TASK_DATA JSON
And must route the task to the appropriate handler (ingest, summarize)
And must exit with code 0 on success or code 1 on failure
And must not poll the queue

#### Scenario: Polling mode when TASK_DATA absent
Given TASK_DATA environment variable is not set
And the worker is running with CLIENT_ID configured
When the worker starts
Then the worker must continuously poll the "{client_id}-tasks" queue
And must process messages as they arrive
And must acknowledge each message by deleting it from the queue

#### Scenario: Worker processes multiple task types
Given the worker is running in either mode
And a task message contains a task_type value
When the worker receives the task
Then the worker must route the task to the appropriate handler (ingest, summarize)
And must process the task independently

### Requirement: Worker Deployment
The worker MUST be deployable to Azure Container Instances via Azure Logic App trigger.

#### Scenario: Worker deployed as Azure Container Instance
Given the worker image is stored in Azure Container Registry
And an Azure Logic App monitors the "{client_id}-tasks" queue
When a message arrives in the queue
Then the Logic App must create an Azure Container Instance
And must pass the task data via TASK_DATA environment variable
And the container must process the task and terminate

#### Scenario: Worker container lifecycle
Given a worker container is created for a task
When the task completes (success or failure)
Then the worker must send the webhook notification
And must exit with appropriate exit code
And the container must not restart (restartPolicy: Never)

#### Scenario: Container resource allocation
Given a worker container is created
When the container starts
Then the container must have at least 1 vCPU and 2 GB memory
And the container must have a maximum execution timeout configured
And the container must have access to required secrets via Key Vault

### Requirement: Worker Lifecycle
The worker MUST handle graceful execution and termination in both modes.

#### Scenario: Single-task completion
Given the worker is running in single-task mode
When the task handler completes
Then the worker must send the webhook notification
And must exit with code 0 if status is "completed"
And must exit with code 1 if status is "failed"

#### Scenario: Single-task timeout
Given the worker is running in single-task mode
And a maximum execution time is configured
When the task exceeds the timeout
Then the worker must terminate the task gracefully
And must send a failure webhook with timeout error
And must exit with code 1

#### Scenario: Worker stops gracefully (polling mode)
Given the worker is running in polling mode
And the worker receives a shutdown signal (SIGTERM, SIGINT)
When the worker stops
Then the worker must finish processing the current message
And must not acknowledge new messages
And must exit cleanly

## ADDED Requirements

### Requirement: Container Registry Integration
The worker MUST be deployable from Azure Container Registry.

#### Scenario: Image pulled from ACR
Given the worker image is pushed to Azure Container Registry
And the ACI has access to the registry (via managed identity or admin credentials)
When a container instance is created
Then the container must pull the image from ACR
And must use the "latest" tag unless otherwise specified

#### Scenario: CI/CD pushes to ACR
Given code is merged to the main branch
When the CI/CD pipeline runs
Then the pipeline must build the worker Docker image
And must push the image to Azure Container Registry
And must tag with git SHA and "latest"

### Requirement: Logic App Orchestration
The system MUST use Azure Logic App to trigger worker containers.

#### Scenario: Logic App monitors queue
Given an Azure Logic App is configured for the "{client_id}-tasks" queue
When a message is added to the queue
Then the Logic App must detect the message within 30 seconds
And must parse the message content as JSON

#### Scenario: Logic App creates container
Given the Logic App has detected a queue message
When the Logic App processes the trigger
Then the Logic App must create an Azure Container Instance
And must pass the message content via TASK_DATA environment variable
And must use secrets from Azure Key Vault for sensitive configuration

#### Scenario: Logic App handles errors
Given the Logic App attempts to create a container
When the container creation fails
Then the Logic App must retry according to the retry policy
And must move the message to a dead-letter queue after max retries
And must send an alert notification
