# Spec: Vercel Deployment

## MODIFIED Requirements

### Requirement: Turborepo-aware build command
The `vercel.json` MUST use Turborepo to build the web app with caching support.

**Previous Behavior**: Manual build with `cd frontend && npm run build && cp -r .next public ../`

**New Behavior**: Turborepo orchestrated build with `turbo run build --filter=web`

#### Scenario: Vercel builds web app with Turborepo
**Given** `vercel.json` contains:
```json
{
  "buildCommand": "turbo run build --filter=web",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": "apps/web/.next"
}
```
**When** Vercel triggers a build
**Then** it runs `npm install` to set up workspaces
**And** runs `turbo run build --filter=web`
**And** Turborepo builds the web app and its package dependencies
**And** uses cache from previous builds if available
**And** outputs build artifacts to `apps/web/.next/`

#### Scenario: Vercel serves Next.js from correct directory
**Given** the Next.js build output is in `apps/web/.next/`
**And** `vercel.json` specifies `"outputDirectory": "apps/web/.next"`
**When** Vercel deploys the project
**Then** it serves the Next.js app from `apps/web/.next/standalone` or appropriate output
**And** all frontend routes resolve correctly

### Requirement: API function path mapping
Vercel MUST detect serverless functions in `apps/api/` and serve them at `/api/*` routes.

#### Scenario: Vercel auto-detects API functions
**Given** serverless functions exist at:
- `apps/api/agent/index.ts`
- `apps/api/documents/index.ts`
- `apps/api/summaries/index.ts`
- `apps/api/notifications/index.ts`

**When** Vercel deploys the project
**Then** it creates serverless functions at:
- `/api/agent`
- `/api/documents`
- `/api/summaries`
- `/api/notifications`

**And** each function exports a default handler or named handler per Vercel conventions

#### Scenario: Rewrites route legacy paths to API functions
**Given** `vercel.json` contains:
```json
{
  "rewrites": [
    { "source": "/agent/:path*", "destination": "/api/agent" },
    { "source": "/agent/documents", "destination": "/api/documents" },
    { "source": "/agent/summaries", "destination": "/api/summaries" },
    { "source": "/poll", "destination": "/api/notifications" },
    { "source": "/internal/notify", "destination": "/api/notifications" }
  ]
}
```
**When** a client requests `/agent/search_qa`
**Then** Vercel rewrites the request to `/api/agent`
**And** the agent function handles the request

### Requirement: Deployment exclusions
Vercel MUST exclude non-deployable directories and files from the deployment bundle.

#### Scenario: Worker and packages excluded from deployment
**Given** `.vercelignore` contains:
```
apps/worker/
packages/
__pycache__
*.pyc
tests
htmlcov
**/*.test.ts
**/*.spec.ts
docs/
*.md
```
**When** Vercel builds the project
**Then** it excludes the `apps/worker/` directory (Python app)
**And** excludes `packages/` (only needed at build time, not runtime)
**And** excludes all test files and documentation

**And** the deployment size is minimized

### Requirement: Headers configuration
Vercel MUST apply COOP and COEP headers to all routes.

#### Scenario: Security headers applied
**Given** `vercel.json` contains:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```
**When** a client requests any route
**Then** Vercel includes `Cross-Origin-Opener-Policy: same-origin` header
**And** includes `Cross-Origin-Embedder-Policy: require-corp` header

### Requirement: Preview deployments
Vercel MUST support preview deployments for pull requests.

#### Scenario: PR triggers preview deployment
**Given** a developer creates a pull request
**When** Vercel detects the PR
**Then** it creates a preview deployment with a unique URL
**And** runs `turbo run build --filter=web` to build the app
**And** deploys both frontend and API functions to the preview environment

**And** the preview URL is commented on the PR

### Requirement: Environment variable support
Vercel MUST inject environment variables into both frontend and API functions at runtime.

#### Scenario: Frontend uses environment variables
**Given** Vercel project has environment variables configured:
- `NEXT_PUBLIC_API_BASE`
- `NEXT_PUBLIC_FIREBASE_API_KEY`

**When** the Next.js app is built
**Then** variables prefixed with `NEXT_PUBLIC_` are embedded in the client bundle
**And** the frontend can access them via `process.env.NEXT_PUBLIC_*`

#### Scenario: API functions use environment variables
**Given** Vercel project has environment variables configured:
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `OPENAI_API_KEY`

**When** an API function executes
**Then** it can access these variables via `process.env.*`
**And** they are not exposed to the client

### Requirement: Build cache integration
Vercel MUST persist Turborepo cache between builds for faster deployments.

#### Scenario: Subsequent builds use cache
**Given** a previous build has completed
**When** Vercel triggers a new build with no code changes
**Then** Turborepo restores cached outputs
**And** the build completes significantly faster (40-60% reduction)

**And** Vercel logs indicate "cache hit" for unchanged workspaces

## ADDED Requirements

### Requirement: Monorepo build verification
Developers MUST be able to verify the monorepo structure builds correctly before deploying to Vercel.

#### Scenario: Local build matches Vercel build
**Given** a developer has the monorepo structure set up locally
**When** they run `npm install` at root
**And** run `turbo run build`
**Then** the build completes successfully
**And** produces the same output as Vercel would produce
**And** all API functions compile without errors
**And** the Next.js app builds without errors
