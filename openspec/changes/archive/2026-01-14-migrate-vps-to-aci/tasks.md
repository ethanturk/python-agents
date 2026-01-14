# Tasks: Migrate VPS Worker to Azure Container Instances

## 1. Infrastructure Setup

- [ ] 1.1 Create Azure Container Registry (ACR)
  - Create ACR resource in Azure Portal or via CLI
  - Configure admin user or managed identity access
  - Note registry URL for CI/CD configuration

- [ ] 1.2 Create Azure Key Vault for secrets
  - Store: AZURE_STORAGE_CONNECTION_STRING, SUPABASE_KEY, OPENAI_API_KEY
  - Configure access policies for Logic App and ACI

- [ ] 1.3 Create Logic App workflow
  - Create Logic App resource (Consumption tier)
  - Add Azure Queue Storage trigger for `{client}-tasks` queue
  - Configure 30-second polling interval
  - Add "Create container group" action

- [x] 1.4 Create ACI Bicep template
  - Define container group with worker image
  - Configure environment variables with Key Vault references
  - Set restart policy to "Never"
  - Set appropriate CPU/memory (1 vCPU, 2 GB recommended)
  - **Files:** `infra/aci/main.bicep`, `infra/aci/worker-container.bicep`, `infra/aci/logic-app-trigger.bicep`

- [ ] 1.5 Test manual ACI deployment
  - Deploy ACI manually with test task data
  - Verify container logs in Azure Monitor
  - Confirm webhook notification received

## 2. Worker Code Changes

- [x] 2.1 Add single-task execution mode
  - Read TASK_DATA from environment variable
  - Parse JSON task payload
  - Execute appropriate handler
  - Exit with code 0 (success) or 1 (failure)
  - **Files:** `apps/worker/queue_worker.py` (SingleTaskRunner class)

- [x] 2.2 Refactor queue_worker.py
  - Extract `process_single_task()` function
  - Keep `AsyncWorker` class for backward compatibility
  - Ensure both modes share handler implementations
  - **Files:** `apps/worker/queue_worker.py`

- [x] 2.3 Update main.py entry point
  - Check for TASK_DATA env var
  - Branch to single-task or polling mode
  - Maintain existing behavior when TASK_DATA absent
  - **Files:** `apps/worker/main.py`

- [x] 2.4 Add container timeout handling
  - Set maximum execution time (e.g., 30 minutes)
  - Graceful timeout with webhook notification
  - Prevent runaway containers
  - **Files:** `apps/worker/queue_worker.py` (DEFAULT_TASK_TIMEOUT, execute_with_timeout)

- [x] 2.5 Write unit tests for single-task mode
  - Test task data parsing
  - Test handler routing
  - Test webhook notification on success/failure
  - Test timeout behavior
  - **Files:** `apps/worker/tests/test_single_task_mode.py`

## 3. CI/CD Pipeline Updates

- [x] 3.1 Update GitHub Actions workflow
  - Add ACR login step
  - Change push target from Docker Hub to ACR
  - Tag images with git SHA and "latest"
  - Keep Docker Hub push as backup (optional)
  - **Files:** `.github/workflows/docker-hub-deploy.yml`

- [ ] 3.2 Add deployment verification step
  - Verify image pushed to ACR successfully
  - Trigger test ACI deployment (optional)
  - Notify on deployment failure

- [ ] 3.3 Create environment secrets
  - Add ACR_LOGIN_SERVER to GitHub secrets
  - Add ACR_USERNAME and ACR_PASSWORD (or use OIDC)
  - Document required secrets

## 4. Logic App Configuration

- [ ] 4.1 Configure queue trigger
  - Set queue name parameter (from env or hard-coded)
  - Configure connection to Azure Storage
  - Set message batch size to 1 (per-task model)
  - Enable message deletion after processing

- [ ] 4.2 Add message parsing action
  - Parse JSON from queue message content
  - Extract task_id, task_type, payload, webhook_url
  - Handle malformed messages gracefully

- [ ] 4.3 Configure ACI creation action
  - Use ARM connector to create container group
  - Pass parsed task data as TASK_DATA env var
  - Set container name with unique suffix (task_id)
  - Configure resource group and location

- [ ] 4.4 Add error handling
  - Configure retry policy for transient failures
  - Add dead-letter queue for persistent failures
  - Send alert on repeated failures

- [ ] 4.5 Test end-to-end workflow
  - Submit test task via backend API
  - Verify Logic App triggers
  - Confirm ACI created and processes task
  - Validate webhook received by backend

## 5. Cutover and Validation

- [ ] 5.1 Deploy updated worker image to ACR
  - Merge code changes to main
  - Verify CI/CD pushes to ACR
  - Confirm image available in registry

- [ ] 5.2 Enable Logic App trigger
  - Turn on Logic App workflow
  - Monitor first triggered run
  - Verify successful task processing

- [ ] 5.3 Run parallel testing
  - Keep VPS worker running temporarily
  - Submit test tasks via both paths
  - Compare results and timing

- [ ] 5.4 Disable VPS worker
  - Stop VPS worker service
  - Verify all tasks route through ACI
  - Monitor for 24-48 hours

- [ ] 5.5 Decommission VPS
  - Backup any logs or data
  - Terminate VPS instance
  - Cancel VPS billing

## 6. Cleanup and Documentation

- [ ] 6.1 Remove deprecated files
  - Archive `docker-compose.worker.yml`
  - Archive `docker-compose.workers-multi.yml`
  - Remove systemd service references from docs

- [x] 6.2 Update documentation
  - Update CLAUDE.md with new deployment model
  - Document ACI troubleshooting steps
  - Update architecture diagrams
  - **Files:** `CLAUDE.md`, `infra/aci/README.md`

- [ ] 6.3 Remove Docker Hub deployment (optional)
  - Remove Docker Hub push from CI/CD
  - Or keep as backup/public image

- [ ] 6.4 Set up monitoring and alerts
  - Configure Azure Monitor for ACI logs
  - Set up cost alerts
  - Create dashboard for task metrics

## Dependencies

- Task 2.x depends on 1.1 (ACR must exist for image push)
- Task 3.x depends on 1.1, 1.2 (infrastructure must exist)
- Task 4.x depends on 1.3, 1.4 (Logic App and Bicep template)
- Task 5.x depends on all previous phases
- Task 6.x can run in parallel with 5.x after cutover

## Parallelizable Work

- 1.1, 1.2, 1.3 can run in parallel
- 2.1-2.5 can run in parallel with 1.x
- 3.1-3.3 can run after 1.1 completes
- 4.1-4.5 can run after 1.3, 1.4 complete

## Completed Summary

**Code changes complete (Section 2):**
- Single-task execution mode with `TASK_DATA` env var
- Dual-mode entry point in `main.py`
- Timeout handling with `WORKER_TASK_TIMEOUT`
- Unit tests for single-task mode

**Infrastructure templates complete (Section 1.4):**
- Bicep templates for ACR, Key Vault, Logic App, ACI
- README with deployment instructions

**CI/CD updated (Section 3.1):**
- GitHub Actions workflow pushes to ACR (primary) and Docker Hub (backup)

**Next steps:**
1. Deploy Azure infrastructure (ACR, Key Vault) using `infra/aci/main.bicep`
2. Add GitHub secrets (ACR_LOGIN_SERVER, ACR_USERNAME, ACR_PASSWORD)
3. Merge code changes and verify CI/CD
4. Test end-to-end workflow
