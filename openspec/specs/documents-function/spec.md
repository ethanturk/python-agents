# documents-function Specification

## Purpose

TBD - created by archiving change optimize-serverless-dependencies. Update Purpose after archive.

## Requirements

### Requirement: Minimal Documents Function Dependencies

The documents serverless function MUST only include dependencies required for file storage and vector database operations.

#### Scenario: Documents function builds successfully

Given the documents function requirements.txt includes only fastapi, azure-storage-blob, and supabase
When the function is built for Vercel deployment
Then the build completes successfully
And the unzipped function size is less than 250MB

#### Scenario: Documents function excludes LLM dependencies

Given the documents function is being built
When the requirements.txt excludes pydantic-ai, litellm, docling, pandas, and celery
Then the documents function still provides all required endpoints
And LLM operations are handled by other functions

### Requirement: Documents Function Endpoints

The documents serverless function MUST provide endpoints for file operations and document management.

#### Scenario: Upload endpoint works

Given the user is authenticated
And the documents function is deployed with minimal dependencies
When the user POSTs to `/agent/upload` with files and a document set
Then the system validates file extensions
And saves files to Azure Storage
And returns success status with uploaded filenames

#### Scenario: List documents endpoint works

Given the user is authenticated
And documents are indexed in Supabase
When the user GETs to `/agent/documents`
Then the system returns a list of documents
And includes document sets and chunk counts

#### Scenario: Delete document endpoint works

Given the user is authenticated
And a document exists in the vector database
When the user DELETEs to `/agent/documents/{filename}`
Then the system removes all chunks for that document
And returns success status

### Requirement: Documents Function Size Constraint

The documents serverless function MUST remain under the 250MB unzipped size limit.

#### Scenario: Function size validation

Given the documents function is built with minimal dependencies
When the deployment package is inspected
Then the unzipped total size is less than 250MB
And the build completes without size errors

#### Scenario: Cold start performance

Given the documents function is deployed with minimal dependencies
When a cold start occurs
Then the cold start time is reduced compared to loading all dependencies
And the function initializes within 3 seconds

### Requirement: Documents Function Configuration

The documents serverless function MUST load configuration without importing heavy dependencies.

#### Scenario: Configuration loads without heavy imports

Given documents function is starting
When configuration module is imported
Then only Azure Storage and Supabase configuration are loaded
And LLM configuration is not loaded
And document processing configuration is not loaded

## Delta: Migrate Backend to Node.js

### Requirement: Documents Function Runtime

The documents serverless function MUST be implemented in Node.js for unified TypeScript stack.

#### Scenario: Node.js upload endpoint works

Given the documents function is implemented in Node.js
When user POSTs to `/agent/upload` with files
Then system validates and sanitizes document_set
And saves files to Azure Storage
And queues ingestion tasks

#### Scenario: Node.js list documents endpoint works

Given the documents function is implemented in Node.js
And documents are indexed in Supabase
When user GETs to `/agent/documents`
Then system returns a list of documents
And includes document sets and chunk counts

#### Scenario: Node.js delete endpoint works

Given the documents function is implemented in Node.js
And a document exists in the vector database
When user DELETEs to `/agent/documents/{filename}`
Then system removes the file from Azure Storage
And removes chunks from Supabase

### Requirement: Node.js Documents Dependencies

The documents serverless function MUST use Node.js dependencies instead of Python packages.

#### Scenario: Node.js dependencies are used

Given the documents function is built
When package.json is inspected
Then it includes @azure/storage-blob, @supabase/supabase-js
And it excludes Python packages (docling, pandas, etc.)

### Requirement: Documents Function Testing

The documents serverless function MUST have unit tests covering all endpoints.

#### Scenario: All documents endpoints have tests

Given the documents function is implemented
When test suite is run
Then all 20 tests pass
And coverage includes upload, list, delete, and file proxy endpoints
