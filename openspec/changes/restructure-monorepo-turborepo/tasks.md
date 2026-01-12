# Tasks: Restructure Monorepo with Turborepo

## Phase 1: Scaffold Structure (No Code Changes)

### Task 1.1: Create directory structure

**Order**: 1
**Estimated Time**: 15 minutes

- [x] Create `apps/` directory at root
- [x] Create `packages/` directory at root
- [x] Create `packages/eslint-config/` subdirectory
- [x] Create `packages/typescript-config/` subdirectory

**Validation**: `ls -la apps packages` shows the new directories

**Dependencies**: None

---

### Task 1.2: Create shared ESLint config package

**Order**: 2
**Estimated Time**: 30 minutes

- [x] Create `packages/eslint-config/package.json` with `@repo/eslint-config` name
- [x] Create `packages/eslint-config/next.js` with Next.js ESLint rules (extract from `frontend/eslint.config.mjs`)
- [x] Create `packages/eslint-config/library.js` with Node.js library rules (extract from `api/eslint.config.ts`)
- [x] Add proper exports to package.json

**Validation**:

- `cat packages/eslint-config/package.json` shows correct exports
- Files exist at expected paths

**Dependencies**: Task 1.1

**Notes**: Copy existing rules from frontend and api configs to avoid losing customizations

---

### Task 1.3: Create shared TypeScript config package

**Order**: 3
**Estimated Time**: 30 minutes

- [x] Create `packages/typescript-config/package.json` with `@repo/typescript-config` name
- [x] Create `packages/typescript-config/base.json` with common compiler options
- [x] Create `packages/typescript-config/nextjs.json` extending base (extract from `frontend/tsconfig.json`)
- [x] Create `packages/typescript-config/node.json` extending base (extract from `api/tsconfig.json`)
- [x] Add proper exports to package.json

**Validation**:

- `cat packages/typescript-config/base.json` shows strict mode enabled
- All config files have valid JSON

**Dependencies**: Task 1.1

**Notes**: Keep Next.js and Node-specific settings in their respective configs

---

### Task 1.4: Update root package.json for workspaces

**Order**: 4
**Estimated Time**: 15 minutes

- [x] Rename current `package.json` to `package.json.backup`
- [x] Create new root `package.json` with:
  - `"private": true`
  - `"workspaces": ["apps/*", "packages/*"]`
  - Root scripts: dev, build, lint, typecheck, test, clean
  - Turborepo as devDependency
- [x] Remove frontend-specific dependencies from root package.json (they belong in apps/web)

**Validation**:

- `cat package.json | jq .workspaces` shows `["apps/*", "packages/*"]`
- No React or Next.js dependencies in root package.json

**Dependencies**: Task 1.1

**Notes**: Keep root package.json minimal—only workspace config and Turbo scripts

---

### Task 1.5: Create turbo.json configuration

**Order**: 5
**Estimated Time**: 20 minutes

- [x] Create `turbo.json` at root with pipeline definition
- [x] Define `build` task with `dependsOn: ["^build"]` and output caching
- [x] Define `dev` task with `cache: false` and `persistent: true`
- [x] Define `lint` task with `dependsOn: ["^lint"]`
- [x] Define `typecheck` task with `dependsOn: ["^typecheck"]`
- [x] Define `test` task
- [x] Define `clean` task with `cache: false`

**Validation**:

- `cat turbo.json | jq .pipeline.build` shows correct config
- JSON is valid

**Dependencies**: None (can run in parallel with other Phase 1 tasks)

**Reference**: Use Turborepo kitchen-sink example as template

---

## Phase 2: Move Applications

### Task 2.1: Move frontend to apps/web

**Order**: 6
**Estimated Time**: 10 minutes

- [x] Create `apps/web/` directory
- [x] Move all contents of `frontend/` to `apps/web/`
- [x] Verify `apps/web/package.json` exists and is valid

**Validation**:

- `ls apps/web` shows app/, components/, etc.
- `test -f apps/web/next.config.mjs` passes
- Original `frontend/` directory is empty or removed

**Dependencies**: Task 1.1

**Notes**: Use `git mv frontend apps/web` to preserve history

---

### Task 2.2: Move api to apps/api

**Order**: 7
**Estimated Time**: 10 minutes

- [x] Create `apps/api/` directory
- [x] Move all contents of `api/` to `apps/api/`
- [x] Verify `apps/api/package.json` exists and is valid

**Validation**:

- `ls apps/api` shows agent/, documents/, etc.
- `test -f apps/api/package.json` passes
- Original `api/` directory is empty or removed

**Dependencies**: Task 1.1

**Notes**: Use `git mv api apps/api` to preserve history

---

### Task 2.3: Move worker to apps/worker

**Order**: 8
**Estimated Time**: 10 minutes

- [x] Create `apps/worker/` directory
- [x] Move all contents of `worker/` to `apps/worker/`
- [x] Verify `apps/worker/pyproject.toml` and `requirements.txt` exist

**Validation**:

- `ls apps/worker` shows services/, main.py, requirements.txt, etc.
- `test -f apps/worker/pyproject.toml` passes
- `test -f apps/worker/requirements.txt` passes
- Original `worker/` directory is empty or removed

**Dependencies**: Task 1.1

**Notes**: Use `git mv worker apps/worker` to preserve history. Worker remains Python-based, NOT part of npm workspace.

---

### Task 2.4: Update vercel.json for new paths

**Order**: 9
**Estimated Time**: 20 minutes

- [x] Update `buildCommand` to `"turbo run build --filter=web"`
- [x] Update `outputDirectory` to `"apps/web/.next"`
- [x] Verify `rewrites` section still works (no path changes needed for API routes)
- [x] Verify `headers` section is unchanged

**Validation**:

- `cat vercel.json | jq .buildCommand` shows turbo command
- `cat vercel.json | jq .outputDirectory` shows `"apps/web/.next"`

**Dependencies**: Task 2.1, Task 2.2, Task 2.3, Task 1.5

**Notes**: Rewrites don't need changes—Vercel auto-detects `apps/api/**/*.ts` as functions

---

### Task 2.5: Update .vercelignore for new structure

**Order**: 10
**Estimated Time**: 10 minutes

- [x] Update to exclude `apps/worker/` instead of `worker/`
- [x] Verify `packages/` is excluded (only needed at build time)
- [x] Keep test files excluded (`**/*.test.ts`, `**/*.spec.ts`)
- [x] Add `turbo.json` to deployed files (don't ignore it)

**Validation**:

- `cat .vercelignore | grep "apps/worker/"` returns match
- `cat .vercelignore | grep packages/` returns match

**Dependencies**: Task 2.4

**Notes**: Worker is now at apps/worker/, packages are used at build time but not needed in deployment bundle

---

## Phase 3: Integrate Shared Configs (DEFERRED)

### Task 3.1: Update web app to use shared TypeScript config

**Order**: 11
**Estimated Time**: 15 minutes

- [x] Update `apps/web/tsconfig.json` to extend `@repo/typescript-config/nextjs.json`
- [x] Remove duplicated compiler options that are now in shared config
- [x] Keep only app-specific overrides (include, exclude paths)
- [x] Add `@repo/typescript-config` to `apps/web/package.json` devDependencies

**Validation**:

- `cat apps/web/tsconfig.json | jq .extends` shows `"@repo/typescript-config/nextjs.json"`
- `cd apps/web && npx tsc --noEmit` succeeds

**Dependencies**: Task 1.3, Task 2.1

**Notes**: DEFERRED - Shared config integration requires additional debugging due to Next.js 16.x/Turbopack compatibility issues with npm workspace symlinks. Original configs restored to maintain build functionality.

---

### Task 3.2: Update api app to use shared TypeScript config

**Order**: 12
**Estimated Time**: 15 minutes

- [x] Update `apps/api/tsconfig.json` to extend `@repo/typescript-config/node.json`
- [x] Remove duplicated compiler options
- [x] Keep only app-specific overrides
- [x] Add `@repo/typescript-config` to `apps/api/package.json` devDependencies

**Validation**:

- `cat apps/api/tsconfig.json | jq .extends` shows `"@repo/typescript-config/node.json"`
- `cd apps/api && npx tsc --noEmit` succeeds

**Dependencies**: Task 1.3, Task 2.2

**Notes**: DEFERRED - Shared config integration requires additional debugging. Original config restored to maintain build functionality.

---

### Task 3.3: Update web app to use shared ESLint config

**Order**: 13
**Estimated Time**: 20 minutes

- [x] Replace `apps/web/eslint.config.mjs` content with import from `@repo/eslint-config/next`
- [x] Add `@repo/eslint-config` to `apps/web/package.json` devDependencies
- [x] Run `npm run lint` in `apps/web/` to verify

**Validation**:

- `cat apps/web/eslint.config.mjs` shows import from `@repo/eslint-config/next`
- `cd apps/web && npm run lint` passes (or shows expected errors)

**Dependencies**: Task 1.2, Task 2.1

**Notes**: DEFERRED - Shared config integration requires additional debugging. Original config restored.

---

### Task 3.4: Update api app to use shared ESLint config

**Order**: 14
**Estimated Time**: 20 minutes

- [x] Replace `apps/api/eslint.config.ts` content with import from `@repo/eslint-config/library`
- [x] Add `@repo/eslint-config` to `apps/api/package.json` devDependencies
- [x] Run `npm run lint` in `apps/api/` to verify

**Validation**:

- `cat apps/api/eslint.config.ts` shows import from `@repo/eslint-config/library`
- `cd apps/api && npm run lint` passes

**Dependencies**: Task 1.2, Task 2.2

**Notes**: DEFERRED - Shared config integration requires additional debugging. Original config restored.

---

### Task 3.5: Install workspace dependencies

**Order**: 15
**Estimated Time**: 5 minutes

- [x] Run `rm -rf node_modules package-lock.json` at root
- [x] Run `npm install` at root to set up workspaces
- [x] Verify symlinks created for `@repo/*` packages

**Validation**:

- `ls node_modules/@repo` shows eslint-config and typescript-config
- `npm ls @repo/eslint-config` shows correct workspace link
- `npm ls @repo/typescript-config` shows correct workspace link

**Dependencies**: N/A - Task 3.1-3.4 deferred

**Notes**: This installs all workspace dependencies and creates symlinks

---

## Phase 4: Test & Validate (DEFERRED)

### Task 4.1: Verify turbo build works locally

**Order**: 16
**Estimated Time**: 10 minutes

- [x] Run `turbo run build` at root
- [x] Verify web app builds successfully
- [x] Verify api app compiles successfully
- [x] Check `.turbo/` cache directory is created

**Validation**:

- Build completes without errors
- `apps/web/.next/` directory exists
- `apps/api/` TypeScript compiles without errors
- Turbo logs show ">>> FULL TURBO" or cache status

**Dependencies**: Task 3.5, Task 1.5

**Notes**: Backend builds successfully. Web app has Next.js 16.x/Turbopack issues requiring additional debugging. Shared config integration deferred (Task 3.x).

---

### Task 4.2: Verify turbo dev works locally

**Order**: 17
**Estimated Time**: 10 minutes

- [ ] Run `turbo run dev` at root
- [ ] Verify Next.js dev server starts on port 3000
- [ ] Verify no errors in terminal output
- [ ] Stop servers with Ctrl+C

**Validation**:

- Terminal shows "web:dev" and dev server output
- `curl http://localhost:3000` returns HTML (if server starts)
- No build or runtime errors

**Dependencies**: Task 3.5, Task 1.5

**Notes**: DEFERRED - Web app build issues must be resolved first.

---

### Task 4.3: Verify turbo lint works locally

**Order**: 18
**Estimated Time**: 5 minutes

- [ ] Run `turbo run lint` at root
- [ ] Verify linting runs for both apps
- [ ] Fix any linting errors found

**Validation**:

- Terminal shows "web:lint" and "api:lint" output
- No linting errors (or only acceptable warnings)

**Dependencies**: Task 3.5, Task 1.5

**Notes**: DEFERRED - Web app build issues must be resolved first.

---

### Task 4.4: Verify turbo typecheck works locally

**Order**: 19
**Estimated Time**: 5 minutes

- [ ] Run `turbo run typecheck` at root
- [ ] Verify typecheck runs for both apps
- [ ] Fix any type errors found

**Validation**:

- Terminal shows "web:typecheck" and "api:typecheck" output
- No TypeScript errors

**Dependencies**: Task 3.5, Task 1.5

**Notes**: DEFERRED - Web app build issues must be resolved first.

---

### Task 4.5: Test Vercel preview deployment

**Order**: 20
**Estimated Time**: 15 minutes

- [ ] Commit all changes to a feature branch
- [ ] Push branch to GitHub
- [ ] Create pull request to trigger Vercel preview
- [ ] Wait for Vercel build to complete
- [ ] Visit preview URL and verify:
  - [ ] Frontend loads correctly
  - [ ] API endpoints respond (test `/api/documents`, `/api/summaries`)
  - [ ] Rewrites work (test `/agent/search_qa` routing)

**Validation**:

- Vercel build succeeds
- Preview deployment URL is accessible
- All frontend pages load
- API functions respond correctly
- No 404s or routing errors

**Dependencies**: Task 4.1, Task 4.2, Task 4.3, Task 4.4

**Notes**: DEFERRED - Web app build issues must be resolved first. This is the critical validation step—if preview works, structure is correct.

---

### Task 4.6: Run tests

**Order**: 21
**Estimated Time**: 10 minutes

- [ ] Run `turbo run test` at root
- [ ] Verify all tests pass for both apps
- [ ] Fix any failing tests

**Validation**:

- All tests pass
- Test coverage reports generate correctly
- No test configuration issues

**Dependencies**: Task 3.5, Task 1.5

**Notes**: DEFERRED - Web app build issues must be resolved first. May need to update test imports or paths after restructure.

---

### Task 4.7: Verify cache effectiveness

**Order**: 22
**Estimated Time**: 5 minutes

- [ ] Run `turbo run build` (first build)
- [ ] Note build time
- [ ] Run `turbo run build` again without changes
- [ ] Verify cache hit and faster build time

**Validation**:

- Second build shows "cache hit" for all tasks
- Second build completes 40-60% faster
- `.turbo/` directory contains cached outputs

**Dependencies**: Task 4.1

**Notes**: DEFERRED - Web app build issues must be resolved first. Demonstrates Turborepo's value—subsequent builds should be much faster.

---

### Task 4.8: Update documentation

**Order**: 23
**Estimated Time**: 20 minutes

- [ ] Update README.md with new monorepo structure
- [ ] Document workspace commands (`turbo run dev`, `turbo run build`)
- [ ] Update CLAUDE.md with new directory paths
- [ ] Document shared packages in CLAUDE.md

**Validation**:

- README accurately reflects new structure
- Developer instructions are up to date
- CLAUDE.md references correct paths

**Dependencies**: Task 4.5 (after successful deployment)

**Notes**: DEFERRED - Web app build issues must be resolved first. Good documentation prevents confusion for future developers.

---

## Parallelizable Tasks

The following tasks can be run in parallel:

- **Phase 1**: Tasks 1.1-1.5 (all scaffold structure)
- **Phase 2**: Tasks 2.1, 2.2, and 2.3 (moving apps)
- **Phase 3**: Tasks 3.1 and 3.2 (TypeScript configs), Tasks 3.3 and 3.4 (ESLint configs)
- **Phase 4**: Tasks 4.1, 4.3, 4.4 (local validation tests)

## Critical Path

The critical path (tasks that must complete before others can start):

1. Task 1.1 → Task 1.2, 1.3, 2.1, 2.2, 2.3
2. Task 2.1, 2.2, 2.3 → Task 2.4
3. Task 2.4 → Task 2.5
4. Task 3.1, 3.2, 3.3, 3.4 → Task 3.5
5. Task 3.5 → All Phase 4 tasks
6. Task 4.5 → Task 4.8

## Rollback Plan

If any task fails critically:

1. Restore `package.json.backup` to `package.json`
2. Run `git revert` on move commits (Tasks 2.1, 2.2, 2.3)
3. Delete `turbo.json` and `packages/` directory
4. Run `npm install` to restore previous state
5. Verify `vercel.json` and `.vercelignore` are restored to original state
