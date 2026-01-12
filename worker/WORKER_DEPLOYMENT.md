# Queue Worker Deployment Guide

This guide covers deploying the async queue worker on a VPS using systemd.

## Overview

The queue worker processes long-running tasks (document ingestion, summarization) from Azure Storage Queue and sends webhook notifications on completion.

## Architecture

```
Frontend Server (Vercel)
  ↓ Submit task
Azure Queue ({CLIENT_ID}-tasks)
  ↓ Worker polls
Queue Worker (VPS)
  ↓ Process task
  ↓ Send webhook
Frontend Server (/internal/notify)
  → Update database/notify clients
```

## Prerequisites

- Ubuntu 20.04+ or similar Linux distribution
- Python 3.11+
- Azure Storage account with Queue and Blob storage
- Supabase project with vector database
- OpenAI API key or local LLM setup

## Installation

### 1. Prepare Server

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Python 3.11+ and dependencies
sudo apt install -y python3.11 python3.11-venv python3-pip

# Create worker directory
sudo mkdir -p /opt/worker
sudo chown $USER:$USER /opt/worker
```

### 2. Deploy Worker Files

```bash
# Copy worker files to server
cd /opt/worker

# Copy from local development machine:
scp -r worker/* user@vps:/opt/worker/

# Or clone repository
git clone <repo-url> /opt/worker
cd /opt/worker
```

### 3. Install Dependencies

```bash
cd /opt/worker
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Configure Environment

```bash
# Copy environment template
cp .env.worker.example .env

# Edit environment variables
nano .env
```

Required configuration:

```env
CLIENT_ID=southhaven                  # Unique client identifier
WORKER_POLLING_INTERVAL=5             # Polling interval (seconds)
WORKER_VISIBILITY_TIMEOUT=30           # Message visibility timeout (seconds)
WORKER_MAX_MESSAGES=10                # Max messages per poll

AZURE_STORAGE_CONNECTION_STRING=...     # Azure Storage connection string
AZURE_STORAGE_CONTAINER_NAME=documents  # Blob container name
AZURE_STORAGE_ACCOUNT_NAME=...         # Azure Storage account name

OPENAI_API_KEY=...                    # OpenAI API key
OPENAI_API_BASE=https://api.openai.com/v1  # API base URL
OPENAI_MODEL=gpt-4                    # Model name
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1536

SUPABASE_URL=https://xxx.supabase.co   # Supabase URL
SUPABASE_KEY=eyJ...                    # Supabase service key

QUEUE_PROVIDER=azure                    # or 'mock' for testing
```

### 5. Install Systemd Service

```bash
# Make install script executable
chmod +x install-worker-service.sh

# Install service (run as root)
sudo ./install-worker-service.sh southhaven /opt/worker
```

The script:
- Creates systemd service file
- Creates dedicated `worker` user
- Sets proper permissions
- Enables auto-start on boot

### 6. Start Worker Service

```bash
# Start the service
sudo systemctl start queue-worker-southhaven

# Check status
sudo systemctl status queue-worker-southhaven

# View logs
sudo journalctl -u queue-worker-southhaven -f
```

## Service Management

### Start/Stop/Restart

```bash
sudo systemctl start queue-worker-<CLIENT_ID>
sudo systemctl stop queue-worker-<CLIENT_ID>
sudo systemctl restart queue-worker-<CLIENT_ID>
```

### Enable/Disable Auto-Start

```bash
# Enable (start on boot)
sudo systemctl enable queue-worker-<CLIENT_ID>

# Disable (no auto-start)
sudo systemctl disable queue-worker-<CLIENT_ID>
```

### View Logs

```bash
# Follow logs in real-time
sudo journalctl -u queue-worker-<CLIENT_ID> -f

# Last 100 lines
sudo journalctl -u queue-worker-<CLIENT_ID> -n 100

# Since specific time
sudo journalctl -u queue-worker-<CLIENT_ID> --since "1 hour ago"
```

## Configuration

### Worker Behavior

| Environment Variable | Default | Description |
|-------------------|---------|-------------|
| `CLIENT_ID` | `default` | Unique client ID for queue isolation |
| `WORKER_POLLING_INTERVAL` | `5` | Seconds between queue polls |
| `WORKER_VISIBILITY_TIMEOUT` | `30` | Seconds message is hidden while processing |
| `WORKER_MAX_MESSAGES` | `10` | Max messages to fetch per poll |

### Adjusting for Long-Running Tasks

If tasks take longer than 30 seconds:

```env
WORKER_VISIBILITY_TIMEOUT=60  # or longer based on task duration
```

### Reducing Polling Overhead

For lower latency:

```env
WORKER_POLLING_INTERVAL=1  # Poll every second
```

For higher efficiency with fewer tasks:

```env
WORKER_POLLING_INTERVAL=30  # Poll every 30 seconds
```

## Troubleshooting

### Worker Not Starting

```bash
# Check service status
sudo systemctl status queue-worker-<CLIENT_ID>

# View detailed logs
sudo journalctl -u queue-worker-<CLIENT_ID> -n 50 --no-pager

# Common issues:
# - Missing .env file
# - Invalid AZURE_STORAGE_CONNECTION_STRING
# - Python dependencies not installed
```

### Queue Connection Failures

```bash
# Test Azure connection manually
cd /opt/worker
source venv/bin/activate
python3 -c "from azure.storage.queue import QueueServiceClient; import os; client = QueueServiceClient.from_connection_string(os.getenv('AZURE_STORAGE_CONNECTION_STRING')); print('Connection successful')"
```

### Tasks Not Processing

1. Check queue name matches CLIENT_ID:
   ```bash
   # Queue should be: {CLIENT_ID}-tasks
   # Example: southhaven-tasks
   ```

2. Verify message format:
   ```json
   {
     "task_type": "ingest|summarize",
     "payload": {"filename": "...", "document_set": "..."},
     "webhook_url": "..."
   }
   ```

3. Check webhook URL is accessible from VPS

### High Memory/CPU Usage

```bash
# Monitor resource usage
htop

# If worker consuming too much memory:
# - Reduce WORKER_MAX_MESSAGES
# - Add memory limits to systemd service
```

### Stale Messages in Queue

If messages remain in queue indefinitely:

```bash
# Check worker is running
sudo systemctl status queue-worker-<CLIENT_ID>

# Check logs for errors
sudo journalctl -u queue-worker-<CLIENT_ID> -f

# Manually delete poison messages via Azure Portal or CLI
```

## Monitoring

### Health Checks

Worker logs key events:

- Worker startup configuration
- Messages received and processed
- Task completion/failure
- Webhook delivery status

### Log Patterns

Success:
```
INFO - Processing task <uuid>: ingest
INFO - Ingestion completed: document.pdf
INFO - Task <uuid> completed with status: completed
INFO - Webhook sent successfully to https://...
```

Error:
```
ERROR - Ingestion failed: document.pdf: <error>
ERROR - Webhook failed: <error>
```

### Metrics to Monitor

1. **Queue Depth**: Messages waiting to be processed
2. **Processing Latency**: Time from message received to completion
3. **Error Rate**: Failed tasks / total tasks
4. **Webhook Success Rate**: Successful notifications / total

Use Azure Storage metrics or custom logging for monitoring.

## Scaling

### Multiple Workers

For higher throughput, run multiple workers:

```bash
# Deploy to multiple VPS with same CLIENT_ID
# Workers will share load via queue's dequeue mechanism

# Or use systemd to run multiple instances:
sudo systemctl start queue-worker-southhaven@1
sudo systemctl start queue-worker-southhaven@2
```

### Worker Auto-Scaling

Consider:
- Horizontal Pod Autoscaler (Kubernetes)
- Azure Virtual Machine Scale Sets
- Auto-scaling groups (AWS/Azure)

## Security

### Secrets Management

1. **Never commit .env files** to version control
2. **Use environment-specific secrets** for dev/staging/prod
3. **Rotate credentials regularly**
4. **Limit Azure Storage permissions** to only required queues/containers

### Systemd Hardening

The service template includes:
- `NoNewPrivileges=true`: Prevents privilege escalation
- `PrivateTmp=true`: Isolates /tmp
- `ProtectSystem=strict`: Read-only system directories
- `ProtectHome=true`: Prevents home directory access

### Network Security

- Allow outbound HTTPS only (for Azure, OpenAI, Supabase APIs)
- Block inbound ports except for SSH (22)
- Use SSH key authentication, disable password login

## Updating Worker

```bash
cd /opt/worker

# Pull latest code
git pull

# Install new dependencies
source venv/bin/activate
pip install -r requirements.txt

# Restart service
sudo systemctl restart queue-worker-<CLIENT_ID>
```

## Multi-Tenancy

Multiple client instances:

```bash
# Southhaven worker
CLIENT_ID=southhaven ./install-worker-service.sh southhaven /opt/worker

# Demo worker
CLIENT_ID=demo ./install-worker-service.sh demo /opt/worker

# Production worker
CLIENT_ID=production ./install-worker-service.sh production /opt/worker
```

Each worker uses its own queue:
- `southhaven-tasks`
- `demo-tasks`
- `production-tasks`

## Support

For issues:
1. Check logs: `sudo journalctl -u queue-worker-<CLIENT_ID> -n 50`
2. Verify environment variables
3. Test Azure connection manually
4. Check webhook endpoint accessibility
