# summaries-function Specification

## Purpose
TBD - created by archiving change optimize-serverless-dependencies. Update Purpose after archive.
## Requirements
### Requirement: Minimal Summaries Function Dependencies
The summaries serverless function MUST only include dependencies required for summarization and QA operations.

#### Scenario: Summaries function builds successfully
Given the summaries function requirements.txt includes only pydantic-ai, supabase, and fastapi
When the function is built for Vercel deployment
Then the build completes successfully
And the unzipped function size is less than 250MB

#### Scenario: Summaries function excludes embeddings library
Given the summaries function is being built
When the requirements.txt excludes litellm
Then the summaries function still provides QA endpoints using pydantic-ai Agent
And embeddings generation is handled by the agent function

#### Scenario: Summaries function excludes document processing
Given the summaries function is being built
When the requirements.txt excludes docling, pypdfium2, pandas, xlrd, openpyxl, and celery
Then the summaries function still provides all required endpoints
And document processing is handled by other functions

### Requirement: Summaries Function Endpoints
The summaries serverless function MUST provide endpoints for document summarization and QA using Supabase for data storage.

#### Scenario: Summaries list endpoint works
Given the user is authenticated
And summaries exist in Supabase
When the user GETs to `/agent/summaries`
Then the system returns a list of summaries from Supabase
And includes filenames and summary text

#### Scenario: Summary QA endpoint works
Given the user is authenticated
And a summary exists for a document in Supabase
When the user POSTs to `/agent/summary_qa` with a question
Then the system retrieves the summary from Supabase
And uses the summary as context
And returns an answer to the question

#### Scenario: Search QA endpoint works
Given the user is authenticated
And search results are provided
When the user POSTs to `/agent/search_qa` with context results and a question
Then the system uses the provided context
And returns an answer to the question

### Requirement: Summaries Function Size Constraint
The summaries serverless function MUST remain under the 250MB unzipped size limit.

#### Scenario: Function size validation
Given the summaries function is built with minimal dependencies
When the deployment package is inspected
Then the unzipped total size is less than 250MB
And the build completes without size errors

#### Scenario: Cold start performance
Given the summaries function is deployed with minimal dependencies
When a cold start occurs
Then the cold start time is reduced compared to loading all dependencies
And the function initializes within 4 seconds

### Requirement: Summaries Function Configuration
The summaries serverless function MUST load configuration without importing heavy dependencies.

#### Scenario: Configuration loads without heavy imports
Given the summaries function is starting
When the configuration module is imported
Then only pydantic-ai and Supabase configuration are loaded
And litellm embeddings configuration is not loaded
And document processing configuration is not loaded
And Azure Storage configuration is not loaded
