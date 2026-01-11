# agent-function Specification

## Purpose
Define requirements for the agent serverless function with minimal dependencies.

## ADDED Requirements

### Requirement: Minimal Agent Function Dependencies
The agent serverless function MUST only include dependencies required for LLM and RAG operations.

#### Scenario: Agent function builds successfully
Given the agent function requirements.txt includes only pydantic-ai, litellm, supabase, nest_asyncio, and fastapi
When the function is built for Vercel deployment
Then the build completes successfully
And the unzipped function size is less than 250MB

#### Scenario: Agent function excludes document processing
Given the agent function is being built
When the requirements.txt excludes docling, pypdfium2, pandas, xlrd, openpyxl, and celery
Then the agent function still provides all required endpoints
And document processing is handled by other functions

### Requirement: Agent Function Endpoints
The agent serverless function MUST provide endpoints for LLM interactions and RAG search.

#### Scenario: Sync agent endpoint works
Given the user is authenticated
And the agent function is deployed with minimal dependencies
When the user POSTs to `/agent/sync` with a prompt
Then the system returns a response from the LLM
And the response is generated synchronously

#### Scenario: RAG search endpoint works
Given the user is authenticated
And documents are indexed in Supabase
When the user POSTs to `/agent/search` with a query
Then the system returns relevant document chunks
And results are sorted by similarity score

### Requirement: Agent Function Size Constraint
The agent serverless function MUST remain under the 250MB unzipped size limit.

#### Scenario: Function size validation
Given the agent function is built with minimal dependencies
When the deployment package is inspected
Then the unzipped total size is less than 250MB
And the build completes without size errors

#### Scenario: Cold start performance
Given the agent function is deployed with minimal dependencies
When a cold start occurs
Then the cold start time is reduced compared to loading all dependencies
And the function initializes within 5 seconds
