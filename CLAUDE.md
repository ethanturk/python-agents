<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Workflow: Task-Driven Development

**MANDATORY task cycle before coding:**

1. **Get Task** → `find_tasks(task_id="...")` or `find_tasks(filter_by="status", filter_value="todo")`
2. **Start Work** → `manage_task("update", task_id="...", status="doing")`
3. **Research** → Use knowledge base (see RAG workflow below)
4. **Implement** → Write code based on research
5. **Review** → `manage_task("update", task_id="...", status="review")`
6. **Next Task** → `find_tasks(filter_by="status", filter_value="todo")`

**NEVER skip task updates. NEVER code without checking current tasks first.**

## RAG Workflow (Research Before Implementation)

### Searching Specific Documentation:

1. **Get sources** → `rag_get_available_sources()` - Returns list with id, title, url
2. **Find source ID** → Match to documentation (e.g., "Supabase docs" → "src_abc123")
3. **Search** → `rag_search_knowledge_base(query="vector functions", source_id="src_abc123")`

### General Research:

```bash
# Search knowledge base (2-5 keywords only!)
rag_search_knowledge_base(query="authentication JWT", match_count=5)

# Find code examples
rag_search_code_examples(query="React hooks", match_count=3)
```

## Project Workflows

### New Project:

```bash
# 1. Create project
manage_project("create", title="My Feature", description="...")

# 2. Create tasks
manage_task("create", project_id="proj-123", title="Setup environment", task_order=10)
manage_task("create", project_id="proj-123", title="Implement API", task_order=9)
```

### Existing Project:

```bash
# 1. Find project
find_projects(query="auth")  # or find_projects() to list all

# 2. Get project tasks
find_tasks(filter_by="project", filter_value="proj-123")

# 3. Continue work or create new tasks
```

## Tool Reference

**Projects:**

- `find_projects(query="...")` - Search projects
- `find_projects(project_id="...")` - Get specific project
- `manage_project("create"/"update"/"delete", ...)` - Manage projects

**Tasks:**

- `find_tasks(query="...")` - Search tasks by keyword
- `find_tasks(task_id="...")` - Get specific task
- `find_tasks(filter_by="status"/"project"/"assignee", filter_value="...")` - Filter tasks
- `manage_task("create"/"update"/"delete", ...)` - Manage tasks

**Knowledge Base:**

- `rag_get_available_sources()` - List all sources
- `rag_search_knowledge_base(query="...", source_id="...")` - Search docs
- `rag_search_code_examples(query="...", source_id="...")` - Find code

## Important Notes

- Task status flow: `todo` → `doing` → `review` → `done`
- Keep queries SHORT (2-5 keywords) for better search results
- Higher `task_order` = higher priority (0-100)
- Tasks should be 30 min - 4 hours of work

## Project Architecture Overview

This project is a **Turborepo monorepo** with three main applications:

### Applications

1. **`apps/backend`** - Node.js Serverless Backend
   - **Tech Stack:** TypeScript, Vercel Functions, OpenAI, Supabase, Firebase Auth, Azure Blob Storage
   - **Runtime:** Vercel serverless functions (10s max duration)
   - **API Endpoints:** `/api/agent/*`, `/api/documents/*`, `/api/summaries/*`, `/api/notifications/*`
   - **Key Services:** LLM agents, vector search (RAG), document management, long-polling notifications (8s timeout)
   - **Deployment:** Auto-deploy to Vercel on push to `main` via GitHub Actions

2. **`apps/web`** - Next.js Frontend
   - **Tech Stack:** Next.js 16, React 18, TypeScript, Tailwind CSS, Radix UI, Firebase Auth
   - **Features:** Server/client components, real-time polling, file upload, document management, RAG chat interface
   - **Deployment:** Auto-deploy to Vercel on push to `main` via GitHub Actions

3. **`apps/worker`** - Python Celery Worker
   - **Tech Stack:** Python 3.11+, Celery, LangChain, pydantic-ai, Docling, Supabase
   - **Tasks:** Document ingestion (Docling → chunk → embed → index), async summarization, multi-step agents, file watching
   - **Deployment:** Auto-deploy to Docker Hub on push to `main` via GitHub Actions

### Infrastructure

- **Vector Database:** Supabase (PostgreSQL + pgvector extension)
  - Table: `documents` with vector similarity search via `match_documents()` RPC function
  - Stores: embeddings, content, metadata, document_set (multi-tenancy)

- **File Storage:** Azure Blob Storage
  - Handles file uploads from backend
  - Worker processes files for ingestion

- **Authentication:** Firebase
  - Backend: Firebase Admin SDK for token verification
  - Frontend: Firebase Auth context

- **Task Queue:** Redis or RabbitMQ
  - Celery broker for async task distribution
  - Long-polling notification queue in backend

### Data Flow

```
Frontend (Next.js) → Backend API (Node.js Serverless) → Worker (Python Celery)
                            ↓                                    ↓
                     Supabase Vector DB                   Azure Blob Storage
                     Firebase Auth                        Supabase Vector DB
```

### Key Architecture Patterns

- **Serverless-First:** Backend uses Vercel Functions with 10s timeout limits
- **Async Processing:** Long-running tasks (ingestion, summarization) handled by Python worker
- **Multi-Tenancy:** Documents organized by `document_set` for isolation
- **Long-Polling:** 8s timeout notification system for real-time updates without WebSockets
- **Stateless Functions:** Backend uses sql.js in-memory SQLite, no persistent disk

### CI/CD Workflows

- `.github/workflows/vercel-backend-deploy.yml` - Deploy backend to Vercel
- `.github/workflows/vercel-frontend-deploy.yml` - Deploy frontend to Vercel
- `.github/workflows/docker-hub-deploy.yml` - Deploy worker to Docker Hub
- `.github/workflows/ci.yml` - Run tests and quality checks on PRs

### Project Structure

```
python-agents/
├── apps/
│   ├── backend/          # Node.js serverless functions
│   │   ├── api/          # Route handlers (agent, documents, notifications, summaries)
│   │   ├── lib/          # Services (supabase, llm, database, notifications)
│   │   └── vercel.json   # Vercel configuration
│   ├── web/              # Next.js frontend
│   │   ├── app/          # App router pages
│   │   └── components/   # React components
│   └── worker/           # Python Celery worker
│       ├── async_tasks.py    # Task definitions
│       └── clients.py        # Service clients
├── packages/             # Shared configs (eslint, typescript)
├── turbo.json           # Turborepo config
└── openspec/            # OpenSpec documentation
```

### Architectural Constraints & Considerations

When creating proposals or implementing features, consider these constraints:

#### Backend (Node.js Serverless)
- **10-second timeout limit** - All API operations must complete within 10s
- **Stateless** - No persistent disk storage (use Azure Blob or Supabase)
- **Cold starts** - First request may be slower; optimize for quick initialization
- **Long-polling** - Use 8s timeout max for real-time updates (respects 10s function limit)
- **In-memory SQLite** - Metadata storage via sql.js (cleared on function restart)

#### Frontend (Next.js 16)
- **App Router** - Use server and client components appropriately
- **Firebase Auth** - All API calls require Firebase ID token in Authorization header
- **Environment Variables** - Use `NEXT_PUBLIC_*` prefix for client-accessible vars
- **Static Optimization** - Prefer static generation where possible

#### Worker (Python Celery)
- **Long-running tasks** - Use worker for operations >5s (document processing, LLM calls)
- **Docling processing** - Heavy memory usage, manage resource cleanup (`gc.collect()`)
- **VLM pipeline** - Use singleton pattern to avoid re-initialization overhead
- **Task notifications** - Webhook to backend `/api/notifications/internal/notify` on completion

#### Database & Storage
- **Supabase Vector DB** - Use RPC function `match_documents()` for similarity search
- **Document sets** - Always filter by `document_set` for multi-tenancy
- **Embedding dimensions** - Default 1536 (text-embedding-3-small)
- **Azure Blob Storage** - Required for file uploads (no local filesystem in serverless)

#### Cross-Service Communication
- **Backend → Worker** - Via task queue (Redis/RabbitMQ) or direct invocation
- **Worker → Backend** - Via webhook notifications
- **Frontend → Backend** - REST API with Firebase auth
- **Real-time Updates** - Long-polling `/api/poll` endpoint (not WebSockets)

## Development Commands

### Running Services

The system uses Turborepo for monorepo management:

```bash
# Install dependencies
pnpm install

# Run all apps in dev mode
pnpm dev

# Run specific apps
pnpm --filter web dev          # Frontend only
pnpm --filter backend dev      # Backend only (note: serverless, use Vercel CLI)

# Run Celery worker locally
cd apps/worker
pip install -r requirements.txt
celery -A async_tasks worker --loglevel=info

# Or use Docker Compose for worker
docker-compose -f docker-compose.worker.yml up -d
```

### Testing

**Pre-Commit Hooks** (MANDATORY):
```bash
# Install pre-commit hooks (run once)
./setup-precommit.sh

# Hooks run automatically on git commit
# To run manually: pre-commit run --all-files
# To skip (not recommended): git commit --no-verify
```

**Automated Testing** (CI/CD):
```bash
# All tests run automatically on push/PR via GitHub Actions
# See .github/workflows/ci.yml for pipeline details

# Quick checks before committing
make lint
make test-unit

# Full test suite locally
./run_tests.sh --all --coverage
```

**Run all tests:**
```bash
pnpm test
```

**Run specific tests:**
```bash
pnpm --filter web test         # Frontend tests (Vitest)
pnpm --filter backend test     # Backend tests (Vitest)
cd apps/worker && pytest       # Worker tests (pytest)
```

### Service URLs

**Development:**
- Frontend: http://localhost:3000 (Next.js dev server)
- Backend API: Deployed on Vercel (use preview URLs or production)

**Production:**
- Frontend: https://your-frontend.vercel.app
- Backend API: https://your-backend.vercel.app/api/*

### Building

```bash
# Build all apps
pnpm build

# Build specific app
pnpm --filter web build
pnpm --filter backend build
```

## Important Patterns

### Serverless Constraints

- **10s timeout** - Backend functions must complete within 10 seconds
- **Stateless** - No persistent disk storage; use Azure Blob or Supabase
- **Cold starts** - Optimize initialization, lazy-load heavy dependencies
- **Long-polling** - Use 8s max timeout for real-time updates

### Async/Sync Bridging

Worker tasks use `asyncio.run()` to call async service methods:
- Supabase client methods are async
- Worker tasks are sync (Celery limitation)
- Bridge with `asyncio.run()` wrapper

### Error Handling

- Backend: Return structured errors with proper HTTP status codes
- Worker: Return descriptive strings for task status tracking
- LLM errors: Return user-friendly messages
- Vector DB: Catch exceptions and return empty results on failure

### Authentication

- Backend: Firebase Admin SDK for token verification
- Frontend: Firebase Auth context (`useAuth()` hook)
- All API calls require Firebase ID token in Authorization header

### Real-Time Updates

- **Long-polling** at `/api/poll?since_id=X` (8s timeout)
- Worker webhooks to `/api/notifications/internal/notify`
- Frontend polls for task updates
- No WebSockets (not supported in Vercel Functions)

## Common Development Tasks

### Adding a New Backend Endpoint

1. Create handler in `apps/backend/api/<domain>/index.ts`
2. Define request/response types in `apps/backend/lib/types.ts`
3. Add business logic in `apps/backend/lib/<service>.ts`
4. Add route rewrites in `apps/backend/vercel.json`
5. Update frontend API client in `apps/web/lib/api.ts`

**Example:**
```typescript
// apps/backend/api/my-feature/index.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify Firebase auth token
  // Call service layer
  // Return response within 10s
}
```

### Adding a New Celery Task

1. Define task in `apps/worker/async_tasks.py` with `@app.task` decorator
2. Use `asyncio.run()` wrapper for async service calls
3. Return descriptive strings for task status
4. Webhook to `/api/notifications/internal/notify` on completion

**Example:**
```python
@app.task(bind=True)
def my_task(self, arg: str) -> str:
    try:
        result = asyncio.run(my_async_function(arg))
        # Notify backend
        return f"Success: {result}"
    except Exception as e:
        return f"Error: {str(e)}"
```

### Adding a Frontend Component

1. Create component in `apps/web/components/`
2. Use server components by default, add `"use client"` only if needed
3. Import `useAuth()` for protected features
4. Use Tailwind utilities and Radix UI primitives
5. Call API via `apps/web/lib/api.ts` helpers

### Working with Vector Search

The system uses Supabase RPC function `match_documents`:
```sql
-- RPC signature:
match_documents(
  query_embedding vector,
  match_threshold float,
  match_count int,
  filter_document_set text
) RETURNS table(content text, filename text, document_set text, similarity float, metadata jsonb)
```

**Best practices:**
- Always filter by `document_set` for multi-tenancy
- Start with 0.7 similarity threshold
- Use text-embedding-3-small (1536 dimensions)

### Working with Docling (Worker)

Docling processing in worker tasks:
- **Standard pipeline:** Fast, no OCR, table structure extraction
- **VLM pipeline:** Heavy initialization, use singleton pattern
- **Cleanup:** Call `gc.collect()` after processing
- **Memory:** Monitor usage, Docling is memory-intensive

### Git Workflow

**Pre-commit Quality Gates (MANDATORY):**
- Install hooks: `./setup-precommit.sh`
- Hooks run automatically on commit, blocking bad code from being committed
- Includes: Black, Ruff, ESLint, Prettier, tests, security scans

Per session completion requirements:
1. Pre-commit hooks catch issues automatically on commit
2. Run quality gates (tests, linters, builds) if needed
3. Update task/issue status
4. **MANDATORY**: `git pull --rebase && git push`
5. Verify: `git status` shows "up to date with origin"

### Final steps of every run
**IMPORTANT**
Validate that all linting (JS and Python) pass
Always validate pre-commit hooks before completing an iteration.
Specifically, ensure that you run: `pre-commit run --all-files`
