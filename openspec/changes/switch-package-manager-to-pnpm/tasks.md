# Tasks: Switch Package Manager to pnpm

## Phase 1: Preparation (No Breaking Changes)

### Task 1.1: Create migration documentation

**Order**: 1
**Estimated Time**: 30 minutes

- [x] Create `docs/PNPM_MIGRATION.md` with migration overview
- [x] Document pnpm commands and their npm equivalents
- [x] List common issues and solutions (phantom dependencies, strict mode)
- [x] Include troubleshooting section
- [x] Add rollback instructions

**Validation**:
- `test -f docs/PNPM_MIGRATION.md` passes
- File is well-formatted markdown

**Dependencies**: None

---

### Task 1.2: Audit for phantom dependencies

**Order**: 2
**Estimated Time**: 1 hour

- [x] Run `npx depcheck` in each workspace to find unused dependencies
- [x] Search for imports of packages not in `package.json` dependencies
- [x] Document all phantom dependencies found
- [x] Create a checklist of dependencies to add to `package.json`

**Validation**:
- `depcheck` report exists for each workspace
- Checklist of phantom dependencies is documented

**Dependencies**: None

**Notes**: Use `rg -n "import.*from ['\"]" apps/web/src --type ts | grep -v "node_modules"` to search for imports

---

### Task 1.3: Update README.md for pnpm

**Order**: 3
**Estimated Time**: 30 minutes

- [x] Replace all `npm install` with `pnpm install`
- [x] Replace all `npm run` with `pnpm run` (or `pnpm` shorthand)
- [x] Update development commands section
- [x] Update testing commands section
- [x] Add note about pnpm requirements (Node.js 16.9+)

**Validation**:
- `rg "npm" README.md` returns only in historical context or comments
- Commands use `pnpm` prefix

**Dependencies**: Task 1.1

---

### Task 1.4: Update CLAUDE.md for pnpm

**Order**: 4
**Estimated Time**: 20 minutes

- [x] Replace npm commands with pnpm equivalents
- [x] Update dependency management section
- [x] Update development commands references
- [x] Update monorepo workflow examples

**Validation**:
- `rg "npm" CLAUDE.md` returns only in historical context
- All development commands use `pnpm`

**Dependencies**: Task 1.1

---

### Task 1.5: Update TESTING.md for pnpm

**Order**: 5
**Estimated Time**: 15 minutes

- [x] Replace `npm install` with `pnpm install`
- [x] Replace `npm test` with `pnpm test`
- [x] Update frontend and backend testing sections
- [x] Update linting commands if mentioned

**Validation**:
- All test commands use `pnpm`

**Dependencies**: Task 1.1

---

### Task 1.6: Configure GitHub Actions for pnpm

**Order**: 6
**Estimated Time**: 30 minutes

- [x] Add `pnpm/action-setup@v4` before `actions/setup-node`
- [x] Update install commands to use `pnpm install`
- [x] Configure cache for pnpm store
- [x] Update all workflow files (`.github/workflows/*.yml`)
- [x] Test workflow locally if possible

**Validation**:
- `rg "actions/setup-node" .github/workflows` shows pnpm action before node setup
- `rg "npm install" .github/workflows` returns no results
- Cache configuration includes `~/.pnpm-store`

**Dependencies**: Task 1.1

---

### Task 1.7: Update pre-commit hooks for pnpm

**Order**: 7
**Estimated Time**: 20 minutes

- [x] Review `.pre-commit-config.yaml` for npm references
- [x] Update any hooks that run npm commands to use pnpm
- [x] Test pre-commit hooks still work with pnpm
- [x] Update setup-precommit.sh if needed

**Validation**:
- `rg "npm" .pre-commit-config.yaml` returns only in comments
- `pre-commit run --all-files` passes (if run)

**Dependencies**: Task 1.1



## Phase 2: Migration (Breaking Changes)

### Task 2.1: Create pnpm-workspace.yaml

**Order**: 8
**Estimated Time**: 10 minutes

- [x] Create `pnpm-workspace.yaml` at root
- [x] Configure workspace packages: `['apps/*', 'packages/*']`
- [x] Verify workspace paths match directory structure

**Validation**:
- `test -f pnpm-workspace.yaml` passes
- `cat pnpm-workspace.yaml` shows correct workspace paths

**Dependencies**: None

---

### Task 2.2: Update root package.json for pnpm

**Order**: 9
**Estimated Time**: 15 minutes

- [x] Remove `workspaces` field from root `package.json`
- [x] Add `packageManager: "pnpm@9.0.0"` field
- [x] Update clean script to remove `pnpm-lock.yaml`
- [x] Add engines field: `"engines": { "pnpm": ">=9.0.0" }`
- [x] Verify all other scripts remain unchanged

**Validation**:
- `cat package.json | jq .packageManager` shows `"pnpm@9.0.0"`
- `cat package.json | jq .workspaces` returns `null`
- `cat package.json | jq .engines` includes pnpm requirement

**Dependencies**: Task 2.1

---

### Task 2.3: Generate pnpm-lock.yaml files

**Order**: 10
**Estimated Time**: 30 minutes

- [x] Install pnpm globally: `npm install -g pnpm@9.0.0`
- [x] Run `pnpm install` at root to generate lock files
- [x] Verify `pnpm-lock.yaml` is created at root
- [x] Check that workspace dependencies are correctly resolved
- [x] Verify no errors during installation

**Validation**:
- `test -f pnpm-lock.yaml` passes
- `pnpm list` shows all workspace packages
- `pnpm list --depth=0` shows root dependencies

**Dependencies**: Task 2.1, Task 2.2

---

### Task 2.4: Fix phantom dependencies

**Order**: 11
**Estimated Time**: 2-4 hours

- [x] Address phantom dependencies found in Task 1.2
- [x] Add missing dependencies to workspace `package.json` files
- [x] Run `pnpm install` after each fix
- [x] Test imports work correctly
- [x] Remove any unused dependencies identified

**Validation**:
- All imports compile without errors
- `pnpm build` succeeds for all workspaces
- No "module not found" errors

**Dependencies**: Task 1.2, Task 2.3

**Notes**: This is the most time-consuming task. Address dependencies one workspace at a time.

---

### Task 2.5: Remove package-lock.json files

**Order**: 12
**Estimated Time**: 10 minutes

- [x] Delete root `package-lock.json`
- [x] Delete all workspace `package-lock.json` files
- [x] Verify no `package-lock.json` files remain in repo
- [x] Add `package-lock.json` to `.gitignore` (if not already)

**Validation**:
- `find . -name "package-lock.json" -type f` returns no results
- `.gitignore` includes `package-lock.json`

**Dependencies**: Task 2.3, Task 2.4

**Notes**: Only run this after confirming pnpm works correctly!

---

### Task 2.6: Update Vercel configuration

**Order**: 13
**Estimated Time**: 15 minutes

- [x] Verify root `package.json` has `packageManager` field (from Task 2.2)
- [x] Test Vercel build locally if possible (`vercel build`)
- [x] Update `vercel.json` if custom install commands are used
- [x] Verify build command still works: `turbo run build --filter=web`

**Validation**:
- `vercel.json` build command works with pnpm
- `vercel.json` doesn't override package manager detection
- Local build succeeds (if tested)

**Dependencies**: Task 2.2, Task 2.3

---

### Task 2.7: Update individual workspace scripts

**Order**: 14
**Estimated Time**: 30 minutes

- [x] Review scripts in `apps/web/package.json`
- [x] Review scripts in `apps/api/package.json`
- [x] Review scripts in `packages/*/package.json`
- [x] Update any hardcoded npm commands to pnpm equivalents
- [x] Note: Most scripts should use CLI commands directly (e.g., `next build`, not `npm run build`)

**Validation**:
- Scripts use direct CLI commands (preferred) or `pnpm run` (if needed)
- No `npm` or `npx` prefixes in scripts

**Dependencies**: Task 2.3

---

## Phase 3: Validation

### Task 3.1: Verify pnpm install works

**Order**: 15
**Estimated Time**: 10 minutes

- [x] Run `rm -rf node_modules pnpm-lock.yaml`
- [x] Run `pnpm install` at root
- [x] Verify all workspace dependencies installed
- [x] Check that workspace symlinks are created correctly

**Validation**:
- `ls node_modules` shows workspace packages as symlinks
- `pnpm list` displays all dependencies correctly
- No errors during install

**Dependencies**: Task 2.7

---

### Task 3.2: Verify Turbo commands work

**Order**: 16
**Estimated Time**: 20 minutes

- [x] Run `pnpm run build` (turbo run build)
- [x] Run `pnpm run lint` (turbo run lint)
- [x] Run `pnpm run typecheck` (turbo run typecheck)
- [x] Run `pnpm run test` (turbo run test)
- [x] Verify all commands complete successfully

**Validation**:
- All Turbo commands execute without errors
- Outputs match expected behavior
- Cache is created in `.turbo/` directory

**Dependencies**: Task 3.1

---

### Task 3.3: Run test suite

**Order**: 17
**Estimated Time**: 30 minutes

- [x] Run `pnpm test` to execute all tests
- [x] Verify all tests pass
- [x] Fix any failing tests caused by migration
- [x] Verify test coverage is unchanged

**Validation**:
- All tests pass
- No new test failures
- Test coverage report shows similar results to npm

**Dependencies**: Task 3.2

---

### Task 3.4: Run pre-commit hooks

**Order**: 18
**Estimated Time**: 15 minutes

- [x] Run `pre-commit run --all-files`
- [x] Verify all hooks pass
- [x] Fix any hook failures
- [x] Test git commit workflow

**Validation**:
- All pre-commit hooks pass
- `git commit` with staged files doesn't block on hooks

**Dependencies**: Task 3.3

---

### Task 3.5: Test local development workflow

**Order**: 19
**Estimated Time**: 20 minutes

- [x] Run `pnpm run dev` at root
- [x] Verify web app dev server starts
- [x] Verify api app compiles
- [x] Test hot reload functionality
- [x] Stop servers with Ctrl+C

**Validation**:
- Dev servers start successfully
- No build or runtime errors
- Hot reload works (edit a file and see changes)

**Dependencies**: Task 3.2

---

### Task 3.6: Test Vercel deployment

**Order**: 20
**Estimated Time**: 30 minutes

- [ ] Create a feature branch for testing
- [ ] Push to GitHub
- [ ] Create a pull request
- [ ] Wait for Vercel preview deployment
- [ ] Visit preview URL and verify:
  - [ ] Frontend loads correctly
  - [ ] API endpoints respond
  - [ ] No build errors

**Validation**:
- Vercel build succeeds
- Preview deployment is accessible
- All functionality works as expected

**Dependencies**: Task 3.5

**Notes**: This is the critical validation step. If Vercel deployment fails, rollback immediately.

---

### Task 3.7: Verify performance improvements

**Order**: 21
**Estimated Time**: 15 minutes

- [x] Measure disk usage: `du -sh node_modules`
- [x] Measure install time: `time pnpm install` (fresh install)
- [x] Compare to previous npm metrics (if documented)
- [x] Document improvements

**Validation**:
- Disk usage is <70% of npm usage
- Install time is <50% of npm time
- Metrics documented

**Dependencies**: Task 3.1

---

## Phase 4: Cleanup

### Task 4.1: Update onboarding documentation

**Order**: 22
**Estimated Time**: 30 minutes

- [x] Update `docs/` directory with pnpm-specific setup instructions
- [x] Update any contributor guides
- [x] Update `CONTRIBUTING.md` (if exists)
- [x] Document pnpm installation steps
- [x] Document common pnpm commands

**Validation**:
- All documentation references pnpm
- New developers can follow setup instructions

**Dependencies**: Task 3.6

---

### Task 4.2: Clean up npm references in scripts

**Order**: 23
**Estimated Time**: 20 minutes

- [x] Search for any remaining npm references in shell scripts
- [x] Search for npm references in Makefile
- [x] Search for npm references in Python scripts
- [x] Update all found references
- [x] Verify scripts still work

**Validation**:
- `rg -n "npm\b" --type sh --type py --type make` returns no results (except comments)
- All scripts execute correctly

**Dependencies**: Task 3.4

---

### Task 4.3: Archive npm-related files

**Order**: 24
**Estimated Time**: 10 minutes

- [x] Archive `package.json.backup` to `.npm-backup/`
- [x] Create `.npm-backup/` directory
- [x] Move any npm-specific notes to archive
- [x] Update `.gitignore` to ignore `.npm-backup/`

**Validation**:
- `.npm-backup/` directory exists
- No npm artifacts remain in root

**Dependencies**: Task 4.2

---

### Task 4.4: Verify no npm artifacts remain

**Order**: 25
**Estimated Time**: 10 minutes

- [x] Run `find . -name "package-lock.json" -type f` - expect no results
- [x] Run `rg -n "npm install" --exclude-dir=node_modules --exclude-dir=.git` - expect no results
- [x] Run `rg -n "npx " --exclude-dir=node_modules --exclude-dir=.git` - expect no results (except comments)
- [x] Verify `.npmrc` doesn't exist (or is updated for pnpm)

**Validation**:
- No npm lock files found
- No npm install commands in code
- No npm artifacts in repository

**Dependencies**: Task 4.3

---

### Task 4.5: Final documentation review

**Order**: 26
**Estimated Time**: 30 minutes

- [x] Review all updated documentation
- [x] Verify consistency across all docs
- [x] Check for any remaining npm references
- [x] Update AGENTS.md if needed
- [x] Update project-specific notes

**Validation**:
- All documentation is consistent
- No npm references remain
- Documentation is clear and accurate

**Dependencies**: Task 4.4

---

### Task 4.6: Create migration summary

**Order**: 27
**Estimated Time**: 15 minutes

- [x] Document migration timeline
- [x] List all changes made
- [x] Document any issues encountered and resolutions
- [x] Record performance improvements
- [x] Store summary in `docs/PNPM_MIGRATION_SUMMARY.md`

**Validation**:
- Migration summary document exists
- Summary is comprehensive and accurate

**Dependencies**: Task 4.5

---

## Parallelizable Tasks

The following tasks can be run in parallel:

- **Phase 1**: Tasks 1.3, 1.4, 1.5 (documentation updates)
- **Phase 1**: Task 1.6 and 1.7 (CI/CD and pre-commit) can run in parallel with documentation
- **Phase 2**: Task 2.1 and 2.2 (workspace configuration)
- **Phase 3**: Task 3.2, 3.3, 3.4 (validation tests) can run after Task 3.1 completes

## Critical Path

The critical path (tasks that must complete sequentially):

1. Task 1.2 → Task 2.4 (phantom dependency audit → fixing dependencies)
2. Task 2.1, 2.2 → Task 2.3 (workspace config → pnpm install)
3. Task 2.3, 2.4 → Task 2.5 (fix dependencies → remove npm lock files)
4. Task 2.7 → Task 3.1 (update scripts → verify pnpm install)
5. Task 3.1 → Task 3.2, 3.3, 3.4, 3.5 (validation tasks)
6. Task 3.5 → Task 3.6 (local dev → Vercel deployment)
7. Task 3.6 → All Phase 4 tasks

## Rollback Plan

If migration fails at any point:

### Phase 1 Failure
- Documentation changes only - no code impact
- Revert documentation changes from git

### Phase 2 Failure (Before removing npm lock files)
- Restore `package-lock.json` files from git
- Revert root `package.json` changes
- Delete `pnpm-workspace.yaml`
- Run `npm install` to restore npm state
- Estimated time: 10-15 minutes

### Phase 3 Failure (After removing npm lock files)
- Restore `package-lock.json` files from previous commit
- Revert all `package.json` changes
- Delete `pnpm-workspace.yaml`
- Run `npm install` to restore npm state
- Revert CI/CD configuration
- Estimated time: 20-30 minutes

### Phase 4 Failure
- Rare - only cleanup tasks remain
- Revert documentation updates
- Restore npm backup files
- Estimated time: 5-10 minutes

### Critical Rollback Point
If Task 3.6 (Vercel deployment) fails, rollback immediately using the Phase 2/3 rollback procedure.

## Estimated Timeline

- **Phase 1**: 3-4 hours (preparation, documentation, CI/CD setup)
- **Phase 2**: 4-6 hours (migration, fixing phantom dependencies)
- **Phase 3**: 2-3 hours (validation, testing, deployment)
- **Phase 4**: 2 hours (cleanup, documentation)

**Total**: 11-15 hours (excluding unknown phantom dependency issues)

## Notes

1. **Phantom Dependencies**: Task 2.4 is the biggest unknown. May take more or less time depending on how many exist.
2. **Team Communication**: Inform team of the migration before starting.
3. **Branching**: Create a feature branch for the migration to avoid disrupting main.
4. **Testing**: Test thoroughly in feature branch before merging to main.
5. **Deployment**: Ensure Vercel deployment works in preview before merging.
6. **Rollback**: Be prepared to rollback at any point. Keep a separate terminal with a fresh clone for quick testing.

## Success Metrics

Track the following metrics before and after migration:

1. **Disk Usage**: `du -sh node_modules` (target: <70% of npm)
2. **Install Time**: `time pnpm install` (target: <50% of npm)
3. **Test Pass Rate**: 100% (no regression)
4. **Build Time**: Same or better (Turborepo handles caching)
5. **Team Adoption**: 90%+ within 1 week
6. **Documentation Accuracy**: All references updated

## Blocked By

- None - can start immediately after proposal approval
