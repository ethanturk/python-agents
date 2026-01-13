# Change: Switch Package Manager to pnpm

## Why
npm workspaces have slower install times and higher disk usage due to duplicate dependencies across workspaces. Switching to pnpm provides faster installations, disk space efficiency through hard-linking, and stricter dependency enforcement that prevents phantom dependencies.

## What Changes
- **BREAKING**: Replace npm with pnpm as the package manager across the monorepo
- Remove all `package-lock.json` files and replace with `pnpm-lock.yaml`
- Update root `package.json` to use `packageManager: "pnpm@9.0.0"` field
- Create `pnpm-workspace.yaml` to define workspace packages
- Update all documentation (README, CLAUDE.md, TESTING.md) to reference pnpm commands
- Configure GitHub Actions to use `pnpm/action-setup@v4`
- Update Vercel deployment to use pnpm (automatic via `packageManager` field)
- Update pre-commit hooks and scripts to use pnpm
- Fix any phantom dependencies exposed by pnpm's strict mode
- Update CI/CD pipelines to use pnpm

## Impact
- Affected specs: `turborepo-config`
- Affected code: All `package.json` files, CI/CD workflows, pre-commit hooks, documentation files (README.md, CLAUDE.md, TESTING.md), deployment configuration (vercel.json)
