# Spec: Summaries API (Serverless)

## ADDED Requirements

### Requirement: Get Summaries History Endpoint
The system MUST provide an endpoint to retrieve all cached document summaries.

#### Scenario: User retrieves all summaries
Given the user is authenticated
And summary records exist in the database
When the user GETs `/agent/summaries`
Then the system returns all summaries with filenames and summary_text

#### Scenario: No summaries available
Given the user is authenticated
And no summaries exist in the database
When the user GETs `/agent/summaries`
Then the system returns an empty summaries list

### Requirement: Summary QA Endpoint
The system MUST provide an endpoint to ask questions about cached document summaries.

#### Scenario: User asks question about summary
Given the user is authenticated
And a summary exists for the document
When the user POSTs to `/agent/summary_qa` with filename and question
Then the system retrieves the summary from the database
And returns an LLM-generated answer based on the summary

#### Scenario: Summary not found
Given the user is authenticated
And no summary exists for the requested filename
When the user POSTs to `/agent/summary_qa`
Then the system returns "Summary not found. Please summarize the document first."

### Requirement: Search QA Endpoint
The system MUST provide an endpoint to ask questions about search results.

#### Scenario: User asks question about search results
Given the user is authenticated
And the user has search results from vector database
When the user POSTs to `/agent/search_qa` with context results and question
Then the system combines the context from all results
And returns an LLM-generated answer based on the combined context

### Requirement: Document Summarization Integration (Queue Service)
Document summarization MUST be handled by external queue service, not by the summaries serverless function directly.

#### Scenario: Summarization endpoint removed
Given the system is deployed to Vercel serverless
When the user tries to POST to `/agent/summarize`
Then the system returns a 503 error with message "Document summarization not available in serverless deployment. Use cached summaries instead."

#### Scenario: Summarization completion callback
Given an external queue service completes a summarization task
And the task result contains a summary
When the queue service calls `/internal/notify` webhook
Then the system saves the summary to the database

### Requirement: Summaries Function Dependencies
The summaries serverless function MUST only include dependencies required for summary operations.

#### Scenario: Minimal dependency set
Given the summaries function is being built
When the function includes only fastapi, pydantic-ai, and python-dotenv
And excludes azure-storage-blob, celery
Then the function size is minimized for summary operations

#### Scenario: No Azure Storage dependency
Given the summaries function is being built
When document retrieval is handled by separate documents function
Then the summaries function should not include azure-storage-blob

#### Scenario: No Vector DB dependency for summaries
Given the summaries function is being built
When summaries are retrieved from local database
Then the summaries function should not include supabase for vector operations
