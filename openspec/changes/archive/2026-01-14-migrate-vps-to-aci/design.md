# Design: Migrate VPS Worker to Azure Container Instances

## Context

The system currently deploys a Python worker to a VPS that continuously polls Azure Storage Queue for tasks. This design document outlines the migration to Azure Container Instances (ACI) with per-task execution triggered by Azure Logic App.

### Current Architecture

```
┌─────────────────┐      ┌────────────────────┐      ┌─────────────────┐
│  Backend API    │──────│ Azure Storage Queue │──────│  VPS Worker     │
│  (Vercel)       │      │ ({client}-tasks)    │      │  (Docker)       │
└─────────────────┘      └────────────────────┘      └─────────────────┘
                                                            │
                         ┌────────────────────┐             │
                         │  Azure Blob Storage │◄───────────┘
                         │  (documents)        │
                         └────────────────────┘
```

- Worker runs continuously on VPS
- Polls queue every 5 seconds
- Processes tasks sequentially
- Sends webhook on completion

### Proposed Architecture

```
┌─────────────────┐      ┌────────────────────┐      ┌─────────────────┐
│  Backend API    │──────│ Azure Storage Queue │──────│  Azure Logic    │
│  (Vercel)       │      │ ({client}-tasks)    │      │  App (trigger)  │
└─────────────────┘      └────────────────────┘      └────────┬────────┘
                                                              │
                         ┌────────────────────┐      ┌────────▼────────┐
                         │  Azure Blob Storage │◄────│  Azure Container│
                         │  (documents)        │     │  Instance (ACI) │
                         └────────────────────┘      └─────────────────┘
                                                              │
                         ┌────────────────────┐               │
                         │  Azure Container   │◄──────────────┘
                         │  Registry (ACR)    │
                         └────────────────────┘
```

## Goals

- Reduce infrastructure costs by 70-85%
- Eliminate VPS maintenance overhead
- Maintain identical task processing functionality
- Preserve webhook notification behavior
- Enable automatic scaling for burst workloads

## Non-Goals

- Changing task message format
- Modifying backend API behavior
- Adding new task types
- Changing webhook notification endpoints

## Key Decisions

### Decision 1: Per-Task Container Execution

**Choice**: Create new ACI container for each task, terminate on completion

**Rationale**:
- Low task volume (<50/day) makes per-task execution cost-effective
- Eliminates idle compute costs (current VPS runs 24/7)
- Each task gets dedicated resources (no queue contention)
- Automatic cleanup after task completion

**Trade-offs**:
- Cold start latency (~10-30s for container spin-up)
- Not suitable for high-volume workloads (>500/day)
- Slightly more complex orchestration

**Alternatives Considered**:
1. **Long-running ACI with polling** - Same cost model as VPS, no benefit
2. **Azure Functions** - 10-minute timeout limit insufficient for document processing
3. **Azure Kubernetes Service** - Overkill for low volume, higher complexity

### Decision 2: Azure Logic App as Trigger

**Choice**: Use Azure Logic App with Queue Storage connector

**Rationale**:
- Native Azure Queue Storage integration
- Visual workflow designer for easy debugging
- Built-in retry and error handling
- Low-code solution reduces maintenance

**Implementation**:
```json
{
  "trigger": {
    "type": "When_messages_are_available_in_queue",
    "inputs": {
      "queue": "{client}-tasks",
      "checkInterval": "PT30S"
    }
  },
  "actions": {
    "Create_container_group": {
      "type": "ARM",
      "inputs": {
        "containerGroup": "{task-specific-config}"
      }
    }
  }
}
```

**Alternatives Considered**:
1. **Azure Event Grid + Functions** - More components, no clear benefit
2. **Backend API direct creation** - Tighter coupling, harder to debug
3. **Azure Automation Runbooks** - Slower, more complex

### Decision 3: Single-Task Worker Mode

**Choice**: Modify worker to accept task via environment variables, process once, exit

**Rationale**:
- Simpler container lifecycle (no graceful shutdown needed)
- Task data passed via env vars or volume mount
- Natural fit for ACI per-task model
- Easier debugging (one task per container log)

**Implementation**:
```python
# apps/worker/main.py
async def main():
    task_data = json.loads(os.environ.get("TASK_DATA"))
    task_type = task_data.get("task_type")
    payload = task_data.get("payload")
    webhook_url = task_data.get("webhook_url")

    handler = handlers.get(task_type)
    result = await handler.execute(payload)

    await send_webhook(webhook_url, result)
    sys.exit(0 if result["status"] == "completed" else 1)
```

### Decision 4: Azure Container Registry for Images

**Choice**: Deploy worker images to ACR instead of Docker Hub

**Rationale**:
- Faster pull times from same Azure region
- Private registry (no public exposure)
- Integrated authentication with ACI
- Better CI/CD integration with Azure

**Migration**:
- Update GitHub Actions to push to ACR
- Configure ACI to pull from ACR with managed identity

## Component Specifications

### Logic App Workflow

```yaml
name: worker-task-trigger
triggers:
  - type: azure-queue
    queue: "{client_id}-tasks"
    connection: azure-storage
    interval: PT30S

actions:
  - parse-message:
      type: parse-json
      content: "@triggerBody()"

  - create-aci:
      type: azure-resource-manager
      resource: Microsoft.ContainerInstance/containerGroups
      properties:
        containers:
          - name: worker
            image: "{acr}.azurecr.io/worker:latest"
            resources:
              cpu: 1
              memoryInGB: 2
            environmentVariables:
              - name: TASK_DATA
                value: "@body('parse-message')"
        restartPolicy: Never
```

### ACI Container Group Definition (Bicep)

```bicep
param taskData string
param clientId string = 'default'

resource containerGroup 'Microsoft.ContainerInstance/containerGroups@2023-05-01' = {
  name: 'worker-${uniqueString(taskData)}'
  location: resourceGroup().location
  properties: {
    containers: [
      {
        name: 'worker'
        properties: {
          image: '${acrName}.azurecr.io/worker:latest'
          resources: {
            requests: {
              cpu: 1
              memoryInGB: 2
            }
          }
          environmentVariables: [
            { name: 'TASK_DATA', value: taskData }
            { name: 'CLIENT_ID', value: clientId }
            { name: 'AZURE_STORAGE_CONNECTION_STRING', secureValue: azureStorageConnection }
            { name: 'SUPABASE_URL', value: supabaseUrl }
            { name: 'SUPABASE_KEY', secureValue: supabaseKey }
            { name: 'OPENAI_API_KEY', secureValue: openaiApiKey }
          ]
        }
      }
    ]
    osType: 'Linux'
    restartPolicy: 'Never'
  }
}
```

### Worker Execution Modes

The worker will support two modes:

1. **Single-task mode** (ACI): Read `TASK_DATA` env var, process, exit
2. **Polling mode** (legacy/development): Continuous queue polling

```python
# apps/worker/main.py
import asyncio
import os

from queue_worker import AsyncWorker, process_single_task

async def main():
    task_data = os.environ.get("TASK_DATA")

    if task_data:
        # ACI mode: process single task and exit
        await process_single_task(task_data)
    else:
        # Legacy mode: continuous polling
        worker = AsyncWorker()
        worker.setup_signal_handlers()
        await worker.run()

if __name__ == "__main__":
    asyncio.run(main())
```

## Migration Plan

### Phase 1: Infrastructure Setup
1. Create Azure Container Registry
2. Deploy Logic App workflow
3. Create Key Vault for secrets
4. Test with manual ACI creation

### Phase 2: Code Changes
1. Add single-task mode to worker
2. Update CI/CD to push to ACR
3. Test end-to-end with Logic App trigger

### Phase 3: Cutover
1. Deploy updated worker image to ACR
2. Enable Logic App trigger
3. Monitor for successful task execution
4. Disable VPS worker polling

### Phase 4: Cleanup
1. Decommission VPS
2. Remove Docker Hub deployment
3. Archive docker-compose files
4. Update documentation

## Rollback Plan

If issues occur:
1. Re-enable VPS worker polling
2. Disable Logic App trigger
3. Tasks continue via existing Azure Queue

No data loss risk - queue messages remain until processed.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cold start latency | Tasks delayed 10-30s | Acceptable for async workloads |
| Logic App trigger failures | Tasks not processed | Dead-letter queue + alerts |
| Container pull failures | Tasks fail | Retry in Logic App + ACR geo-replication |
| Secrets exposure in env vars | Security risk | Use Azure Key Vault references |
| Cost spike from runaway containers | Unexpected costs | Set container timeout, budget alerts |

## Monitoring and Observability

- **Logic App**: Built-in run history and diagnostics
- **ACI**: Container logs to Azure Monitor
- **Alerting**:
  - Failed Logic App runs
  - Container exit codes != 0
  - Queue depth > threshold
  - Monthly cost > budget

## Open Questions

1. **Queue message visibility**: Should Logic App delete message before or after ACI completes?
   - **Proposed**: Delete after ACI reports success via webhook (prevents duplicate processing)

2. **Multi-client support**: How to handle multiple CLIENT_ID values?
   - **Proposed**: One Logic App per client, or parameterized Logic App with client detection
