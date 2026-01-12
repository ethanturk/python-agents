# Proposal: Migrate Frontend from React+Vite to Next.js 14

## Summary
Migrate the frontend from a React+Vite SPA to Next.js 14 using the App Router, deploying as a monorepo on Vercel with the serverless backend functions.

## Motivation
- **Better SEO**: Next.js provides server-side rendering and automatic optimization for search engines
- **Improved Performance**: Next.js 14 with React Server Components enables better caching and code splitting
- **Unified Deployment**: Monorepo allows co-deployment of frontend and Next.js backend on one Vercel project
- **Developer Experience**: Better tooling, built-in image optimization, and file-based routing
- **Modern Architecture**: Leverage React Server Components for better data fetching patterns

## Goals
1. Migrate from React+Vite to Next.js 14 (App Router)
2. Implement server-side rendering (SSR) for SEO-critical pages
3. Maintain all existing functionality (auth, documents, search, etc.)
4. Preserve existing component library and design system
5. Optimize for production with serverless backend integration
6. Set up monorepo structure on Vercel for unified deployment

## Non-Goals
- Changing the existing Radix UI component library (keep as-is)
- Replacing authentication system (keep Firebase)
- Changing backend API endpoints (use existing serverless functions)
- Migrating to Server Actions in this phase (use Client Components with useEffect for now)

## Success Criteria
- Next.js app serves all existing pages without functionality loss
- SSR improves SEO for public pages (if any)
- Monorepo structure allows co-deployment on Vercel
- All existing features (WebSocket replacement with polling, document upload, search) work identically
- Performance metrics meet or exceed current Vite SPA metrics
- Build and deploy successfully to Vercel

## Related Changes
- split-backend-serverless - Backend is already split into serverless functions
- implement-azure-queue-worker - Backend will use Azure Queue for async tasks
