# Change: Migrate Worker from VPS to Azure Container Instances

## Why

The current worker runs on a VPS with continuous polling, incurring costs 24/7 regardless of workload. With low task volume (<50/day), this is inefficient:

1. **Cost**: VPS runs continuously even during idle periods (nights, weekends)
2. **Performance**: Cold VPS may have resource contention; dedicated per-task containers get full resources
3. **Scaling**: VPS requires manual intervention to scale; ACI scales automatically per-task
4. **Maintenance**: VPS requires OS updates, security patches, Docker daemon management

Azure Container Instances (ACI) with per-task execution provides:
- Pay-per-second billing (only pay while task runs)
- Instant scaling (no warm-up required)
- Zero maintenance (managed container platform)
- Isolation (each task gets dedicated resources)

## What Changes

- **ADDED**: Azure Logic App to monitor queue and trigger ACI
- **ADDED**: ARM template / Bicep for ACI container group definition
- **MODIFIED**: Worker container to run single task then exit (vs. continuous polling)
- **MODIFIED**: CI/CD pipeline to deploy to Azure Container Registry (ACR) instead of Docker Hub
- **REMOVED**: VPS deployment configuration
- **REMOVED**: docker-compose.worker.yml (replaced by ACI definition)
- **REMOVED**: systemd service configuration references

## Impact

- **Affected specs**: `async-worker` (deployment model change)
- **Affected code**:
  - `apps/worker/main.py` - Run single task from env vars then exit
  - `apps/worker/queue_worker.py` - Remove polling loop, add single-task mode
  - `.github/workflows/docker-hub-deploy.yml` - Deploy to ACR instead
  - `docker-compose.worker.yml` - Remove (replaced by Bicep/ARM)
- **Affected infrastructure**:
  - New: Azure Logic App (queue trigger)
  - New: Azure Container Registry
  - New: Azure Container Instance template
  - Removed: VPS hosting

## Cost Analysis

**Current (VPS)**:
- ~$5-20/month for basic VPS (continuous)

**Proposed (ACI)**:
- Per-task: ~$0.000012/second for 1 vCPU, 1.5 GB RAM
- 50 tasks/day × 60s avg × 30 days = 90,000 seconds/month
- Estimated: ~$1-2/month for compute
- Logic App: ~$0.10/month for triggers
- **Total: ~$2-3/month** (70-85% savings)

## Success Criteria

- Worker processes tasks successfully via ACI
- Task completion webhooks work correctly
- Logic App triggers ACI within 30 seconds of queue message
- CI/CD deploys to ACR on push to main
- VPS can be decommissioned
