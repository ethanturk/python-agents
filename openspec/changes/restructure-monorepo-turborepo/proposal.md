# Proposal: Restructure Monorepo with Turborepo

## Summary
Restructure the existing monorepo to follow Turborepo patterns using npm workspaces, organizing applications under `apps/` and shared configurations under `packages/`, with optimized Vercel deployment.

## Motivation
- **Better Organization**: Clear separation between applications (frontend, api) and shared packages (configs, types)
- **Improved Build Performance**: Turborepo provides intelligent caching and parallel task execution
- **Simplified Dependency Management**: npm workspaces eliminate duplicate dependencies and simplify version management
- **Industry Standard**: Aligns with Vercel's recommended monorepo structure for optimal deployment
- **Developer Experience**: Consistent tooling, scripts, and conventions across the entire workspace
- **Maintainability**: Shared ESLint, TypeScript, and other configs reduce duplication and drift

## Goals
1. Reorganize directory structure into `apps/` (frontend, api, worker) and `packages/` (shared configs)
2. Implement Turborepo for task orchestration and caching
3. Configure npm workspaces for dependency management
4. Create shared packages for ESLint, TypeScript, and other common configs
5. Optimize Vercel deployment with proper build outputs and routing
6. Maintain backward compatibility with existing deployment and scripts
7. Move worker to apps/ directory as another application in the monorepo

## Non-Goals
- Migrating from npm to pnpm or yarn (keeping npm workspaces)
- Changing the Python worker architecture or deployment
- Modifying existing API or frontend functionality
- Creating shared UI component library (future enhancement)
- Migrating to Nx or other monorepo tools

## Success Criteria
- Directory structure matches Turborepo kitchen-sink pattern with apps/ and packages/
- Worker is located at `apps/worker/` alongside other applications
- `turbo.json` defines pipeline for build, dev, lint, test, and typecheck tasks
- All builds complete successfully with `turbo run build`
- Vercel deploys frontend and api functions, excluding worker from deployment
- Dev workflow (`turbo run dev`) starts both frontend and api in parallel
- Shared packages (eslint-config, tsconfig) are consumed by Node.js apps
- No duplication of dependencies between workspace packages
- Worker maintains its Python environment and tooling (pyproject.toml, requirements.txt)

## Related Changes
- migrate-frontend-to-nextjs - Frontend is migrating to Next.js 14 with App Router
- implement-azure-queue-worker - Worker uses Azure Queue for async processing
