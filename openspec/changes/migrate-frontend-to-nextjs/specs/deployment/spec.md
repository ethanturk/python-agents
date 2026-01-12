# Spec: Deployment Configuration

## ADDED Requirements

### Requirement: Vercel Monorepo Configuration
The system MUST configure a single Vercel project that deploys both Next.js frontend and Python serverless backend.

#### Scenario: Root vercel.json configures both projects
Given a monorepo with frontend/ and backend/ directories
When vercel.json is configured
Then the config MUST set the project name
Then the config MUST specify the frontend framework (nextjs)
Then the config MUST configure backend serverless function locations
And the config MUST work for both development and production deployments

#### Scenario: Frontend build configuration
Given Next.js is being deployed to Vercel
When the vercel.json build settings are configured
Then the build command MUST be null (uses package.json scripts)
Then the output directory MUST be `.next/`
Then the config MUST include any necessary environment variables
And the config MUST NOT interfere with the backend function deployment

#### Scenario: Backend function routing
Given the backend is split into serverless functions
When the vercel.json functions configuration is set
Then the config MUST route API paths to specific functions
And the config MUST include memory and duration limits for each function
And the agent function MUST use python3.11 runtime
And the config MUST include proper headers for API routes

### Requirement: Environment Variables
The system MUST support environment variables for both frontend and backend deployments.

#### Scenario: Development environment variables
Given a developer is running locally
When the application starts
Then the system MUST read from `.env.local` files
And the frontend MUST use `NEXT_PUBLIC_API_BASE` for API URL
And the backend MUST use standard environment variables (OPENAI_API_KEY, etc.)
And the system MUST validate that all required variables are present
And missing variables MUST cause clear error messages

#### Scenario: Production environment variables
Given the application is deployed to Vercel
When the application starts
Then Vercel MUST inject environment variables at runtime
Then the frontend MUST receive `NEXT_PUBLIC_*` variables for client access
Then the backend functions MUST receive environment variables for serverless execution
And the system MUST NOT commit production secrets to git

#### Scenario: Multi-environment support
Given the application supports multiple deployments (dev, staging, production)
When the monorepo is configured
Then each environment MUST have its own environment variables
Then the system MUST support different API URLs per environment
Then the system MUST support different Firebase configs per environment
And the system MUST allow easy switching between environments

### Requirement: Build Optimization
The system MUST optimize the Next.js build for deployment to Vercel.

#### Scenario: Production build is optimized
Given a production build is triggered
When `npm run build` runs
Then the build MUST generate optimized bundles
Then the build MUST use SWC minification
Then the build MUST create static assets for fast loading
And the build MUST NOT exceed Vercel's size limits

#### Scenario: Build time is acceptable
Given a production deployment is needed
When the build command is executed
Then the build MUST complete in under 3 minutes
Then the build MUST NOT use excessive memory
And the build MUST NOT timeout
And the build MUST generate an error if it fails
