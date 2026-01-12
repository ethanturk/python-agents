# Spec: API Integration

## ADDED Requirements

### Requirement: API Client Adaptation
The system MUST adapt the existing API client to work with Next.js environment variables.

#### Scenario: API_BASE works in Next.js
Given the frontend is running on Next.js
When the API client is initialized
Then the system MUST read `NEXT_PUBLIC_API_BASE` from environment variables
And the system MUST fallback to a configured default for client-side access
And the system MUST NOT hardcode API URLs

#### Scenario: Server-side API access
Given a Next.js server component needs to call the API
When the server component executes
Then the system MUST access environment variables via `process.env`
And the system MUST NOT use `import.meta.env` (Vite-specific)
And server-side API calls MUST NOT include the NEXT_PUBLIC_ prefix

#### Scenario: Preserve axios configuration
Given the existing frontend uses axios for API calls
When the API client is migrated to Next.js
Then the system MUST preserve the existing axios configuration
And the system MUST maintain the same timeout and retry behavior
And the system MUST keep the same error handling patterns

### Requirement: Endpoint Compatibility
The system MUST maintain full compatibility with existing backend API endpoints.

#### Scenario: Document endpoints work identically
Given the existing application calls `/agent/documents`, `/agent/upload`, `/agent/search`
When the migrated frontend makes these API calls
Then the endpoints MUST work identically to the Vite version
And the request/response formats MUST be unchanged
And the authentication MUST work with the existing Firebase setup

#### Scenario: Notification polling works identically
Given the existing application polls `/poll` endpoint for notifications
When the migrated frontend polls for notifications
Then the polling mechanism MUST work identically
And the polling MUST use the same since_id tracking
And the notification queue MUST preserve existing behavior

#### Scenario: WebSocket replacement
Given the WebSocket endpoints (`/ws`) are not supported by Vercel serverless
When the frontend needs real-time updates
Then the system MUST use the `/poll` endpoint instead
And the polling interval SHOULD match existing WebSocket reconnect delay
And the system MUST gracefully handle the lack of WebSocket functionality

### Requirement: Environment Variables
The system MUST support Next.js environment variable naming conventions.

#### Scenario: Development environment variables
Given a developer is working locally with Next.js
When the application starts
Then the system MUST read from `.env.local` file
And the system MUST prefix public variables with `NEXT_PUBLIC_`
And the system MUST validate that required variables are set

#### Scenario: Production environment variables
Given the application is deployed to Vercel
When the application starts
Then the system MUST use Vercel-provided environment variables
And the system MUST NOT commit `.env.local` to version control
And the system MUST use `NEXT_PUBLIC_API_BASE` for client-side variables
