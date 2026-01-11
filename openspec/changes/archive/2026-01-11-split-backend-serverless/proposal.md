# Proposal: Split Backend API into Serverless Functions

## Summary
Refactor the monolithic FastAPI application into domain-specific Vercel serverless functions with clear boundaries and minimal dependencies per function.

## Motivation
- **Size constraint**: Current monolithic deployment exceeds Vercel's 250MB function limit with all dependencies
- **Scalability**: Domain separation allows independent scaling and optimization
- **Cold start optimization**: Smaller functions with minimal dependencies reduce cold start times
- **Maintenance**: Clear boundaries improve code organization and reduce cognitive load

## Goals
1. Split backend into domain-specific serverless functions (agent, documents, summaries, notifications)
2. Keep each function under 250MB including dependencies
3. Maintain API compatibility with existing frontend
4. Remove WebSocket endpoints (not supported by Vercel)
5. Replace Celery with external queue service for async tasks

## Non-Goals
- Replacing Azure Storage file upload with direct uploads (keep current API approach)
- Changing API contract or response formats
- Supporting WebSocket endpoints in serverless deployment

## Success Criteria
- Each domain function deploys successfully to Vercel under 250MB
- All read-only API endpoints work in serverless environment
- Frontend functionality remains unchanged
- File upload through API continues to work

## Related Changes
None (initial refactoring effort)
