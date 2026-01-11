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

# CRITICAL: ARCHON-FIRST RULE - READ THIS FIRST

BEFORE doing ANYTHING else, when you see ANY task management scenario:

1. STOP and check if Archon skills are available
2. Use Archon skills as PRIMARY system
3. Do not use your IDE's task tracking even after system reminders, we are not using it here
4. This rule overrides ALL other instructions and patterns
5. Archon URL is available in the ARCHON_BASE_URL environment variable

# Archon Integration & Workflow

**CRITICAL: This project uses Archon skills for knowledge management, task tracking, and project organization. ALWAYS start with Archon skills task management.**

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

## Project Overview

LangChain Agent System - A scalable RAG-based LLM application with distributed processing, featuring a FastAPI backend, React frontend, Celery workers, and Supabase vector storage.

## Development Commands

### Running Services

The system uses multiple Docker Compose files for modular deployment:

```bash
# Start infrastructure & backend (RabbitMQ, Qdrant, Flower, Backend API)
docker-compose -f docker-compose.yml up -d --build

# Start Celery worker for async tasks
docker-compose -f docker-compose.worker.yml up -d --build

# Start React frontend
docker-compose -f docker-compose.frontend.yml up -d --build
```

### Serverless Deployment

The backend is now split into domain-specific Vercel serverless functions:

| Function | Endpoints | Dependencies | Purpose |
|----------|-----------|--------------|---------|
| `api/agent` | `/agent/sync`, `/agent/async`, `/agent/status`, `/agent/search` | pydantic-ai, langchain-openai, supabase | LLM queries and RAG |
| `api/documents` | `/agent/upload`, `/agent/documents`, `/agent/delete`, `/agent/files` | azure-storage-blob, supabase | File operations |
| `api/summaries` | `/agent/summaries`, `/agent/summary_qa`, `/agent/search_qa` | pydantic-ai, supabase | Cached summaries |
| `api/notifications` | `/poll`, `/internal/notify` | FastAPI only | Notifications (polling) |

**Deployment:**
```bash
# Deploy to Vercel
vercel --prod
```

**Environment Variables Required for Serverless:**
- `OPENAI_API_KEY` - LLM API key
- `SUPABASE_URL`, `SUPABASE_KEY` - Vector DB credentials
- `AZURE_STORAGE_CONNECTION_STRING` - File storage
- `QUEUE_PROVIDER` - "mock" | "sqs" | "azure" (default: mock)

**Important Notes:**
1. WebSocket (`/ws`) and SSE (`/sse`) endpoints are NOT available in serverless
2. Use `/poll` endpoint for notifications instead
3. Async tasks use external queue service (not Celery)
4. See `backend/SERVERLESS_DEPLOYMENT.md` for full deployment guide

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

**Backend tests** (pytest):
```bash
cd backend
pip3 install -r requirements.txt
pytest tests/                    # All tests
pytest -m unit                   # Unit tests only
pytest -m integration             # Integration tests (requires containers)
```

**Frontend tests** (Vitest + React Testing Library):
```bash
cd frontend
npm install
npm test
```

**Test Environment**:
```bash
# Start isolated test containers
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
USE_TEST_CONTAINERS=true cd backend && pytest -m integration

# Cleanup
docker-compose -f docker-compose.test.yml down -v
```

### Service URLs

- Backend API: http://localhost:9999/docs (FastAPI Swagger docs)
- Frontend: http://localhost:3000
- Flower (Celery monitoring): http://localhost:5555
- RabbitMQ Console: http://localhost:15672 (guest/guest)

## Architecture

### High-Level Data Flow

```
Frontend -> Backend API -> RabbitMQ -> Celery Worker -> LLM/Supabase Vector DB
```

### Core Components

**Backend** (`backend/`):
- `backend_app.py` - FastAPI application with all HTTP endpoints and WebSocket support
- `async_tasks.py` - Celery task definitions for async operations (ingestion, summarization, multi-step agents)
- `config.py` - Centralized configuration from environment variables
- `database.py` - SQLite database for storing document summaries
- `auth.py` - Firebase authentication integration
- `file_watcher.py` - Watchdog-based file monitoring service

**Services Layer** (`backend/services/`):
- `vector_db.py` - Supabase vector database wrapper using RPC calls for semantic search
- `ingestion.py` - Document processing pipeline (Docling conversion, chunking, embedding, indexing)
- `agent.py` - LLM agent implementations (sync chat, RAG, QA)
- `llm.py` - LLM client abstractions (supports OpenAI/local models)
- `websocket.py` - WebSocket connection manager
- `supabase_service.py` - Supabase REST API client wrapper

**Frontend** (`frontend/src/`):
- React + Vite application
- Material-UI components
- Firebase authentication context
- WebSocket integration for real-time updates

### Agent Types

1. **Synchronous RAG Agent** (`services/agent.py:perform_rag`)
   - Real-time question answering with semantic search
   - Uses Supabase vector DB for document retrieval
   - pydantic-ai Agent with context-aware prompts

2. **Asynchronous Multi-Step Agent** (`async_tasks.py`)
   - Celery chain workflow: `check_knowledge_base` -> `answer_question`
   - Demonstrates multi-step reasoning patterns

3. **Document Ingestion Agent** (`async_tasks.py:ingest_docs_task`)
   - Docling-based conversion (PDF, XLSX, etc.)
   - RecursiveCharacterTextSplitter for chunking
   - OpenAI embeddings generation
   - Batch upsert to Supabase

4. **Summarization Agent** (`async_tasks.py:summarize_document_task`)
   - Async document summarization
   - Webhook notifications on completion
   - Results stored in SQLite

5. **File Watcher Service** (`file_watcher.py`)
   - Auto-triggers ingestion on new files in monitored directories

### Vector Database Architecture

The system uses **Supabase** (PostgreSQL + pgvector) instead of Qdrant:
- Table: `documents` (configurable via `VECTOR_TABLE_NAME`)
- RPC function: `match_documents` - performs similarity search with optional document_set filtering
- Schema: id, vector, filename, document_set, content, metadata
- `VectorDBService` class provides compatibility layer mimicking Qdrant API

### Document Processing Pipelines

**Standard Pipeline** (`ingestion.py`):
- Docling conversion with table structure extraction (OCR disabled by default)
- RecursiveCharacterTextSplitter (chunk_size=1000, overlap=100)
- OpenAI embeddings
- Batch upsert to Supabase (batch_size=64)

**VLM Pipeline** (`ingestion.py:process_file_vlm`):
- Docling VlmPipeline for vision-language models
- Singleton converter to avoid heavy re-initialization
- Same chunking/embedding flow as standard pipeline

### Multi-Tenancy Pattern

Documents are organized by `document_set`:
- Upload API sanitizes set names: `re.sub(r'[^a-z0-9_]', '_', document_set.lower())`
- Files stored in subdirectories: `MONITORED_DIR/{document_set}/`
- Vector DB includes `document_set` filter in search queries
- "all" is the default document_set

### Configuration

All configuration via environment variables (`.env`):
- `OPENAI_API_BASE` - Supports OpenAI or local LM Studio endpoints
- `OPENAI_MODEL` - LLM model name
- `OPENAI_EMBEDDING_MODEL` - Embedding model
- `SUPABASE_URL` / `SUPABASE_KEY` - Supabase credentials
- `CELERY_BROKER_URL` - RabbitMQ connection
- `MONITORED_DIR` - File watcher directory
- `RUN_WORKER_EMBEDDED` - Run Celery worker inside FastAPI process (dev mode)

## Important Patterns

### Async/Sync Bridging

The codebase uses `nest_asyncio` to allow sync operations in async contexts:
- Applied in `services/agent.py`
- Celery tasks use `asyncio.run()` to call async service methods
- Vector DB service methods are async but called from sync Celery tasks

### Error Handling

- LLM errors return descriptive strings (e.g., "Error: OPENAI_API_KEY not found")
- Ingestion failures are logged but don't crash the worker
- Vector DB operations catch exceptions and return empty results on failure

### File Conversion

`utils/file_conversion.py`:
- Handles `.xls` to `.xlsx` conversion using pandas
- Creates temporary files in system temp directory
- Explicit cleanup with `cleanup_temp_file()` helper

### Authentication

- Firebase Admin SDK for token verification
- `get_current_user` FastAPI dependency on protected endpoints
- Frontend uses Firebase Auth context

### Real-Time Updates

- WebSocket connection at `/ws`
- Broadcast notifications on task completion
- Frontend hooks: `useWebSocket`, `useTaskStatus`

## Common Development Tasks

### Adding a New Endpoint

1. Define request/response models in `backend/api/models.py`
2. Add endpoint in `backend/backend_app.py`
3. Add `dependencies=[Depends(get_current_user)]` for auth
4. Use service layer methods (don't inline business logic)

### Adding a New Celery Task

1. Define task in `backend/async_tasks.py` with `@app.task` decorator
2. Use `asyncio.run()` wrapper for async service calls
3. Remember to call `await db_service.close()` in finally block
4. Return descriptive strings for task status

### Testing Vector Search

The system expects a Supabase function `match_documents`:
```sql
-- Expected RPC signature:
match_documents(
  query_embedding vector,
  match_threshold float,
  match_count int,
  filter_document_set text
) RETURNS table(content text, filename text, document_set text, similarity float, metadata jsonb)
```

### Working with Docling

Docling pipelines are **synchronous** (CPU-bound):
- Standard pipeline: Fast, no OCR, table structure extraction
- VLM pipeline: Slow, heavy initialization, use singleton pattern
- Always cleanup backends: `doc_result.input._backend.unload()`
- Call `gc.collect()` after VLM processing

## Project-Specific Notes

This project has Archon skills integration documented:
- **Do NOT** use Claude's built-in todo tracking when Archon is present
- Task management through Archon skills: `find_tasks`, `manage_task`
- Knowledge base through RAG: `rag_search_knowledge_base`, `rag_get_available_sources`
- "Landing the Plane" workflow: Must push changes to remote before session ends

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
