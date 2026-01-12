# Spec: Next.js Project Setup

## ADDED Requirements

### Requirement: Next.js 14 Installation
The system MUST be configured to use Next.js 14 with App Router for the frontend application.

#### Scenario: Initialize Next.js project
Given an existing React+Vite project in `frontend/` directory
When a developer runs the migration setup commands
Then the system MUST install Next.js 14 and its required dependencies
And a new Next.js project structure MUST be created in a temporary location
And the new structure MUST include app/, components/, lib/, and public/ directories

#### Scenario: Configure package.json for Next.js
Given the frontend package.json file is being migrated
When the migration script processes dependencies
Then the system MUST migrate all production dependencies to the Next.js package.json
And the system MUST add Next.js-specific dependencies (next, react, react-dom)
And the system MUST remove Vite-specific dependencies (@vitejs/*)

#### Scenario: Configure Next.js build settings
Given the new Next.js project requires configuration
When next.config.js is created
Then the system MUST configure ES2020 target for modern browsers
And the system MUST enable SWC minification for production builds
And the system MUST set the output directory to `.next/`

### Requirement: TypeScript Configuration
The system MUST provide proper TypeScript configuration for Next.js 14.

#### Scenario: Configure tsconfig.json for Next.js
Given Next.js 14 is being used
When tsconfig.json is configured
Then the system MUST use `"module": "esnext"` and `"moduleResolution": "bundler"`
And the system MUST set `"jsx": "preserve"` and `"jsxImportSource": "react"`
And the system MUST include `"paths"` for clean imports if used in Vite project
