# Design: Restructure Monorepo with Turborepo

## Overview
This change restructures the monorepo from a flat structure to a hierarchical Turborepo workspace with `apps/` and `packages/` directories, implementing npm workspaces and build caching.

## Current State

### Directory Layout
```
/
├── frontend/           # Next.js 14 app
├── api/                # Vercel serverless functions
├── worker/             # Python Celery worker (root level)
├── package.json        # Root deps for frontend only
├── vercel.json         # Vercel config with rewrites
└── .vercelignore       # Excludes worker and tests
```

### Problems
1. **Unclear boundaries**: Root package.json mixes frontend deps with workspace management
2. **Config duplication**: Each app has its own eslint.config.*, tsconfig.json with duplicated rules
3. **No build orchestration**: Manual build commands in vercel.json, no caching
4. **Inconsistent scripts**: Different script names and patterns across api/ and frontend/
5. **Dependency bloat**: Shared dependencies installed multiple times

## Proposed State

### Directory Layout
```
/
├── apps/
│   ├── web/            # Next.js 14 frontend (renamed from frontend/)
│   │   ├── package.json
│   │   ├── tsconfig.json (extends @repo/typescript-config)
│   │   └── eslint.config.mjs (uses @repo/eslint-config)
│   ├── api/            # Vercel serverless functions (moved from root)
│   │   ├── package.json
│   │   ├── tsconfig.json (extends @repo/typescript-config)
│   │   └── eslint.config.ts (uses @repo/eslint-config)
│   └── worker/         # Python Celery worker (moved from root)
│       ├── pyproject.toml
│       ├── requirements.txt
│       └── (Python source files)
├── packages/
│   ├── eslint-config/  # Shared ESLint rules
│   │   ├── package.json
│   │   ├── next.js     # Next.js ESLint config
│   │   └── library.js  # Node.js library config
│   ├── typescript-config/  # Shared TS configs
│   │   ├── package.json
│   │   ├── base.json
│   │   ├── nextjs.json
│   │   └── node.json
│   └── types/          # Shared TypeScript types (future)
│       └── package.json
├── package.json        # Root workspace config
├── turbo.json          # Turborepo pipeline
├── vercel.json         # Updated paths and build commands
└── .vercelignore       # Excludes apps/worker/, packages/, tests
```

## Architecture Decisions

### 1. npm Workspaces vs. pnpm/yarn
**Decision**: Use npm workspaces

**Rationale**:
- Already using npm throughout the project
- Vercel has excellent npm workspaces support
- Lower learning curve for contributors
- No package manager migration needed

**Tradeoffs**:
- pnpm has better disk space efficiency (symlinks vs. copies)
- yarn has slightly better UX for some operations
- Acceptable: npm workspaces are mature and well-supported by Vercel

### 2. Turborepo Pipeline Design
**Decision**: Define tasks: build, dev, lint, typecheck, test, clean

**Pipeline Configuration**:
```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

**Rationale**:
- `^build` dependency ensures packages build before apps
- Persistent dev servers prevent premature termination
- No caching for dev/clean commands (not needed)
- Output caching for builds improves CI/CD performance

### 3. Shared Config Strategy
**Decision**: Create scoped packages (@repo/eslint-config, @repo/typescript-config)

**Rationale**:
- Enforces consistency across all TypeScript projects
- Single source of truth for linting rules
- Easy to version and update
- Matches Vercel's kitchen-sink example pattern

**Implementation**:
- ESLint config exports multiple presets (next.js, library.js)
- TypeScript config provides base.json, nextjs.json, node.json
- Apps extend with minimal overrides

### 4. Worker Organization
**Decision**: Move worker/ to apps/worker/, treat as another application in the monorepo

**Rationale**:
- Consistent structure: All applications live under apps/
- Better organization: Clear that worker is an application, not infrastructure
- Monorepo clarity: Developer can see all apps in one place (apps/)
- Still independent: Worker maintains Python tooling, not part of npm workspace
- Simplifies navigation: All code to deploy/run is under apps/

**Implementation**:
- Worker moved to `apps/worker/`
- `.vercelignore` excludes `apps/worker/` from Vercel deployment
- `turbo.json` has no tasks for worker (Python-based, separate tooling)
- Worker maintains separate requirements.txt, pyproject.toml
- Worker deploys independently to Azure/Docker (unchanged)

### 5. Vercel Build Configuration
**Decision**: Use Turborepo-aware build command in vercel.json

**Before**:
```json
{
  "buildCommand": "cd frontend && npm run build && cp -r .next public ../"
}
```

**After**:
```json
{
  "buildCommand": "turbo run build --filter=web",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": "apps/web/.next"
}
```

**Rationale**:
- `turbo run build --filter=web` builds web app and its dependencies
- Turborepo handles caching and task orchestration
- `outputDirectory` tells Vercel where to find Next.js build artifacts
- No manual file copying needed

### 6. API Functions Deployment
**Decision**: Keep api/ functions in apps/api/, deploy via Vercel auto-detection

**Vercel Behavior**:
- Vercel auto-detects `apps/api/**/*.ts` as serverless functions
- No changes needed to function code (index.ts exports remain the same)
- Existing rewrites in vercel.json continue to work

**Implementation**:
```json
{
  "rewrites": [
    { "source": "/agent/:path*", "destination": "/api/agent" },
    { "source": "/agent/documents", "destination": "/api/documents" }
  ]
}
```

## Migration Strategy

### Phase 1: Scaffold Structure (No Code Changes)
1. Create `apps/` and `packages/` directories
2. Create shared config packages with placeholder configs
3. Add turbo.json with basic pipeline
4. Update root package.json with workspaces

### Phase 2: Move Applications
1. Move `frontend/` → `apps/web/`
2. Move `api/` → `apps/api/`
3. Update import paths if needed (likely none due to relative imports)
4. Update vercel.json paths

### Phase 3: Integrate Shared Configs
1. Update apps/web/tsconfig.json to extend @repo/typescript-config/nextjs.json
2. Update apps/api/tsconfig.json to extend @repo/typescript-config/node.json
3. Replace eslint.config.* files with imports from @repo/eslint-config
4. Remove duplicated config code

### Phase 4: Test & Validate
1. Run `turbo run build` to verify all builds succeed
2. Run `turbo run dev` to verify dev servers start
3. Deploy to Vercel preview environment
4. Validate all API endpoints and frontend routes work

## Rollback Plan
If issues arise:
1. Revert directory moves (git revert)
2. Restore original package.json and vercel.json
3. Remove turbo.json
4. No data loss risk (pure structural change)

## Performance Impact
- **Build Time**: Initial build same or slower (Turborepo overhead), subsequent builds 40-60% faster due to caching
- **Dev Experience**: Parallel dev servers improve startup time
- **Deployment**: Vercel deployment time unchanged (still builds only web app)
- **CI/CD**: Significant improvement on cached builds in GitHub Actions

## Security Considerations
- No new dependencies with known vulnerabilities
- Turborepo is maintained by Vercel (trusted source)
- Shared configs don't introduce new attack surface
- Worker isolation ensures Python env doesn't interfere with Node.js

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Vercel build breaks | High | Low | Test in preview environment first |
| Import path changes needed | Medium | Low | Most imports are relative; add path mappings if needed |
| Shared config conflicts | Low | Medium | Start with minimal shared rules, add incrementally |
| Turborepo learning curve | Low | High | Provide team training, document common tasks |

## Future Enhancements
1. Create @repo/ui shared component library
2. Add @repo/types for shared TypeScript interfaces
3. Implement remote caching (Vercel Remote Cache)
4. Add changesets for versioning shared packages
5. Create @repo/utils for shared utilities
