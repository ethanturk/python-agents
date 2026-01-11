# agent Specification

## Purpose
TBD - created by archiving change split-backend-serverless. Update Purpose after archive.
## Requirements
### Requirement: Agent Sync Endpoint
The system MUST provide a synchronous agent endpoint for LLM interactions that SHALL work in serverless environments.

#### Scenario: User submits a sync agent request
Given the user is authenticated
When the user POSTs to `/agent/sync` with a prompt
Then the system returns a response from the LLM
And the response is returned synchronously without task queuing

#### Scenario: Agent function size constraint
Given the agent serverless function is deployed to Vercel
When the function is built with all required dependencies
Then the total size including dependencies must be under 250MB

### Requirement: Agent Search Endpoint (RAG)
The system MUST provide semantic search over documents using vector similarity.

#### Scenario: User performs document search
Given the user is authenticated
And documents are indexed in the vector database
When the user POSTs to `/agent/search` with a query and document set
Then the system returns relevant document chunks sorted by similarity
And results include content, filename, document_set, and similarity score

#### Scenario: Search with optional document set
Given the user is authenticated
When the user POSTs to `/agent/search` without specifying a document set
Then the system searches across all documents
And returns results from any document set

### Requirement: Async Agent Integration (Queue Service)
The system MUST support async agent workflows using an external queue service instead of Celery.

#### Scenario: Submit async agent task
Given the user is authenticated
And an external queue service is configured
When the user POSTs to `/agent/async` with a prompt
Then the system submits a task to the queue service
And returns a task_id for status polling

#### Scenario: Poll async agent status
Given the user has submitted an async task
When the user GETs `/agent/status/{task_id}`
Then the system queries the queue service for task status
And returns the current status (queued, processing, completed, failed)
And returns the result if the task is completed

#### Scenario: Celery not available in serverless
Given the system is deployed to Vercel serverless
When the user tries to access Celery-based endpoints directly
Then the system returns a 503 error with message "Async task processing not available in serverless deployment"

### Requirement: Agent Function Dependencies
The agent serverless function MUST only include dependencies required for agent operations.

#### Scenario: Minimal dependency set
Given the agent function is being built
When the function includes only pydantic-ai, langchain-openai, litellm, and supabase
And excludes celery, docling, pandas
Then the function size is minimized for faster cold starts

#### Scenario: No document processing dependencies
Given the agent function is being built
When document ingestion is handled by separate service
Then the agent function should not include docling, pypdfium2, pandas, xlrd, or openpyxl
