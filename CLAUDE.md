# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

### Testing

**Backend tests** (pytest):
```bash
cd backend
pip install -r requirements.txt
pytest tests/
```

**Frontend tests** (Vitest + React Testing Library):
```bash
cd frontend
npm install
npm test
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

### GEMINI.md Integration

This project has Archon skills integration documented in `GEMINI.md`:
- **Do NOT** use Claude's built-in todo tracking when Archon is present
- Task management through Archon skills: `find_tasks`, `manage_task`
- Knowledge base through RAG: `rag_search_knowledge_base`, `rag_get_available_sources`
- "Landing the Plane" workflow: Must push changes to remote before session ends

### Git Workflow

Per `GEMINI.md` session completion requirements:
1. Run quality gates (tests, linters, builds)
2. Update task/issue status
3. **MANDATORY**: `git pull --rebase && git push`
4. Verify: `git status` shows "up to date with origin"

### Legacy Files

- `main.py` - CLI demo script (not used in production)
- `stub_knowledge_base.txt` - Demo artifact from multi-step agent
