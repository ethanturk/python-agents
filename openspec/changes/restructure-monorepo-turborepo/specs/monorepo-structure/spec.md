# Spec: Monorepo Structure

## ADDED Requirements

### Requirement: Directory organization with apps and packages
The monorepo MUST organize code into `apps/` for deployable applications and `packages/` for shared configurations and libraries.

#### Scenario: Developer navigates project structure
**Given** a developer opens the project root
**When** they list directories
**Then** they see:
- `apps/web/` containing the Next.js frontend
- `apps/api/` containing Vercel serverless functions
- `apps/worker/` containing the Python Celery worker
- `packages/eslint-config/` containing shared ESLint configurations
- `packages/typescript-config/` containing shared TypeScript configurations

**And** Node.js apps under `apps/` have their own `package.json`
**And** Python worker under `apps/worker/` has its own `pyproject.toml` and `requirements.txt`
**And** each package under `packages/` has its own `package.json` with proper naming (`@repo/*`)

#### Scenario: Vercel deployment excludes non-deployable code
**Given** Vercel is building the project
**When** the build process reads `.vercelignore`
**Then** the following are excluded from deployment:
- `apps/worker/` directory (Python app, not deployed to Vercel)
- `packages/` directory (used only at build time)
- Test files (`**/*.test.ts`, `**/*.spec.ts`)
- Python files (`__pycache__`, `*.pyc`)
- Documentation (`docs/`, `*.md`)

### Requirement: npm workspaces configuration
The root `package.json` MUST define npm workspaces for all apps and packages.

#### Scenario: Root workspace installs all dependencies
**Given** the root `package.json` contains:
```json
{
  "name": "python-agents-monorepo",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```
**When** a developer runs `npm install` at the root
**Then** npm installs dependencies for all workspace packages
**And** shared dependencies are hoisted to root `node_modules/`
**And** package-specific dependencies remain in each workspace's `node_modules/`

#### Scenario: Apps reference shared packages
**Given** `apps/web/package.json` contains `"@repo/typescript-config": "*"` as a dependency
**When** npm installs dependencies
**Then** the package is symlinked from `packages/typescript-config/`
**And** TypeScript can resolve `@repo/typescript-config` imports

### Requirement: Worker organization and isolation
The Python worker MUST be located at `apps/worker/` but remain isolated from the npm workspace.

#### Scenario: Worker is organized under apps/
**Given** the project has a monorepo structure
**When** a developer lists `apps/`
**Then** they see:
- `apps/web/` (Node.js/Next.js)
- `apps/api/` (Node.js/Vercel functions)
- `apps/worker/` (Python/Celery)

**And** all applications are co-located under `apps/`

#### Scenario: Worker is not part of npm workspace
**Given** the `apps/worker/` directory exists
**When** a developer runs `npm install` at root
**Then** npm does NOT attempt to install worker dependencies
**And** the worker maintains its own `requirements.txt` and `pyproject.toml`
**And** the worker is NOT listed in root `package.json` workspaces

#### Scenario: Worker has independent deployment
**Given** the worker is deployed to Azure Container Instances or Docker
**When** Vercel deploys the monorepo
**Then** the worker code is not included in Vercel deployment (excluded via `.vercelignore`)
**And** the worker continues to function independently

### Requirement: Consistent package naming
All shared packages MUST use the `@repo/` scope prefix.

#### Scenario: Shared packages follow naming convention
**Given** shared packages exist under `packages/`
**When** a developer inspects their `package.json` files
**Then** each has a name starting with `@repo/`:
- `@repo/eslint-config`
- `@repo/typescript-config`
- `@repo/types` (future)

**And** apps reference them using the same scoped name in their dependencies
