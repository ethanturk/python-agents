# Change: Remove Celery and Standardize on Azure Storage Queues

## Why
The worker currently has two competing implementations:
1. **Celery-based** (`main.py`, `async_tasks.py`) - requires Redis/RabbitMQ broker
2. **Azure Queue-based** (`queue_worker.py`) - uses Azure Storage Queues

Maintaining both adds complexity and confusion. Azure Storage Queues are already integrated with our infrastructure (same storage account as Azure Blob) and better fit our serverless architecture.

## What Changes
- **REMOVED**: Celery dependency and all Celery-specific code (`async_tasks.py`, celery broker config)
- **REMOVED**: Legacy `main.py` CLI menu interface
- **MODIFIED**: `main.py` becomes entry point for `AsyncWorker` from `queue_worker.py`
- **MODIFIED**: Docker configuration removes RabbitMQ/Redis dependencies
- **MODIFIED**: Documentation updates to reflect simplified architecture

## Impact
- **Affected specs**: `async-worker` (minor clarification)
- **Affected code**:
  - `apps/worker/main.py` - Replace CLI with async worker launch
  - `apps/worker/async_tasks.py` - Remove (Celery tasks)
  - `apps/worker/config.py` - Remove Celery config variables
  - `apps/worker/requirements.txt` - Remove celery dependency
  - `docker-compose.worker.yml` - Remove RabbitMQ service
  - `docker-compose.workers-multi.yml` - Update for async workers
  - `apps/worker/sync_agent.py` - Keep or refactor as needed

## Success Criteria
- Worker starts via `python main.py` and polls Azure Storage Queue
- All existing task types (ingest, summarize) continue to work
- Docker deployment no longer requires RabbitMQ/Redis
- Celery package removed from dependencies
- CI/CD pipeline continues to work
