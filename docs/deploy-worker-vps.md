./scripts/add-worker-to-vps.sh <TENANT_ID> <VPS_IP> --deploy
```

### Arguments:
- `<TENANT_ID>`: Unique identifier for your tenant (e.g., `tenant1`).
- `<VPS_IP>`: IP address of your VPS.

This script will generate the following files and deploy them to your VPS:

1. **Docker Compose Configuration**:
   - Appends a worker configuration snippet to `docker-compose.workers-multi.yml`.
2. **Environment Variables Template**:
   - Creates an `.env.template` file with placeholders for secrets (e.g., `OPENAI_API_KEY`).

---

## Step 2: Deploy Worker Configuration

The script will:
1. Connect to your VPS via SSH.
2. Back up the existing `docker-compose.workers-multi.yml`.
3. Append the worker configuration to it.
4. Copy the environment template for manual editing.

### Output Example:
```yaml
# Worker for TENANT_ID
worker-tenant1:
  image: ethanturk/python-agents-worker:latest
  container_name: worker-tenant1
  pull_policy: always
  command: ["python", "-m", "queue_worker"]  # Directly runs the AsyncWorker
  environment:
    CLIENT_ID: tenant1
    WORKER_POLLING_INTERVAL: "5"
    WORKER_VISIBILITY_TIMEOUT: "30"
    AZURE_STORAGE_CONNECTION_STRING: ${TENANT1_AZURE_STORAGE_CONNECTION_STRING}
  restart: unless-stopped
  networks:
    - workers

# Environment Template (for manual editing)
# Add to /root/workers/.env on VPS:

TENANT1_AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=tenant1storage;...
OPENAI_API_KEY=sk-proj-xxx
```

---

## Step 3: Configure Environment Variables

On your VPS, edit the `.env` file and replace the placeholders with actual secrets:

```bash
ssh root@<VPS_IP>
cd /root/workers/
nano .env
```

### Example `.env` File:
```ini
# ============================================
# TENANT1 Configuration
# ============================================
TENANT1_AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=tenant1storage;...
OPENAI_API_KEY=sk-proj-xxx
```

Ensure the file is **not committed to version control**.

---

## Step 4: Start Worker Container

Start the worker container using Docker Compose:

```bash
cd /root/workers/
docker-compose -f docker-compose.workers-multi.yml up -d
```

Verify that the container is running:
```bash
docker ps | grep worker-tenant1
```

---

## Step 5: Verify Deployment

Check the logs to ensure the worker is functioning correctly:

```bash
docker logs worker-tenant1 -f
```

The output should show:
```
[INFO] Worker starting for queue: tenant1-tasks
[INFO] Received 1 messages
[INFO] Processing task task-xyz: ingest
[INFO] Ingestion completed: filename.pdf
```

---

## Step 6: Monitor and Scale

- **Monitoring**: Use Docker logs or integrate with Azure Application Insights.
- **Scaling**: Deploy multiple worker containers for higher throughput. Example:
  ```yaml
  # Add to docker-compose.workers-multi.yml
  worker-tenant1-2:
    image: ethanturk/python-agents-worker:latest
    container_name: worker-tenant1-2
    command: ["python", "-m", "queue_worker"]
    environment:
      CLIENT_ID: tenant1
      WORKER_POLLING_INTERVAL: "5"
  ```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Worker not starting | Ensure `.env` file is correct and `AZURE_STORAGE_CONNECTION_STRING` is valid. |
| Permission errors on VPS | Run commands as `root` or configure SSH keys for the user. |
| Queue tasks not processed | Verify that the queue exists in Azure and the worker has permissions to access it. |

---

## Benefits of This Approach

1. **No Celery Dependency**:
   - Eliminates the need for Redis/RabbitMQ, reducing infrastructure complexity.
2. **Cost-Effective**:
   - Uses existing Azure Queue Storage without additional costs.
3. **Simplified Deployment**:
   - Directly runs `AsyncWorker` with minimal configuration changes.
4. **Tight Azure Integration**:
   - Seamlessly fits into an existing Azure environment.

---

## Next Steps

- Deploy additional workers for parallel processing if needed.
- Integrate monitoring (e.g., Prometheus, Grafana) to track queue and worker performance.

For more details on the `AsyncWorker` implementation, refer to [`/apps/worker/queue_worker.py`](python-agents/apps/worker/queue_worker.py).
