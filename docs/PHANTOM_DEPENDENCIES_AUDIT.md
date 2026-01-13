# Phantom Dependencies Audit

This document captures the audit of phantom dependencies before migrating from npm to pnpm.

## Date
2026-01-12

## Workspaces Audited
- apps/web
- apps/api
- packages/typescript-config
- packages/eslint-config

## Depcheck Results

### apps/web

**Unused Dependencies:**
- `@radix-ui/react-checkbox`
- `@radix-ui/react-label`
- `@radix-ui/react-navigation-menu`
- `@radix-ui/react-tabs`

**Unused DevDependencies:**
- `@types/node`
- `autoprefixer`
- `postcss`
- `tslib`

**Missing Dependencies:** None detected

**Analysis:**
- The unused Radix UI components may be used in future features or were part of initial setup
- `autoprefixer` and `postcss` are likely used by Tailwind CSS internally
- `@types/node` is typically required for Next.js projects
- `tslib` is used by TypeScript for runtime helpers

**Recommendation:** Verify with team before removing these dependencies, as they may be needed.

### apps/api

**Unused Dependencies:**
- `@fastify/cors`
- `pino-pretty`

**Unused DevDependencies:**
- `@repo/eslint-config`
- `@repo/typescript-config`
- `@typescript-eslint/eslint-plugin`
- `@typescript-eslint/parser`
- `eslint-config-prettier`
- `eslint-plugin-react`
- `ts-node`

**Missing Dependencies:** None detected

**Analysis:**
- `@fastify/cors` may not be needed if using custom CORS handling
- `pino-pretty` is for development logging, may be intentionally unused in production
- The unused devDependencies may be remnants from previous configuration

**Recommendation:** Verify with team before removing these dependencies.

### packages/typescript-config

**No issues detected**

### packages/eslint-config

**No issues detected**

## Import Analysis

### apps/web

**Checked imports against dependencies:**
All imported packages are correctly declared in `package.json`:
- `react`, `react-dom`, `next` - Core frameworks
- `axios` - HTTP client
- `firebase` - Firebase SDK
- `lucide-react` - Icons
- `@radix-ui/*` - UI components (accordion, alert-dialog, dialog, popover, select, slot)
- `react-dropzone` - File upload
- `react-markdown`, `remark-gfm` - Markdown rendering
- `sonner` - Toast notifications
- `tailwind-merge`, `clsx`, `class-variance-authority` - Utility functions
- `cmdk` - Command palette

**No phantom dependencies detected**

### apps/api

**Checked imports against dependencies:**
All imported packages are correctly declared in `package.json`:
- `fastify` - Web framework
- `@supabase/supabase-js` - Supabase client
- `@azure/storage-blob` - Azure storage
- `openai` - OpenAI SDK
- `firebase-admin` - Firebase admin
- `pino`, `pino-pretty` - Logging
- `sql.js` - Database
- `vitest` - Testing
- `typescript`, `@types/*` - TypeScript and types
- `eslint`, `prettier` - Linting and formatting
- `vercel` - Vercel CLI

**No phantom dependencies detected**

## Summary

### Phantom Dependencies Found
**None** - No phantom dependencies were detected in the codebase. All imports are properly declared in their respective `package.json` files.

### Unused Dependencies (Potential Technical Debt)

**apps/web:**
- 4 unused Radix UI components
- 4 unused devDependencies

**apps/api:**
- 2 unused dependencies
- 6 unused devDependencies

### Action Items

#### High Priority (Before Migration)
- [ ] **None** - No phantom dependencies to fix, migration should proceed smoothly

#### Medium Priority (After Migration)
- [ ] Review unused Radix UI components in apps/web with team
- [ ] Verify if `@fastify/cors` and `pino-pretty` are needed in apps/api
- [ ] Clean up unused devDependencies after confirming with team

#### Low Priority (Cleanup)
- [ ] Document why certain packages are kept if they appear unused
- [ ] Consider removing unused packages in a future cleanup PR

## Next Steps

1. **No phantom dependency fixes needed** - Proceed with migration
2. Keep unused dependencies for now to avoid breaking changes
3. Address unused dependencies in a separate cleanup PR
4. Monitor for any "module not found" errors during migration

## Verification

To verify no phantom dependencies after migration:
```bash
# In each workspace
pnpm install
pnpm build
# Check for module not found errors
```

## Notes

- The codebase is well-maintained with proper dependency declarations
- No risk of phantom dependency breakage during pnpm migration
- Unused dependencies appear to be from initial setup or planned features
- All workspace package references (`@repo/*`) are properly configured
