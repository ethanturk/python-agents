# documents-function Specification

## Purpose
Define requirements for the documents serverless function with minimal dependencies.

## ADDED Requirements

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
Given the documents function is starting
When the configuration module is imported
Then only Azure Storage and Supabase configuration are loaded
And LLM configuration is not loaded
And document processing configuration is not loaded
