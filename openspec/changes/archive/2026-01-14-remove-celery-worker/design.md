# Design: Remove Celery Worker

## Context

The worker application (`apps/worker/`) currently has two parallel implementations:

| Aspect | Celery (Legacy) | Azure Queue (Current) |
|--------|-----------------|----------------------|
| Entry point | `main.py` CLI menu | `queue_worker.py` |
| Task definitions | `async_tasks.py` | Handler classes in `queue_worker.py` |
| Broker | Redis or RabbitMQ | Azure Storage Queue |
| Task invocation | `task.delay()` / `apply_async()` | Queue message polling |
| Result backend | RPC or Redis | Webhook notifications |

The Azure Queue implementation is already production-ready and better aligned with our serverless architecture:
- Same Azure Storage account as Blob Storage
- No additional broker infrastructure
- Per-client queue isolation (`{CLIENT_ID}-tasks`)

## Goals
- Single worker implementation using Azure Storage Queues
- Simplified deployment (no RabbitMQ/Redis dependency)
- Maintain all existing functionality (ingest, summarize)

## Non-Goals
- Adding new task types (out of scope)
- Changing the backend→worker communication pattern
- Modifying the webhook notification system

## Key Decisions

### Decision 1: Make `queue_worker.py` the primary entry point

**Rationale:** The `AsyncWorker` class in `queue_worker.py` already implements:
- Azure Queue polling with configurable intervals
- Task handler routing (ingest, summarize)
- Webhook notifications on completion
- Graceful shutdown handling
- Signal handlers (SIGTERM, SIGINT)

**Implementation:** Update `main.py` to simply import and run `AsyncWorker`:
```python
# apps/worker/main.py
import asyncio
from queue_worker import main as run_worker

if __name__ == "__main__":
    asyncio.run(run_worker())
```

### Decision 2: Remove Celery entirely (not deprecate)

**Rationale:**
- Celery adds significant dependency footprint (celery, kombu, amqp, vine, etc.)
- RabbitMQ/Redis broker requires additional infrastructure
- The backend already uses Azure Queue Service abstraction
- No active code paths use Celery tasks

**Removed files:**
- `async_tasks.py` - Celery task decorators and implementations
- Celery config in `config.py` - broker URLs, result backend

### Decision 3: Keep sync_agent.py for potential direct invocation

**Rationale:** The `sync_agent.py` module contains the `run_sync_agent()` function used by the old CLI. While the CLI menu is removed, this function could be useful for:
- Direct agent invocation during testing
- Future API endpoint integration

**Action:** Keep file but remove import from `main.py`

## Architecture After Change

```
apps/worker/
├── main.py                    # Entry point: runs AsyncWorker
├── queue_worker.py           # AsyncWorker class, handlers, notification service
├── config.py                  # Config (minus Celery settings)
├── summarizer.py             # Document summarization logic
├── sync_agent.py             # Direct agent invocation (optional)
└── services/
    ├── queue_service.py      # Azure Queue abstraction
    ├── ingestion.py          # Document processing
    ├── azure_storage.py      # Blob storage client
    ├── llm.py                # LLM integration
    └── vector_db.py          # Supabase vector DB
```

## Message Flow (Unchanged)

```
Backend API (Vercel)
    │
    │ POST to Azure Queue: {task_type, payload, webhook_url}
    ▼
Azure Storage Queue ({CLIENT_ID}-tasks)
    │
    │ Poll every 5s
    ▼
AsyncWorker (Python)
    │
    ├── IngestionHandler  → Process file → Index to Supabase
    │
    └── SummarizationHandler → Summarize → Store result
    │
    │ POST webhook
    ▼
Backend API (/api/notifications/internal/notify)
    │
    ▼
Frontend (Long-polling /api/poll)
```

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Existing deployments use Celery | Coordinate deployment timing; update deployment docs |
| Lost functionality in async_tasks.py | Verified: all logic duplicated in queue_worker.py handlers |
| Docker image size change | Monitor; Celery removal should decrease size |

## Open Questions

None - implementation path is clear.
