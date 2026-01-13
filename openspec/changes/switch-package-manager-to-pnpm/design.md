# Design: Switch Package Manager to pnpm

## Architecture Overview

This document discusses the architectural implications of switching from npm to pnpm for the monorepo.

## Current State (npm)

### Dependency Storage
- npm stores a complete copy of dependencies in each `node_modules` directory
- For monorepos with workspaces, npm creates symlinked packages but duplicates dependencies across workspaces
- `package-lock.json` tracks the exact dependency tree

### Dependency Resolution
- npm allows "hoisting" - dependencies can be accessed by parent packages even if not explicitly declared
- This creates "phantom dependencies" that work during development but can break in production
- npm 7+ has strict peer dependency resolution by default but is more lenient with regular dependencies

### Performance Characteristics
- Install time: Medium to slow (serial install, many disk writes)
- Disk usage: High (duplicate dependencies across workspaces)
- Build time: Unchanged (Turborepo caching handles this)
- Workspace linking: Fast (symlinks)

### CI/CD Considerations
- npm is pre-installed in most CI environments
- Simple caching: cache `node_modules` and `package-lock.json`
- Vercel: Uses npm by default, requires `packageManager` field override

## Proposed State (pnpm)

### Dependency Storage
- pnpm uses a content-addressable store (usually `~/.pnpm-store`)
- Dependencies are stored once globally and hard-linked into `node_modules`
- Symbolic links create a virtual `node_modules` structure that respects package boundaries
- Much more efficient for monorepos with shared dependencies

### Dependency Resolution
- **Strict Mode**: Packages can only access their declared dependencies
- No phantom dependencies - prevents runtime errors from undeclared dependencies
- Peer dependencies are strictly enforced (fail on conflict by default)
- Creates a more deterministic build environment

### Performance Characteristics
- Install time: Fast (hard links are cheap, parallel operations)
- Disk usage: Low (dependencies stored once globally)
- Build time: Same (Turborepo still handles caching)
- Workspace linking: Fast (same symlink mechanism as npm)

### CI/CD Considerations
- pnpm must be installed in CI environments (single `npm i -g pnpm` or Corepack)
- Store caching: Cache `~/.pnpm-store` and `pnpm-lock.yaml`
- Vercel: Add `packageManager: "pnpm@<version>"` to root `package.json`
- Corepack (Node.js 16.9+) can manage pnpm version automatically

## Trade-offs

### Advantages of pnpm

1. **Disk Space Savings**
   - Current npm setup: ~2GB for monorepo (estimated)
   - Expected pnpm setup: ~600-800MB (60-70% reduction)
   - Significant savings for CI caches and local development

2. **Faster Install Times**
   - npm: ~30-60 seconds for fresh install
   - pnpm: ~10-20 seconds for fresh install
   - 2-3x faster improves developer productivity

3. **Stricter Dependency Enforcement**
   - Prevents accidental dependency on transitive packages
   - Catches bugs earlier in development
   - More reproducible builds

4. **Better Monorepo Performance**
   - pnpm workspaces have better caching and parallel execution
   - Native support for monorepo features like filtering and dependencies

5. **Industry Standard**
   - Used by Vercel, Next.js, Vue, Element Plus, and many others
   - Active development and community support
   - Future-proofing the codebase

### Disadvantages of pnpm

1. **Migration Effort**
   - Requires updating all scripts and documentation
   - CI/CD pipelines need modification
   - Team learning curve (though pnpm commands are similar to npm)

2. **Tooling Compatibility**
   - Some tools may not officially support pnpm (rare in modern ecosystem)
   - Pre-commit hooks need verification
   - IDE integrations usually work but may need configuration

3. **Strict Mode Breakage**
   - Existing code using phantom dependencies will break
   - Need to explicitly declare all dependencies
   - Could uncover hidden technical debt

4. **Store Management**
   - Global store requires maintenance (`pnpm store prune`)
   - Can be confusing for new team members
   - May need CI-specific store configuration

## Migration Strategy

### Phase 1: Preparation (No Breaking Changes)
- Document the migration plan for team
- Update scripts and documentation to use pnpm (can be run in parallel)
- Create checklist of phantom dependencies to fix
- Set up CI environment with pnpm (non-blocking)

### Phase 2: Migration (Breaking Changes)
- Generate `pnpm-lock.yaml` files
- Fix phantom dependencies as they're discovered
- Update Vercel configuration
- Migrate CI/CD pipelines
- Remove `package-lock.json` files

### Phase 3: Validation
- Run full test suite
- Verify all Turborepo commands work
- Test local development workflow
- Verify Vercel deployment

### Phase 4: Cleanup
- Update all documentation references
- Remove npm-related scripts or tools
- Update onboarding documentation
- Archive old npm references

## Implementation Details

### Root package.json Changes

```json
{
  "name": "python-agents",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "clean": "turbo run clean && rm -rf .turbo node_modules pnpm-lock.yaml"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

Note: pnpm workspaces are detected automatically via `pnpm-workspace.yaml` or `package.json` fields.

### pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

This replaces the `workspaces` field in root `package.json`.

### CI/CD Configuration

GitHub Actions:
```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 9.0.0
- run: pnpm install
- run: pnpm run build
```

### Vercel Configuration

Add to root `package.json`:
```json
{
  "packageManager": "pnpm@9.0.0"
}
```

Vercel will automatically use pnpm for builds.

### Pre-commit Hooks

Update `.pre-commit-config.yaml`:
```yaml
- repo: local
  hooks:
    - id: pnpm-install
      name: pnpm install
      entry: pnpm install
      language: system
      pass_filenames: false
```

## Risk Assessment

### Low Risk
- pnpm is mature and stable (v9+)
- Most tools support pnpm natively
- Rollback plan is straightforward

### Medium Risk
- Phantom dependencies may cause build failures
- Some CI environments need configuration
- Team familiarity with new tool

### Mitigations
- Run migration in feature branch
- Test thoroughly before merging
- Document all changes
- Provide rollback instructions
- Pair programming for initial fixes

## Rollback Plan

If migration fails:
1. Restore `package-lock.json` files from git
2. Remove `pnpm-lock.yaml` files
3. Revert root `package.json` to npm workspaces
4. Revert CI/CD configuration
5. Update documentation back to npm commands
6. Run `npm install` to restore npm state

Estimated rollback time: 15-30 minutes

## Success Metrics

- `pnpm install` time < 20 seconds
- Disk usage reduced by >50%
- All tests pass
- Zero build errors on Vercel
- No regressions in developer workflow
- Team adoption rate >90% after 1 week

## Dependencies

- Node.js 16.9+ (for Corepack support)
- Turborepo v2+ (compatible with pnpm)
- Vercel platform (supports pnpm via `packageManager` field)

## Timeline

- Phase 1: 2-4 hours (preparation)
- Phase 2: 4-6 hours (migration + fixes)
- Phase 3: 2-3 hours (validation)
- Phase 4: 1-2 hours (cleanup)

Total estimated: 9-15 hours

## Conclusion

Switching to pnpm provides significant performance and disk space benefits with minimal risk. The migration effort is justified by long-term productivity gains and alignment with industry best practices. The strict dependency enforcement will improve code quality and prevent runtime errors.
