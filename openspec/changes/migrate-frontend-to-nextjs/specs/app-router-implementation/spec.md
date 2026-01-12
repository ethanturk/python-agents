# Spec: App Router Implementation

## ADDED Requirements

### Requirement: Root Layout with Providers
The system MUST provide a root layout that wraps all pages with necessary context providers.

#### Scenario: Root layout includes authentication
Given a user is navigating to any page in the Next.js application
When the root layout renders
Then the system MUST include the AuthProvider component
And the AuthProvider MUST wrap the entire application
And the layout MUST pass authentication state to all child components

#### Scenario: Root layout includes document set context
Given the application manages document sets across multiple pages
When the root layout renders
Then the system MUST include the DocumentSetProvider component
And the DocumentSetProvider MUST wrap the entire application
And all child pages MUST be able to access document set state

#### Scenario: Root layout preserves metadata
Given the root layout wraps all pages
When a child page renders
Then the system MUST preserve head tags from the child page
And the root layout MUST include the document title
And the root layout MUST include the document description meta tags

### Requirement: Page Routes Mapping
The system MUST map all existing React Router routes to Next.js App Router page routes.

#### Scenario: Home page maps to root route
Given the existing React+Vite SPA has a home page
When the migration is complete
Then the system MUST create `app/page.tsx` that renders the home content
And the home page MUST maintain the same features as the existing main.tsx
And the route MUST be accessible at `/`

#### Scenario: Documents routes map to documents directory
Given the existing application has document listing, upload, and search features
When the migration is complete
Then the system MUST create `app/documents/page.tsx` for the documents list
And the system MUST create `app/documents/upload/page.tsx` for file upload (or integrate in main documents page)
And the system MUST preserve all existing document management functionality
And the document routes MUST be accessible at `/documents`

#### Scenario: Search routes map to search directory
Given the existing application has document search functionality
When the migration is complete
Then the system MUST create `app/search/page.tsx` for the search page
And the search page MUST preserve all existing search features
And the search page MUST support server-side rendering if beneficial
And the search route MUST be accessible at `/search`

#### Scenario: API routes for serverless functions
Given the backend uses Vercel serverless functions
When the frontend makes API calls
Then the system MAY use Next.js API routes if needed (e.g., /api/proxy)
And the system MUST maintain compatibility with existing serverless endpoints
And API routes MUST NOT duplicate functionality handled by backend functions
