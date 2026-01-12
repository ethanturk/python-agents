# Tasks: Migrate Frontend from React+Vite to Next.js 14

## Phase 1: Project Setup

### 1. Initialize Next.js 14 project
- [ ] Install Next.js 14 and create new project in temporary location
- [ ] Configure tsconfig.json for Next.js compatibility
- [ ] Configure next.config.js with build optimizations
- [ ] Copy devDependencies from existing package.json
- [ ] Test that new Next.js project builds successfully
- [ ] Validate: Next.js development server starts

### 2. Create migration script
- [ ] Create frontend/migrate-to-nextjs.js script
- [ ] Implement directory structure copying logic
- [ ] Implement dependency migration logic
- [ ] Implement component copying logic
- [ ] Add progress logging and error handling
- [ ] Test migration script with dry run mode
- [ ] Validate: Script reports changes before applying

## Phase 2: Core Migration

### 3. Copy components directory
- [ ] Copy frontend/src/components/ to new project
- [ ] Verify all component files are copied
- [ ] Check for any missing component dependencies
- [ ] Validate: All components copy successfully

### 4. Copy lib directory
- [ ] Copy frontend/src/lib/ to new project
- [ ] Verify all utility files are copied
- [ ] Update API client imports for Next.js compatibility
- [ ] Validate: All utilities copy successfully

### 5. Copy contexts directory
- [ ] Copy frontend/src/contexts/ to new project
- [ ] Verify all context files are copied
- [ ] Check for any missing context dependencies
- [ ] Validate: All contexts copy successfully

### 6. Copy hooks directory
- [ ] Copy frontend/src/hooks/ to new project
- [ ] Verify all custom hooks are copied
- [ ] Update hook imports for Next.js compatibility
- [ ] Validate: All hooks copy successfully

### 7. Copy constants file
- [ ] Copy frontend/src/constants.ts to new project
- [ ] Verify all constants are copied
- [ ] Validate: Constants work correctly

### 8. Copy assets and public files
- [ ] Copy frontend/public/ static files to new project
- [ ] Copy any additional assets from frontend/src/
- [ ] Validate: All static assets are available

### 9. Configure package.json
- [ ] Create new package.json for Next.js
- [ ] Migrate production dependencies (keep versions where possible)
- [ ] Add Next.js and React dependencies
- [ ] Remove Vite-specific dependencies
- [ ] Update scripts (dev, build, lint, test)
- [ ] Validate: package.json is valid and installs successfully

## Phase 3: App Router Implementation

### 10. Create app directory structure
- [ ] Create app/ directory in new project
- [ ] Create app/layout.tsx with providers
- [ ] Create app/page.tsx for home page
- [ ] Create app/documents/ directory
- [ ] Create app/search/ directory
- [ ] Validate: App Router structure is created

### 11. Implement root layout
- [ ] Add AuthProvider to root layout
- [ ] Add DocumentSetProvider to root layout
- [ ] Configure metadata and head management
- [ ] Add global styles (if needed)
- [ ] Validate: Root layout wraps all pages correctly

### 12. Implement home page
- [ ] Migrate main.tsx content to app/page.tsx
- [ ] Adapt imports for Next.js paths
- [ ] Ensure all features work (document list, search, etc.)
- [ ] Validate: Home page renders and functions correctly

### 13. Implement documents page
- [ ] Create app/documents/page.tsx for document list
- [ ] Create app/documents/layout.tsx (if needed)
- [ ] Migrate DocumentListView component
- [ ] Ensure pagination, filtering, and actions work
- [ ] Validate: Documents page works correctly

### 14. Implement search page
- [ ] Create app/search/page.tsx for search functionality
- [ ] Migrate SearchView component
- [ ] Adapt search API calls for Next.js
- [ ] Ensure search results and details work
- [ ] Validate: Search page works correctly

## Phase 4: API Integration

### 15. Adapt API client
- [ ] Update config.ts to use NEXT_PUBLIC_API_BASE
- [ ] Add server-side API access functions
- [ ] Preserve axios configuration and error handling
- [ ] Test API calls in Next.js context
- [ ] Validate: All endpoints work with Next.js

### 16. Update API usage in components
- [ ] Update all components to use new API client
- [ ] Replace Vite-specific imports
- [ ] Test all API-dependent components
- [ ] Validate: API calls work identically

### 17. Replace WebSocket with polling
- [ ] Update notification components to use /poll endpoint
- [ ] Remove or disable WebSocket initialization
- [ ] Implement polling interval matching previous behavior
- [ ] Test notification delivery works correctly
- [ ] Validate: Users receive notifications without WebSocket

## Phase 5: Configuration and Optimization

### 18. Configure environment variables
- [ ] Create .env.example file for Next.js
- [ ] Update .env.local for local development
- [ ] Document all required environment variables
- [ ] Add validation for missing variables
- [ ] Validate: Environment configuration works correctly

### 19. Configure build settings
- [ ] Update next.config.js with optimizations
- [ ] Configure image optimization settings
- [ ] Configure code splitting settings
- [ ] Test production build performance
- [ ] Validate: Build meets performance targets

### 20. Update TypeScript configuration
- [ ] Update tsconfig.json paths aliases if needed
- [ ] Configure strict mode for type safety
- [ ] Add Next.js type definitions
- [ ] Validate: TypeScript compilation succeeds

## Phase 6: Testing

### 21. Write component tests
- [ ] Write tests for migrated components using React Testing Library
- [ ] Test component rendering and behavior
- [ ] Test component integration with Next.js
- [ ] Validate: All component tests pass

### 22. Write integration tests
- [ ] Write end-to-end tests for critical user workflows
- [ ] Test document upload and search workflows
- [ ] Test authentication and authorization flows
- [ ] Validate: All integration tests pass

### 23. Test development server
- [ ] Start Next.js development server
- [ ] Test all major features manually
- [ ] Test page navigation and routing
- [ ] Test responsive design
- [ ] Validate: Development server works correctly

### 24. Test production build
- [ ] Run production build command
- [ ] Verify build succeeds without errors
- [ ] Check bundle sizes and performance
- [ ] Validate: Production build is optimized

## Phase 7: Vercel Configuration

### 25. Create monorepo vercel.json
- [ ] Create root vercel.json configuration file
- [ ] Configure frontend framework (nextjs)
- [ ] Configure backend serverless function locations
- [ ] Set environment-specific settings
- [ ] Validate: vercel.json is valid JSON

### 26. Configure environment variables for Vercel
- [ ] Document all required environment variables
- [ ] Create Vercel project environment variables
- [ ] Set NEXT_PUBLIC_API_BASE for production
- [ ] Configure backend function environment variables
- [ ] Validate: All environment variables are configured

### 27. Test deployment pipeline
- [ ] Deploy to Vercel preview environment
- [ ] Test frontend routes and pages
- [ ] Test API routes and backend functions
- [ ] Verify monorepo routing works correctly
- [ ] Validate: Deployment works end-to-end

### 28. Production deployment
- [ ] Deploy to Vercel production
- [ ] Verify all routes work in production
- [ ] Test user workflows end-to-end
- [ ] Verify backend functions are responsive
- [ ] Validate: Production deployment is successful

## Phase 8: Cleanup and Documentation

### 29. Update documentation
- [ ] Update AGENTS.md with Next.js instructions
- [ ] Create MIGRATION.md with detailed migration steps
- [ ] Update package.json scripts documentation
- [ ] Document environment variable requirements
- [ ] Validate: Documentation is complete and accurate

### 30. Remove old frontend code
- [ ] Archive or delete old frontend/ directory (after migration is verified)
- [ ] Update CI/CD pipelines to use new frontend
- [ ] Update any deployment scripts
- [ ] Validate: Old code is properly removed
- [ ] Validate: Project structure is clean

## Dependencies
- Tasks 1-9 must complete before Phase 2
- Tasks 10-14 must complete before Phase 3
- Tasks 15-17 must complete before Phase 4
- Tasks 18-20 must complete before Phase 5
- Tasks 21-24 must complete before Phase 6
- Tasks 25-27 must complete before Phase 7
- Tasks 28 must complete before Phase 8

## Parallelizable Work
- Tasks 3-8 (directory copying can be done in parallel)
- Tasks 10-14 (app router pages can be developed in parallel)
- Tasks 21 (component tests can be written in parallel with implementation)
