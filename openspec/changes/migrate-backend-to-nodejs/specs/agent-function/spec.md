# agent-function Specification Delta

## MODIFIED Requirements

### Requirement: Agent Function Runtime
The agent serverless function MUST be implemented in Node.js using Fastify framework.

#### Scenario: Node.js agent function deploys successfully
Given agent function uses Node.js runtime
And dependencies include fastify, @supabase/supabase-js, openai, firebase-admin
When function is built for Vercel deployment
Then build completes successfully
And unzipped function size is less than 50MB

#### Scenario: Agent function uses TypeScript
Given agent function is written in TypeScript
When TypeScript compiler validates code
Then compilation succeeds without errors
And type checking passes

### Requirement: Agent Function Dependencies
The agent serverless function MUST only include Node.js dependencies required for LLM and RAG operations.

#### Scenario: Agent function package.json includes only required dependencies
Given agent function package.json includes fastify, @supabase/supabase-js, openai, firebase-admin
And excludes document processing libraries (docling, pandas)
When npm install completes
Then all required dependencies are available
And package size is minimized

#### Scenario: Agent function excludes Python dependencies
Given agent function is being built
When package.json excludes all Python-specific packages
Then agent function still provides all required endpoints
And document processing is handled by Python worker

### Requirement: Agent Function Endpoints
The agent serverless function MUST provide Fastify endpoints for LLM interactions and RAG search.

#### Scenario: Sync agent endpoint works with Node.js
Given user is authenticated via Firebase
And agent function is deployed with Node.js runtime
When user POSTs to `/agent/sync` with a prompt
Then Fastify server receives request
And OpenAI client generates response
And system returns JSON response with LLM output

#### Scenario: Async agent endpoints work with queue service
Given user is authenticated
And queue service is available via HTTP
When user POSTs to `/agent/async` with a prompt
Then Node.js function submits task to queue service
And returns task_id for polling
When user GETs `/agent/status/{task_id}`
Then Node.js function queries queue service
And returns task status and result

#### Scenario: RAG search endpoint works with Supabase client
Given user is authenticated
And documents are indexed in Supabase
When user POSTs to `/agent/search` with a query
Then Node.js function calls Supabase match_documents RPC
And returns relevant document chunks
And results include similarity scores

### Requirement: Agent Function Size Constraint
The agent serverless function MUST remain under 50MB unzipped size limit for Node.js.

#### Scenario: Function size validation
Given agent function is built with minimal Node.js dependencies
When deployment package is inspected
Then unzipped total size is less than 50MB
And build completes without size errors

#### Scenario: Cold start performance
Given agent function is deployed with Node.js runtime
When a cold start occurs
Then cold start time is less than 400ms
And function initializes within 1 second

### Requirement: Agent Function Authentication
The agent serverless function MUST use Firebase Admin SDK for token verification.

#### Scenario: Firebase authentication works in Node.js
Given user provides valid Firebase token
When request includes Bearer token
Then firebase-admin verifies token
And request proceeds with user context
Given user provides invalid token
When request includes invalid Bearer token
Then firebase-admin rejects token
And server returns 401 error

### Requirement: Agent Function LLM Integration
The agent serverless function MUST use OpenAI SDK for LLM operations.

#### Scenario: LLM client initialization
Given OPENAI_API_KEY environment variable is set
When agent function initializes
Then OpenAI client is configured
And can successfully call chat completions API

#### Scenario: Sync agent generates response
Given user provides prompt
When agent function calls OpenAI API
Then LLM response is received
And returned to client in JSON format
