## MODIFIED Requirements

### Requirement: Worker Deployment
The worker MUST be deployable as a systemd service using Azure Storage Queues.

#### Scenario: Worker installed as service
Given the worker script is installed at /opt/worker/main.py
And a systemd service file is created
When the system boots
Then the worker must start automatically via `python main.py`
And must restart on failure
And must use the configured CLIENT_ID from environment
And must connect to Azure Storage Queue (not Celery/RabbitMQ)

#### Scenario: Worker logs monitoring
Given the worker is running
When errors or warnings occur
Then the worker must log to syslog or a configured log file
And logs must include task_id for traceability

## REMOVED Requirements

### Requirement: Celery Task Definitions
**Reason**: Celery is being replaced by Azure Storage Queues for simplified deployment and better alignment with serverless architecture.
**Migration**: All task logic has been moved to handler classes in `queue_worker.py`. The `IngestionHandler` and `SummarizationHandler` classes provide equivalent functionality.

### Requirement: Celery Broker Configuration
**Reason**: No longer needed with Azure Storage Queues.
**Migration**: Workers use `AZURE_STORAGE_CONNECTION_STRING` and `CLIENT_ID` environment variables instead of Celery broker URLs.
