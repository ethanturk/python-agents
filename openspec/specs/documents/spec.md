# documents Specification

## Purpose
TBD - created by archiving change split-backend-serverless. Update Purpose after archive.
## Requirements
### Requirement: Document Upload Endpoint
The system MUST provide an endpoint for uploading documents to Azure Storage with validation.

#### Scenario: User uploads valid files
Given the user is authenticated
And the user provides one or more files and a document set
When the user POSTs to `/agent/upload` with the files
Then the system validates file extensions against ALLOWED_EXTENSIONS
And sanitizes the document set name
And saves files to Azure Storage
And returns success status with uploaded filenames

#### Scenario: File size validation
Given the user is authenticated
And uploads a file larger than MAX_FILE_SIZE
When the user POSTs to `/agent/upload`
Then the system returns a 400 error indicating the file exceeds size limit

#### Scenario: Invalid file extension
Given the user is authenticated
And uploads a file with extension not in ALLOWED_EXTENSIONS
When the user POSTs to `/agent/upload`
Then the system returns a 400 error indicating unsupported file type

### Requirement: List Documents Endpoint
The system MUST provide an endpoint to list all indexed documents.

#### Scenario: User lists all documents
Given the user is authenticated
And documents are indexed in the vector database
When the user GETs `/agent/documents`
Then the system returns a list of distinct filenames with document sets
And includes chunk count for each document

### Requirement: List Document Sets Endpoint
The system MUST provide an endpoint to list all document sets.

#### Scenario: User lists document sets
Given the user is authenticated
And documents are organized into document sets
When the user GETs `/agent/documentsets`
Then the system returns a list of all unique document sets

### Requirement: Delete Document Endpoint
The system MUST provide an endpoint to delete documents and their chunks from the vector database.

#### Scenario: User deletes a document
Given the user is authenticated
And a document exists in the vector database
When the user DELETEs `/agent/documents/{filename}`
Then the system removes all chunks for that filename
And returns success status

#### Scenario: Path traversal prevention
Given the user is authenticated
When the user attempts to DELETE `/agent/documents/../../etc/passwd`
Then the system safely extracts only the filename component
And prevents path traversal attacks

### Requirement: File Proxy Endpoint
The system MUST provide an endpoint to proxy file downloads from Azure Storage.

#### Scenario: User downloads a file
Given the user is authenticated
And a file exists in Azure Storage
When the user GETs `/agent/files/{document_set}/{filename}`
Then the system downloads the file from Azure Storage
And returns the file with appropriate content type based on extension

#### Scenario: File not found
Given the user is authenticated
And the requested file does not exist in Azure Storage
When the user GETs `/agent/files/{document_set}/{filename}`
Then the system returns a 404 error with message "File not found"

### Requirement: Documents Function Dependencies
The documents serverless function MUST only include dependencies required for document operations.

#### Scenario: Minimal dependency set
Given the documents function is being built
When the function includes only fastapi, azure-storage-blob, and supabase
And excludes pydantic-ai, docling, pandas
Then the function size is minimized for file operations

#### Scenario: No LLM dependencies
Given the documents function is being built
When LLM operations are handled by separate agent function
Then the documents function should not include pydantic-ai or langchain-openai

### Requirement: Document Ingestion Integration (Queue Service)
Document ingestion MUST be handled by external queue service, not by the documents serverless function directly.

#### Scenario: Ingestion endpoint removed
Given the system is deployed to Vercel serverless
When the user tries to POST to `/agent/ingest`
Then the system returns a 503 error with message "Document ingestion not available in serverless deployment. Please use file upload instead."

#### Scenario: File upload triggers ingestion
Given the user uploads a file to `/agent/upload`
And an external queue service is configured
When the file is saved to Azure Storage
Then the system submits an ingestion task to the queue service
