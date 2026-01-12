# notifications-function Specification Delta

## MODIFIED Requirements

### Requirement: Notifications Function Runtime
The notifications serverless function MUST be implemented in Node.js using Fastify framework.

#### Scenario: Node.js notifications function deploys successfully
Given notifications function uses Node.js runtime
And dependencies include fastify, firebase-admin
When function is built for Vercel deployment
Then build completes successfully
And unzipped function size is less than 50MB

#### Scenario: Notifications function uses TypeScript
Given notifications function is written in TypeScript
When TypeScript compiler validates code
Then compilation succeeds without errors
And type checking passes

### Requirement: Notifications Function Dependencies
The notifications serverless function MUST only include Node.js dependencies required for notification delivery.

#### Scenario: Notifications function package.json includes only required dependencies
Given notifications function package.json includes fastify, firebase-admin, better-sqlite3
And excludes database or LLM libraries
When npm install completes
Then all required dependencies are available
And package size is minimized

#### Scenario: Notifications function excludes Python dependencies
Given notifications function is being built
When package.json excludes all Python-specific packages
Then notifications function still provides all required endpoints
And complex operations are handled by other functions

### Requirement: Notifications Function Endpoints
The notifications serverless function MUST provide Fastify endpoints for notification delivery and polling.

#### Scenario: Poll endpoint works with in-memory queue
Given user is authenticated via Firebase
And notifications function is deployed with Node.js runtime
When user GETs to `/poll` with since_id parameter
Then Fastify server receives request
And in-memory queue checks for new messages
And waits up to 20 seconds for new messages
And returns JSON array of messages
And messages include id, timestamp, and data

#### Scenario: Poll endpoint handles no new messages
Given user is authenticated
And no new messages exist since since_id
When user GETs to `/poll` with since_id parameter
Then function waits for 20 seconds
And returns empty messages array
And HTTP response is successful

#### Scenario: Internal notify endpoint works
Given Python worker sends notification
When POST to `/internal/notify` with notification data
Then Fastify server receives request
And if status is completed and result exists, summary is saved to SQLite
And notification is added to in-memory queue
And system returns success status

#### Scenario: Notify endpoint saves summary
Given notification has completed status
And notification includes summary result
When POST to `/internal/notify`
Then SQLite database is queried for existing summary
And new summary is inserted or existing summary is updated
And filename and summary text are saved

### Requirement: Notifications Function Size Constraint
The notifications serverless function MUST remain under 50MB unzipped size limit for Node.js.

#### Scenario: Function size validation
Given notifications function is built with minimal Node.js dependencies
When deployment package is inspected
Then unzipped total size is less than 50MB
And build completes without size errors

#### Scenario: Cold start performance
Given notifications function is deployed with Node.js runtime
When a cold start occurs
Then cold start time is less than 400ms
And function initializes within 1 second

### Requirement: In-Memory Notification Queue
The notifications serverless function MUST implement an in-memory queue for long-polling notifications.

#### Scenario: Queue stores notifications
Given notification is received via /internal/notify
When queue.push is called
Then notification is added to queue
And unique ID is assigned
And timestamp is recorded
And ID is returned

#### Scenario: Queue retrieves new notifications
Given queue has messages
When queue.get_since is called with since_id
Then all messages with ID > since_id are returned
And messages are ordered by ID
And older messages are excluded

#### Scenario: Queue handles concurrent access
Given multiple requests call queue.get_since
When concurrent access occurs
Then async locking mechanism prevents race conditions
And all requests receive correct messages

#### Scenario: Queue has maximum size limit
Given queue has reached maximum size (1000 messages)
When new notification is pushed
Then oldest message is removed
And new message is added
And queue size remains at 1000
