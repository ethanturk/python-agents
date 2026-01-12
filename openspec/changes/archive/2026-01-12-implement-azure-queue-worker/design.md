# Design: Azure Queue Service and Async Worker Architecture

## Current State

### Queue Service Abstraction
The existing `services/queue_service.py` has:
- Abstract `QueueService` base class
- Azure Queue stub (`AzureQueueService`) with minimal implementation
- No actual worker process to consume messages

### Azure Storage Configuration
```python
AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
AZURE_STORAGE_CONTAINER_NAME = os.getenv("AZURE_STORAGE_CONTAINER_NAME")  # For blobs
AZURE_STORAGE_ACCOUNT_NAME = os.getenv("AZURE_STORAGE_ACCOUNT_NAME")
```

### Task Flow (Current Mock)
```
Frontend → queue.submit_task() → MockQueueService → Returns task_id
         → (no actual processing)
```

## Proposed Architecture

### Per-Client Queue Isolation

```
Azure Storage Account
├── Queue: southhaven-tasks (Client: southhaven)
├── Queue: demo-tasks (Client: demo)
├── Queue: prod-tasks (Client: production)
└── Container: documents (Blob storage - shared)
```

### Task Flow (With Worker)

```
Frontend Server (Vercel)
  ↓ Submit task
Azure Queue (southhaven-tasks)
  ↓ Worker polls
Async Worker (VPS)
  ↓ Process task (ingest, summarize, etc.)
  ↓ Send webhook
Frontend Server (/internal/notify)
  → Update database/notify clients
```

### Worker Architecture

```
async_worker.py
├── QueueConsumer
│   ├── Polls from client-specific queue
│   ├── Acknowledges messages on receipt
│   └── Handles visibility timeout
├── TaskHandlers
│   ├── IngestionHandler → Process documents, index in Supabase
│   ├── SummarizationHandler → Generate summaries, save to database
│   └── AgentHandler → Run async agent workflows
└── NotificationService
    ├── Send webhook to frontend on completion
    └── Send webhook on failure
```

### Queue Naming Convention

**Queue Name Format:** `{CLIENT_ID}-tasks`

Examples:
- `southhaven-tasks`
- `demo-tasks`
- `production-tasks`

**Client ID Sources:**
1. Environment variable `CLIENT_ID` (e.g., southhaven, demo)
2. Fallback to `default` if not set

### Message Format

**Message Structure:**
```json
{
  "task_id": "uuid",
  "task_type": "ingest|summarize|agent",
  "payload": {
    "filename": "document.pdf",
    "document_set": "southhaven"
  },
  "webhook_url": "https://api.example.com/internal/notify"
}
```

### Task Status Tracking

Since Azure Queue doesn't have built-in status tracking, we'll implement:

**Strategy:** Worker sends webhook notifications on completion/failure

```
Worker → POST /internal/notify
{
  "task_id": "uuid",
  "status": "completed|failed",
  "result": "...",
  "error": "..."
}

Frontend → Save to database/queue for clients to poll
```

## Implementation Details

### AzureQueueService Enhancements

```python
class AzureQueueService(QueueService):
    def __init__(self):
        self.connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
        # Dynamic queue name per client
        client_id = os.getenv("CLIENT_ID", "default")
        self.queue_name = f"{client_id}-tasks"
```

### Worker Script Structure

```python
# worker/async_worker.py

class AsyncWorker:
    def __init__(self):
        self.client_id = os.getenv("CLIENT_ID", "default")
        self.queue_client = QueueServiceClient.from_connection_string(...)

    async def run(self):
        while True:
            messages = await self.queue_client.receive_messages(...)
            for message in messages:
                await self.process_message(message)
                await self.queue_client.delete_message(message.id)

    async def process_message(self, message):
        task_data = json.loads(message.content)
        handler = self.get_handler(task_data["task_type"])
        result = await handler.execute(task_data["payload"])
        await self.notify_completion(task_data, result)
```

### Task Handlers

**Ingestion Handler:**
- Download file from Azure Blob Storage
- Process with Docling
- Generate embeddings
- Index in Supabase vector DB

**Summarization Handler:**
- Download file from Azure Blob Storage
- Generate summary with LLM
- Save to database

### Error Handling

**Retry Logic:**
- Network errors: Retry with exponential backoff
- Processing errors: Mark task as failed, send webhook with error details
- Poison messages: Move to dead-letter queue after N retries

### Deployment

**Worker Requirements:**
- Python 3.11+
- Environment variables: `CLIENT_ID`, `AZURE_STORAGE_CONNECTION_STRING`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`
- Systemd service for auto-restart
- Log monitoring

**Example systemd service:**
```ini
[Unit]
Description=Async Worker for {CLIENT_ID}

[Service]
ExecStart=/usr/bin/python3 /path/to/worker/async_worker.py
Restart=always
Environment=CLIENT_ID=southhaven

[Install]
WantedBy=multi-user.target
```

## Trade-offs

### Pros
- **Simple**: Leverages existing Azure Storage, no new infrastructure
- **Isolated**: Per-client queues prevent cross-contamination
- **Reliable**: Azure provides durability and at-least-once delivery
- **Scalable**: Worker can process multiple tasks concurrently
- **Cost-effective**: Azure Queue pricing is competitive

### Cons
- **No real-time status**: Clients must poll for updates (no WebSocket push)
- **Worker management**: Requires VPS management (deployment, monitoring, scaling)
- **Single point of failure**: Worker VPS goes down, tasks queue up
- **Polling overhead**: Worker must poll queue (vs. push notifications)

## Considerations

### Queue Visibility Timeout
Azure Queue messages have visibility timeout (30s max by default):
- Worker must renew visibility before timeout for long tasks
- Configure based on expected task duration

### Throughput Limits
Azure Queue limits:
- Up to 20,000 messages per second
- Up to 80 GB per queue
- Sufficient for typical document processing loads

### Message Size Limit
Azure Queue max message size: 64 KB
- Large payloads (file content) must reference Blob Storage
- Task messages only contain metadata and file references

### Multi-Worker Scaling (Future)
To scale beyond single worker:
- Run multiple worker instances
- Each polls same queue
- Use dequeuing with receipt handle to prevent duplicate processing
