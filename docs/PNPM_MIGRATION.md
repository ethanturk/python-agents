# pnpm Migration Guide

This document provides an overview of migrating from npm to pnpm for the monorepo, including common commands, troubleshooting, and rollback instructions.

## Overview

We have switched from npm to pnpm as the package manager for this monorepo. pnpm provides:
- **Faster installs**: 2-3x faster than npm due to hard-linking
- **Disk efficiency**: 60-70% reduction in disk usage
- **Strict mode**: Prevents phantom dependencies
- **Better monorepo support**: Native workspace features

## Prerequisites

- Node.js 16.9+ (for Corepack support)
- pnpm 9.0.0 or higher

## Installation

### Using Corepack (Recommended)
```bash
corepack enable
corepack prepare pnpm@9.0.0 --activate
```

### Using npm
```bash
npm install -g pnpm@9.0.0
```

## Common Commands

### Installation
```bash
# Install all dependencies
pnpm install

# Install a dependency in the root
pnpm add <package>

# Install a dev dependency
pnpm add -D <package>

# Install a dependency in a specific workspace
pnpm add <package> -w --filter=<workspace-name>
```

### Running Scripts
```bash
# Run a script in the root
pnpm run <script-name>
# or shorthand
pnpm <script-name>

# Run a script in all workspaces
pnpm run -r <script-name>

# Run a script in a specific workspace
pnpm run --filter=<workspace-name> <script-name>
```

### Common Development Commands
```bash
# Start development servers (all apps)
pnpm dev

# Build all packages
pnpm build

# Run linting
pnpm lint

# Run type checking
pnpm typecheck

# Run tests
pnpm test

# Clean all artifacts
pnpm clean
```

### Workspace Management
```bash
# List all workspaces
pnpm list --depth=0

# Show dependency tree
pnpm list

# Install missing dependencies in all workspaces
pnpm install -r

# Run command in specific workspace
pnpm --filter <workspace-name> <command>
```

## Key Differences from npm

### Strict Mode
pnpm enforces strict dependency resolution. Packages can only access dependencies explicitly listed in their `package.json`. This prevents "phantom dependencies" that work in development but fail in production.

**If you get a "module not found" error:**
1. Check if the package is imported in your code
2. Add it to your workspace's `package.json` as a dependency
3. Run `pnpm install` to update lock file

### No `npx`
Use `pnpm exec` instead of `npx`:
```bash
# npm
npx <command>

# pnpm
pnpm exec <command>
# or
pnpm dlx <command>
```

### Store Location
pnpm uses a content-addressable store (typically `~/.pnpm-store`) and creates hard links to `node_modules`. This is more efficient but requires occasional maintenance.

### Workspace Configuration
Workspaces are defined in `pnpm-workspace.yaml` instead of the `workspaces` field in `package.json`.

## Common Issues and Solutions

### Issue: "module not found" after migration
**Cause**: Phantom dependency that was accessible in npm but not declared in `package.json`

**Solution**:
```bash
# Find where the missing package is imported
rg -n "import.*from ['\"]<package-name>" apps/ --type ts

# Add it to the appropriate package.json
pnpm add <package-name> --filter=<workspace-name>
```

### Issue: Build fails with peer dependency warnings
**Cause**: pnpm strictly enforces peer dependencies

**Solution**:
1. Add the missing peer dependency:
   ```bash
   pnpm add <peer-package> --filter=<workspace-name>
   ```
2. Or override peer dependency (use cautiously):
   ```bash
   pnpm add <peer-package>@version --peer --filter=<workspace-name>
   ```

### Issue: Cannot find workspace package
**Cause**: Incorrect workspace name in `pnpm-workspace.yaml`

**Solution**:
1. Check `pnpm-workspace.yaml` for correct glob patterns
2. Verify workspace directory names match patterns
3. Run `pnpm list --depth=0` to see detected workspaces

### Issue: Install is slow
**Cause**: Store is corrupted or not optimized

**Solution**:
```bash
# Clean the store
pnpm store prune

# Reinstall from scratch
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Issue: CI/CD pipeline fails
**Cause**: pnpm not installed or cache misconfigured

**Solution**:
1. Ensure `pnpm/action-setup@v4` is in GitHub Actions
2. Check cache configuration includes `~/.pnpm-store`
3. Verify `packageManager` field in root `package.json`

## Rollback Instructions

If you need to rollback to npm:

1. **Restore npm lock files**:
   ```bash
   git checkout HEAD -- package-lock.json
   # Also restore workspace lock files if needed
   ```

2. **Revert package.json changes**:
   ```bash
   git checkout HEAD -- package.json
   ```

3. **Remove pnpm workspace file**:
   ```bash
   rm pnpm-workspace.yaml
   ```

4. **Restore npm state**:
   ```bash
   rm -rf node_modules
   npm install
   ```

5. **Revert CI/CD and documentation**:
   ```bash
   git checkout HEAD -- .github/workflows/ README.md CLAUDE.md TESTING.md
   ```

Estimated rollback time: 15-30 minutes

## Performance Metrics

### Before (npm)
- Disk usage: ~2GB
- Fresh install: ~30-60 seconds

### After (pnpm)
- Disk usage: ~600-800MB (60-70% reduction)
- Fresh install: ~10-20 seconds (2-3x faster)

## Additional Resources

- [pnpm Documentation](https://pnpm.io/)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Why pnpm?](https://pnpm.io/motivation)
- [Migrating from npm](https://pnpm.io/npm-vs-pnpm)

## Getting Help

If you encounter issues not covered here:
1. Check the [pnpm FAQ](https://pnpm.io/faq)
2. Search [pnpm GitHub issues](https://github.com/pnpm/pnpm/issues)
3. Contact the team in #dev-tools channel

## Notes for Contributors

- Always run `pnpm install` after pulling changes
- Use `pnpm` commands instead of `npm` in scripts
- Report any dependency issues immediately
- Check `pnpm list` if you're unsure about installed packages
