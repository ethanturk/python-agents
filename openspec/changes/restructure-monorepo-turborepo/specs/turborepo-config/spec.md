# Spec: Turborepo Configuration

## ADDED Requirements

### Requirement: Turborepo pipeline definition
The project MUST include a `turbo.json` at the root defining task pipelines for build, dev, lint, typecheck, test, and clean.

#### Scenario: Build task with caching
**Given** `turbo.json` defines:
```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    }
  }
}
```
**When** a developer runs `turbo run build`
**Then** Turborepo builds all packages in dependency order
**And** caches outputs in `.turbo/`
**And** subsequent runs reuse cached results if inputs haven't changed

**And** packages build before apps that depend on them (via `^build` dependency)

#### Scenario: Development task without caching
**Given** `turbo.json` defines:
```json
{
  "pipeline": {
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```
**When** a developer runs `turbo run dev`
**Then** Turborepo starts dev servers for all apps in parallel
**And** servers remain running (persistent mode)
**And** no caching occurs (cache: false)

#### Scenario: Lint and typecheck tasks
**Given** `turbo.json` defines:
```json
{
  "pipeline": {
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    }
  }
}
```
**When** a developer runs `turbo run lint` or `turbo run typecheck`
**Then** Turborepo runs the task for all workspaces
**And** respects dependency order (packages before apps)

### Requirement: Task filtering
Turborepo MUST support filtering tasks to specific workspaces using the `--filter` flag.

#### Scenario: Build only the web app
**Given** the web app is located at `apps/web/`
**When** a developer runs `turbo run build --filter=web`
**Then** Turborepo builds only the web app and its dependencies
**And** skips building the api app

#### Scenario: Run dev servers for all apps
**Given** apps exist at `apps/web/` and `apps/api/`
**When** a developer runs `turbo run dev --filter='apps/*'`
**Then** Turborepo starts dev servers for both web and api
**And** skips package dev scripts (if any)

### Requirement: Root-level convenience scripts
The root `package.json` MUST provide convenience scripts for common Turborepo commands.

#### Scenario: Developer uses root scripts
**Given** root `package.json` contains:
```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "clean": "turbo run clean && rm -rf .turbo node_modules"
  }
}
```
**When** a developer runs `npm run dev` at root
**Then** Turborepo executes the dev task for all workspaces

### Requirement: Cache configuration
Turborepo MUST cache build outputs to improve performance on subsequent runs.

#### Scenario: Cache hit on unchanged code
**Given** a developer has run `turbo run build` once
**When** they run `turbo run build` again without changing any files
**Then** Turborepo restores cached outputs from `.turbo/`
**And** skips re-running the build
**And** displays "cache hit" in output

#### Scenario: Cache miss on changed code
**Given** a developer has run `turbo run build` once
**When** they modify `apps/web/app/page.tsx`
**And** run `turbo run build` again
**Then** Turborepo detects the input change
**And** re-runs the build for `apps/web/`
**And** displays "cache miss" in output
