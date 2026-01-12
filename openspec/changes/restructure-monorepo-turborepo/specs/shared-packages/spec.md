# Spec: Shared Packages

## ADDED Requirements

### Requirement: Shared ESLint configuration package
The monorepo MUST provide a `@repo/eslint-config` package with presets for Next.js and Node.js.

#### Scenario: ESLint config package structure
**Given** the `packages/eslint-config/` directory exists
**When** a developer inspects its contents
**Then** they see:
- `package.json` with name `@repo/eslint-config`
- `next.js` file exporting Next.js ESLint rules
- `library.js` file exporting Node.js library ESLint rules

**And** `package.json` includes:
```json
{
  "name": "@repo/eslint-config",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./next": "./next.js",
    "./library": "./library.js"
  }
}
```

#### Scenario: Web app uses Next.js ESLint config
**Given** `apps/web/eslint.config.mjs` contains:
```javascript
import nextConfig from "@repo/eslint-config/next";
export default nextConfig;
```
**When** a developer runs `npm run lint` in `apps/web/`
**Then** ESLint uses the shared Next.js configuration
**And** applies rules consistently with other Next.js projects

#### Scenario: API app uses library ESLint config
**Given** `apps/api/eslint.config.ts` contains:
```typescript
import libraryConfig from "@repo/eslint-config/library";
export default libraryConfig;
```
**When** a developer runs `npm run lint` in `apps/api/`
**Then** ESLint uses the shared library configuration
**And** applies rules for Node.js serverless functions

### Requirement: Shared TypeScript configuration package
The monorepo MUST provide a `@repo/typescript-config` package with base, Next.js, and Node.js presets.

#### Scenario: TypeScript config package structure
**Given** the `packages/typescript-config/` directory exists
**When** a developer inspects its contents
**Then** they see:
- `package.json` with name `@repo/typescript-config`
- `base.json` with common TypeScript settings
- `nextjs.json` extending base.json for Next.js projects
- `node.json` extending base.json for Node.js projects

**And** `package.json` includes:
```json
{
  "name": "@repo/typescript-config",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./base.json": "./base.json",
    "./nextjs.json": "./nextjs.json",
    "./node.json": "./node.json"
  }
}
```

#### Scenario: Web app extends Next.js TypeScript config
**Given** `apps/web/tsconfig.json` contains:
```json
{
  "extends": "@repo/typescript-config/nextjs.json",
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```
**When** TypeScript compiles the web app
**Then** it uses the shared Next.js configuration
**And** inherits settings like `jsx: "preserve"`, `strict: true`, etc.

#### Scenario: API app extends Node TypeScript config
**Given** `apps/api/tsconfig.json` contains:
```json
{
  "extends": "@repo/typescript-config/node.json",
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
```
**When** TypeScript compiles the API functions
**Then** it uses the shared Node.js configuration
**And** inherits settings like `module: "esnext"`, `moduleResolution: "bundler"`, etc.

### Requirement: Base TypeScript configuration
The `@repo/typescript-config/base.json` MUST define common TypeScript compiler options.

#### Scenario: Base config includes strict settings
**Given** `packages/typescript-config/base.json` exists
**When** a developer inspects its contents
**Then** it includes:
```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  }
}
```

**And** all workspace tsconfig.json files extend from base.json or its derivatives

### Requirement: Consistent linting across workspaces
All TypeScript workspaces MUST use ESLint configurations from `@repo/eslint-config`.

#### Scenario: Lint command runs with shared config
**Given** both `apps/web/` and `apps/api/` use `@repo/eslint-config`
**When** a developer runs `turbo run lint`
**Then** ESLint applies consistent rules across both apps
**And** no duplicate rule definitions exist in individual workspace configs

### Requirement: Version consistency for shared packages
Workspaces MUST reference shared packages using `"*"` or `"workspace:*"` version specifiers.

#### Scenario: App declares shared package dependency
**Given** `apps/web/package.json` declares:
```json
{
  "devDependencies": {
    "@repo/eslint-config": "*",
    "@repo/typescript-config": "*"
  }
}
```
**When** npm installs workspace dependencies
**Then** it symlinks the local packages from `packages/`
**And** does not attempt to fetch them from npm registry
