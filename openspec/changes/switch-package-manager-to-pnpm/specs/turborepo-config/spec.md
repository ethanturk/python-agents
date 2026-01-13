# Spec Delta: Turborepo Configuration (pnpm Migration)

## MODIFIED Requirements

### Requirement: Root-level convenience scripts (MODIFIED)
The root `package.json` MUST provide convenience scripts for common Turborepo commands using pnpm.

#### Scenario: Developer uses root scripts with pnpm
**Given** root `package.json` contains:
```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "clean": "turbo run clean && rm -rf .turbo node_modules pnpm-lock.yaml"
  },
  "packageManager": "pnpm@9.0.0"
}
```
**When** a developer runs `pnpm run dev` at root
**Then** Turborepo executes the dev task for all workspaces
**And** the workspace configuration is managed by pnpm

## ADDED Requirements

### Requirement: pnpm workspace configuration
The project MUST use pnpm workspaces instead of npm workspaces for monorepo dependency management.

#### Scenario: pnpm-workspace.yaml defines workspaces
**Given** a file `pnpm-workspace.yaml` exists at root with:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```
**When** a developer runs `pnpm install` at root
**Then** pnpm installs dependencies for all workspaces
**And** dependencies are hard-linked from the pnpm store
**And** workspace packages are symlinked correctly

#### Scenario: Package Manager field in package.json
**Given** root `package.json` contains:
```json
{
  "packageManager": "pnpm@9.0.0"
}
```
**When** tools inspect the project (e.g., Vercel, IDEs)
**Then** they detect pnpm as the package manager
**And** use pnpm commands for dependency management

### Requirement: pnpm lock file management
The project MUST use `pnpm-lock.yaml` files instead of `package-lock.json` for dependency resolution.

#### Scenario: Lock file generation
**Given** pnpm is installed and the project has workspaces defined
**When** a developer runs `pnpm install` at root
**Then** a `pnpm-lock.yaml` file is created at root
**And** lock files are created for each workspace if needed
**And** no `package-lock.json` files exist in the repository

#### Scenario: Deterministic installs
**Given** a `pnpm-lock.yaml` file exists at root
**When** a developer runs `pnpm install` in a fresh environment
**Then** the exact same dependency versions are installed
**And** the dependency tree matches the lock file
**And** builds are reproducible across environments

### Requirement: Strict dependency enforcement
The project MUST leverage pnpm's strict dependency management to prevent phantom dependencies.

#### Scenario: No phantom dependencies
**Given** a package declares only its direct dependencies in `package.json`
**When** the package tries to import a transitive dependency
**Then** the import fails at runtime or install time
**And** the error message indicates the dependency is not declared
**And** developers must explicitly declare all dependencies

#### Scenario: Explicit dependency declaration
**Given** a package uses a transitive dependency
**When** developers update `package.json` to include the dependency
**And** run `pnpm install`
**Then** the dependency is properly installed
**And** the package can access the dependency without errors

### Requirement: pnpm store configuration
The project MUST document pnpm store configuration for CI/CD environments.

#### Scenario: CI store caching
**Given** a CI environment with limited disk space
**When** the CI pipeline runs `pnpm install`
**Then** the pnpm store is cached between builds
**And** subsequent installs use the cached store
**And** install times are significantly faster

#### Scenario: Local store location
**Given** the `pnpm` command is configured
**When** a developer runs `pnpm store path`
**Then** the global store location is displayed
**And** developers understand where dependencies are stored
**And** they can manage the store with `pnpm store prune`

### Requirement: CI/CD pnpm integration
The project MUST configure CI/CD pipelines to use pnpm instead of npm.

#### Scenario: GitHub Actions with pnpm
**Given** a GitHub Actions workflow
**When** the workflow installs dependencies
**Then** it uses the `pnpm/action-setup@v4` action
**And** specifies the pnpm version
**And** runs `pnpm install` instead of `npm install`

#### Scenario: Pre-commit hooks with pnpm
**Given** pre-commit hooks are configured
**When** hooks run before git commit
**Then** they use `pnpm run lint`, `pnpm run test`, etc.
**And** dependencies are installed with pnpm
**And** hooks pass successfully

### Requirement: Vercel deployment with pnpm
The project MUST configure Vercel to use pnpm for builds.

#### Scenario: Vercel detects pnpm
**Given** root `package.json` contains `"packageManager": "pnpm@9.0.0"`
**When** Vercel builds the project
**Then** Vercel automatically uses pnpm for installation
**And** runs `pnpm install` during the build process
**And** the deployment succeeds without errors

#### Scenario: Custom install command (if needed)
**Given** Vercel build configuration
**When** a custom install command is specified
**Then** the command uses `pnpm install --frozen-lockfile`
**And** the lock file is not modified during build
**And** deployment remains deterministic

## REMOVED Requirements

### Requirement: npm workspace configuration (REMOVED)
**Reason**: Replaced by pnpm workspace configuration

**Previous**: The root `package.json` MUST include a `workspaces` field for npm workspace management.

**Replacement**: See "ADDED Requirement: pnpm workspace configuration"

### Requirement: npm lock file management (REMOVED)
**Reason**: Replaced by pnpm lock file management

**Previous**: The project MUST use `package-lock.json` files for dependency resolution.

**Replacement**: See "ADDED Requirement: pnpm lock file management"
