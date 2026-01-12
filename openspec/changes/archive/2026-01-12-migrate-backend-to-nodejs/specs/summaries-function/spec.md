# summaries-function Specification Delta

## MODIFIED Requirements

### Requirement: Summaries Function Runtime
The summaries serverless function MUST be implemented in Node.js using Fastify framework.

#### Scenario: Node.js summaries function deploys successfully
Given summaries function uses Node.js runtime
And dependencies include fastify, @supabase/supabase-js, better-sqlite3, openai
When function is built for Vercel deployment
Then build completes successfully
And unzipped function size is less than 50MB

#### Scenario: Summaries function uses TypeScript
Given summaries function is written in TypeScript
When TypeScript compiler validates code
Then compilation succeeds without errors
And type checking passes

### Requirement: Summaries Function Dependencies
The summaries serverless function MUST only include Node.js dependencies required for summarization and QA operations.

#### Scenario: Summaries function package.json includes only required dependencies
Given summaries function package.json includes fastify, @supabase/supabase-js, better-sqlite3, openai, firebase-admin
When npm install completes
Then all required dependencies are available
And package size is minimized

#### Scenario: Summaries function excludes Python dependencies
Given summaries function is being built
When package.json excludes all Python-specific packages
Then summaries function still provides all required endpoints
And document processing is handled by Python worker

### Requirement: Summaries Function Endpoints
The summaries serverless function MUST provide Fastify endpoints for document summarization and QA.

#### Scenario: Get summaries endpoint works with SQLite
Given user is authenticated
And summaries exist in SQLite database
When user GETs to `/agent/summaries`
Then Node.js function queries SQLite database
And returns JSON list of summaries
And includes filename and summary text

#### Scenario: Summary QA endpoint works
Given user is authenticated
And summary exists in SQLite database
When user POSTs to `/agent/summary_qa` with question and filename
Then Node.js function queries SQLite for summary
And OpenAI client generates QA response using summary as context
And system returns answer in JSON format

#### Scenario: Search QA endpoint works
Given user is authenticated
And search results are provided
When user POSTs to `/agent/search_qa` with question and context
Then Node.js function formats search results as context string
And OpenAI client generates QA response using search context
And system returns answer in JSON format

#### Scenario: Summarize endpoint works with queue service
Given user is authenticated
And file exists in Azure Storage
When user POSTs to `/agent/summarize` with filename
Then Node.js function submits task to queue service via HTTP
And returns task_id and webhook URL
And Python worker processes summarization

### Requirement: Summaries Function Database Access
The summaries serverless function MUST use better-sqlite3 for SQLite database access.

#### Scenario: SQLite database initialization
Given summaries function starts
When SQLite database file exists
Then better-sqlite3 opens database
And connection is available for queries
Given SQLite database file does not exist
When summaries function starts
Then better-sqlite3 creates new database
And initializes summaries table if needed

#### Scenario: SQLite query performance
Given summaries function has active database connection
When query is executed
Then query returns results in under 100ms
And database connection remains stable

### Requirement: Summaries Function Size Constraint
The summaries serverless function MUST remain under 50MB unzipped size limit for Node.js.

#### Scenario: Function size validation
Given summaries function is built with minimal Node.js dependencies
When deployment package is inspected
Then unzipped total size is less than 50MB
And build completes without size errors

#### Scenario: Cold start performance
Given summaries function is deployed with Node.js runtime
When a cold start occurs
Then cold start time is less than 400ms
And function initializes within 1 second
