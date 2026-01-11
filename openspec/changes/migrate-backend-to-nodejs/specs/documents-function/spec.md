# documents-function Specification Delta

## MODIFIED Requirements

### Requirement: Documents Function Runtime
The documents serverless function MUST be implemented in Node.js using Fastify framework.

#### Scenario: Node.js documents function deploys successfully
Given documents function uses Node.js runtime
And dependencies include fastify, @supabase/supabase-js, @azure/storage-blob
When function is built for Vercel deployment
Then build completes successfully
And unzipped function size is less than 50MB

#### Scenario: Documents function uses TypeScript
Given documents function is written in TypeScript
When TypeScript compiler validates code
Then compilation succeeds without errors
And type checking passes

### Requirement: Documents Function Dependencies
The documents serverless function MUST only include Node.js dependencies required for file storage and vector database operations.

#### Scenario: Documents function package.json includes only required dependencies
Given documents function package.json includes fastify, @supabase/supabase-js, @azure/storage-blob, firebase-admin
And excludes LLM libraries (openai, langchain)
When npm install completes
Then all required dependencies are available
And package size is minimized

#### Scenario: Documents function excludes Python dependencies
Given documents function is being built
When package.json excludes all Python-specific packages
Then documents function still provides all required endpoints
And LLM operations are handled by other functions

### Requirement: Documents Function Endpoints
The documents serverless function MUST provide Fastify endpoints for file operations and document management.

#### Scenario: Upload endpoint works with Node.js
Given user is authenticated via Firebase
And documents function is deployed with Node.js runtime
When user POSTs to `/agent/upload` with files and a document set
Then Fastify server receives multipart/form-data
And files are validated for extensions
And Azure Storage client saves files
And queue service HTTP client submits ingestion task
And system returns success status with uploaded filenames

#### Scenario: List documents endpoint works
Given user is authenticated
And documents are indexed in Supabase
When user GETs to `/agent/documents`
Then Node.js function queries Supabase for distinct filenames
And returns JSON list of documents
And includes document sets and chunk counts

#### Scenario: Delete document endpoint works
Given user is authenticated
And a document exists in the vector database
When user DELETEs to `/agent/documents/{filename}`
Then Azure Storage client deletes file
And Supabase client deletes document chunks
And system returns success status

#### Scenario: File proxy endpoint works
Given user requests file download
And file exists in Azure Storage
When user GETs to `/agent/files/{document_set}/{filename}`
Then Node.js function downloads from Azure Storage
And sets correct Content-Type header
And returns file content to client

### Requirement: Documents Function Size Constraint
The documents serverless function MUST remain under 50MB unzipped size limit for Node.js.

#### Scenario: Function size validation
Given documents function is built with minimal Node.js dependencies
When deployment package is inspected
Then unzipped total size is less than 50MB
And build completes without size errors

#### Scenario: Cold start performance
Given documents function is deployed with Node.js runtime
When a cold start occurs
Then cold start time is less than 400ms
And function initializes within 1 second

### Requirement: Documents Function Configuration
The documents serverless function MUST load configuration from environment variables.

#### Scenario: Configuration loads from environment
Given documents function is starting
When environment variables are loaded
Then Azure Storage connection string is available
And Supabase URL and key are available
And Firebase service account credentials are available
And queue service URL is available

#### Scenario: Configuration validation
Given documents function is starting
When required environment variables are missing
Then function logs error
And returns 500 error on request
