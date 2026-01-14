# Tasks: Remove Celery Worker

## Phase 1: Prepare Worker Entry Point
- [ ] 1.1 Update `apps/worker/main.py` to import and run `AsyncWorker` from `queue_worker.py`
- [ ] 1.2 Remove CLI menu interface from `main.py`
- [ ] 1.3 Add startup banner with configuration info (client ID, queue name, polling interval)

## Phase 2: Remove Celery Dependencies
- [ ] 2.1 Delete `apps/worker/async_tasks.py` (Celery task definitions)
- [ ] 2.2 Remove Celery configuration from `apps/worker/config.py` (CELERY_BROKER_URL, CELERY_RESULT_BACKEND, CELERY_QUEUE_NAME)
- [ ] 2.3 Remove `celery` and `flower` from `requirements.txt`
- [ ] 2.4 Remove `kombu`, `amqp`, and other Celery transitive dependencies if explicitly listed

## Phase 3: Update Docker Configuration
- [ ] 3.1 Remove RabbitMQ service from `docker-compose.worker.yml`
- [ ] 3.2 Update worker service command from `celery -A async_tasks worker` to `python main.py`
- [ ] 3.3 Remove Celery environment variables from Docker Compose files
- [ ] 3.4 Update `docker-compose.workers-multi.yml` for async worker pattern (if scaling needed)

## Phase 4: Clean Up Related Files
- [ ] 4.1 Review `apps/worker/sync_agent.py` - determine if still needed (used by old main.py CLI)
- [ ] 4.2 Update any imports that reference `async_tasks` module
- [ ] 4.3 Remove any remaining Celery-specific utility functions

## Phase 5: Documentation Updates
- [ ] 5.1 Update `CLAUDE.md` worker section to remove Celery references
- [ ] 5.2 Update `openspec/AGENTS.md` Project Architecture section (line 23: "Python Celery Worker")
- [ ] 5.3 Update `docs/` if any deployment docs reference Celery/RabbitMQ

## Phase 6: Validation
- [ ] 6.1 Run `python main.py` locally and verify worker starts
- [ ] 6.2 Submit test task to Azure Queue and verify processing
- [ ] 6.3 Verify webhook notifications sent on task completion
- [ ] 6.4 Build Docker image and test container deployment
- [ ] 6.5 Run pre-commit hooks: `pre-commit run --all-files`
- [ ] 6.6 Run linting: `cd apps/worker && ruff check . && black --check .`

## Dependencies
- Phase 1 must complete before Phase 6 (validation)
- Phase 2 can run in parallel with Phase 3
- Phase 4 and 5 can run after Phase 2 and 3

## Rollback Plan
If issues discovered after deployment:
1. Git revert the changes
2. Restore Celery dependencies in requirements.txt
3. Restore RabbitMQ service in docker-compose
