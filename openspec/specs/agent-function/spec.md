# agent-function Specification

## Purpose

TBD - created by archiving change optimize-serverless-dependencies. Update Purpose after archive.

## Requirements

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
Then cold start time is reduced compared to loading all dependencies
And the function initializes within 5 seconds

## Delta: Migrate Backend to Node.js

### Requirement: Agent Function Runtime

The agent serverless function MUST be implemented in Node.js for unified TypeScript stack.

#### Scenario: Node.js agent endpoint works

Given the agent function is implemented in Node.js
When user POSTs to `/agent/sync` with a prompt
Then system returns a response from the LLM
And the response format matches Python implementation

#### Scenario: Node.js RAG search endpoint works

Given the agent function is implemented in Node.js
And documents are indexed in Supabase
When user POSTs to `/agent/search` with a query
Then system returns relevant document chunks
And results are sorted by similarity score

### Requirement: Node.js Agent Dependencies

The agent serverless function MUST use Node.js dependencies instead of Python packages.

#### Scenario: Node.js dependencies are used

Given the agent function is built
When package.json is inspected
Then it includes openai, @supabase/supabase-js
And it excludes Python packages (docling, pandas, etc.)

### Requirement: Agent Function Testing

The agent serverless function MUST have unit tests covering all endpoints.

#### Scenario: All agent endpoints have tests

Given the agent function is implemented
When test suite is run
Then all 14 tests pass
And coverage includes sync, async, search, and status endpoints
