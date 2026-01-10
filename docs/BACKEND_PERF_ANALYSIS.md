# Backend Container Performance Analysis

**Analysis Date:** 2025-01-09
**System:** FastAPI + Celery + Supabase LangChain Agent System
**Goal:** Production-ready optimization of backend container

---

## Executive Summary

This document provides a comprehensive analysis of the backend container's performance characteristics and provides actionable recommendations for production deployment. The analysis covers Docker configuration, FastAPI/Uvicorn settings, Celery worker optimization, database connection pooling, memory management, and observability.

**Key Findings:**
- Single-stage Docker build with unnecessary development dependencies
- No resource limits on main backend service (worker has 2GB limit)
- Basic Uvicorn configuration without worker process optimization
- Celery worker using default settings with hardcoded concurrency
- No connection pooling or retry logic for Supabase operations
- Missing production-specific configurations (health checks, logging, metrics)
- Testing dependencies included in production image

**Estimated Impact:**
- **High-Impact Changes:** 30-50% reduction in container size, 20-30% faster startup times
- **Medium-Impact Changes:** 15-25% improved throughput, better resource utilization
- **Long-Term Architectural:** 50%+ reduction in memory footprint for large-scale deployments

---

## 1. Current State Assessment

### 1.1 Dockerfile Configuration

**Location:** `backend/Dockerfile`

**Current Implementation:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip

# PyTorch CPU-only installation
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Preload models
RUN python preload_models.py

EXPOSE 8000

CMD ["uvicorn", "backend_app:app", "--host", "0.0.0.0", "--port", "8000", "--loop", "asyncio"]
```

**Issues Identified:**
1. **Single-stage build** - Development and runtime dependencies combined in final image
2. **No multi-stage optimization** - Build tools (build-essential) remain in final image
3. **Testing dependencies in production** - pytest, pytest-asyncio, pytest-mock, pytest-cov installed
4. **No health check** - Dockerfile lacks HEALTHCHECK directive
5. **No production environment optimization** - Python interpreter optimizations not enabled
6. **Large final image size** - Estimated 2-3GB with all dependencies included

**Positive Aspects:**
- ✓ Using `python:3.11-slim` (good choice over alpine for C-extension compatibility)
- ✓ Using `--no-cache-dir` for pip installations
- ✓ Cleaning apt lists to reduce layer size
- ✓ PyTorch CPU-only installation (appropriate for workload)
- ✓ Model preloading during build time

### 1.2 Docker Compose Configuration

**Main Backend Service** (`docker-compose.yml`):
```yaml
backend:
  build: ./backend
  ports:
    - "${BACKEND_PORT}:8000"
  command: ["uvicorn", "backend_app:app", "--host", "0.0.0.0", "--port", "8000", "--loop", "asyncio"]
  environment:
    # 28 environment variables (all production and sensitive)
    # ...
  networks:
    - web
```

**Issues Identified:**
1. **No resource limits** - No memory, CPU, or restart policies defined
2. **No health check** - Container health not monitored
3. **No resource reservations** - No guaranteed minimum resources
4. **Exposed sensitive data** - API keys and connection strings visible in docker-compose
5. **No restart policy** - Container won't auto-restart on failure
6. **Hardcoded command** - Uvicorn command not optimized for production

**Worker Service** (`docker-compose.worker.yml`):
```yaml
worker:
  build: ./backend
  command: celery -A async_tasks worker --loglevel=info --concurrency=4
  deploy:
    resources:
      limits:
        memory: 2G
  environment:
    # 18 environment variables
```

**Issues Identified:**
1. **Partial resource configuration** - Only memory limit, no CPU limits or reservations
2. **Hardcoded concurrency** - `--concurrency=4` not configurable via environment
3. **No health check** - Worker health not monitored
4. **No restart policy** - Worker won't auto-restart
5. **No task-specific optimization** - Same image as backend, no worker-specific optimizations
6. **Missing pool type** - Using default prefork pool (may not be optimal for I/O-heavy tasks)

### 1.3 FastAPI Configuration

**Location:** `backend/backend_app.py`

**Current Uvicorn Configuration:**
```python
# Command line: uvicorn backend_app:app --host 0.0.0.0 --port 8000 --loop asyncio
```

**Issues Identified:**
1. **Single worker process** - Defaults to 1 worker, underutilizing multi-core systems
2. **No worker class optimization** - Using default worker class
3. **No timeout configuration** - Default keep-alive timeout may be too short/long
4. **No connection limits** - Unlimited concurrent connections
5. **No backlog configuration** - Default backlog may be insufficient for high traffic
6. **No graceful shutdown timeout** - May interrupt in-flight requests
7. **No access logging** - Missing request/response logs for monitoring

**WebSocket Configuration:**
```python
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
```

**Issues Identified:**
1. **No connection limits** - Unlimited WebSocket connections
2. **No connection timeout** - Stale connections never cleaned up
3. **No rate limiting** - Broadcast to all connections without throttling
4. **No connection tracking** - No metadata about connections (IP, user, etc.)
5. **Broadcast inefficiency** - Broadcasting blocks on each send (sequential)

### 1.4 Celery Configuration

**Location:** `backend/async_tasks.py`

**Current Configuration:**
```python
app = Celery(
    "langchain_agent_sample",
    broker=config.CELERY_BROKER_URL,
    backend=config.CELERY_RESULT_BACKEND
)
app.conf.task_default_queue = config.CELERY_QUEUE_NAME
```

**Docker Compose Command:**
```bash
celery -A async_tasks worker --loglevel=info --concurrency=4
```

**Issues Identified:**
1. **Default worker settings** - No `prefetch_multiplier`, `task_time_limit`, or `worker_prefetch_multiplier`
2. **Hardcoded concurrency** - `--concurrency=4` not tuned for workload
3. **Default pool type** - Using prefork pool (not ideal for I/O-heavy tasks)
4. **No task routing** - All tasks go to same queue
5. **No result expiry** - Task results accumulate indefinitely
6. **No broker heartbeat** - May miss connection failures
7. **No task soft/hard timeout** - Tasks can run indefinitely
8. **No max retries** - Failed tasks retry indefinitely

**Task Implementation Issues:**
```python
@app.task
def ingest_docs_task(files_data):
    return asyncio.run(_ingest_docs_async(files_data, use_vlm=False))
```

1. **Blocking async in sync task** - Using `asyncio.run()` in Celery task (blocking)
2. **No task-specific timeout** - Long-running ingestion tasks can hang worker
3. **No progress reporting** - No visibility into task progress
4. **No error recovery** - Failed tasks don't retry with exponential backoff

### 1.5 Database & Connection Management

**Location:** `backend/services/supabase_service.py`

**Current Configuration:**
```python
class SupabaseService:
    def __init__(self):
        self.supabase_url = config.SUPABASE_URL
        self.supabase_key = config.SUPABASE_KEY
        self.client: Optional[Client] = None
        self._lock = threading.Lock()
        self._init_client()
```

**Issues Identified:**
1. **No connection pooling** - Single global client for all operations
2. **No timeout configuration** - Default HTTP timeout (unspecified)
3. **No retry logic** - Failed RPC calls fail immediately
4. **No connection health checks** - Stale connections not detected
5. **Synchronous operations** - All DB operations are blocking (even in async tasks)
6. **No query timeout** - Long-running queries can block indefinitely
7. **No connection limits** - Unlimited concurrent requests

**Vector DB Service** (`backend/services/vector_db.py`):
```python
async def search(self, query: str, limit: int = 10, document_set: str = None):
    if not self.supabase.is_available():
        return []

    embeddings = get_embeddings_model()
    try:
        query_vector = embeddings.embed_query(query)
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        return []
```

**Issues Identified:**
1. **No caching** - Embedding regenerated for every query (expensive)
2. **No connection pooling** - Each search creates new HTTP connection
3. **No batch processing** - Processing vectors one at a time
4. **No query optimization** - No index usage monitoring

### 1.6 Memory & Resource Management

**Current Patterns:**

**Docling Processing** (`backend/services/ingestion.py`):
```python
gc.collect()
return f"Indexed {filename} ({pipeline_type}): {len(chunks)} chunks."
```

**Positive Aspects:**
- ✓ Manual GC collection after VLM processing
- ✓ Cleanup of temp files
- ✓ Batch upsert with batch_size=64

**Issues Identified:**
1. **No memory limits** - Process can consume unlimited memory
2. **No OOM protection** - No checks before large operations
3. **No memory profiling** - No visibility into memory usage patterns
4. **VLM pipeline not singleton** - Pipeline recreated on every use (memory leak potential)
5. **Large batch sizes** - 64 chunks batch may be too large for memory-constrained environments
6. **No streaming** - Entire document loaded into memory before processing

**Ingestion Pipeline:**
```python
def _get_pipeline(self, use_vlm: bool):
    if use_vlm:
        if self._vlm_pipeline is None:
            self._vlm_pipeline = PipelineFactory.create_pipeline(use_vlm=True)
        return self._vlm_pipeline
```

**Issues Identified:**
1. **Standard pipeline singleton** - Good pattern for VLM, but standard pipeline also singleton
2. **No pipeline cleanup** - Pipelines never cleaned up, memory never released
3. **No resource limiting** - Multiple pipelines could be instantiated if code changes

### 1.7 Environment & Logging Configuration

**Location:** `backend/config.py`

**Current Configuration:**
```python
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
```

**Issues Identified:**
1. **No structured logging** - Logs not JSON-formatted for log aggregation
2. **No log levels configurable** - Hardcoded to INFO in multiple places
3. **No log rotation** - Logs can grow indefinitely
4. **No context in logs** - Missing request IDs, correlation IDs
5. **No performance metrics** - No timing information in logs
6. **No production/dev differentiation** - Same logging for all environments

**Environment Variables:**
- 30+ environment variables across docker-compose files
- No validation of required variables
- No sensible defaults for production
- Sensitive data visible in plain text

### 1.8 Dependency Analysis

**Location:** `backend/requirements.txt`

```
langchain-openai
pydantic-ai
nest_asyncio
celery
firebase-admin
python-dotenv
fastapi
uvicorn
langchain-text-splitters
watchdog
docling[vlm]
pypdfium2
pandas
xlrd
openpyxl
httpx
pytest
pytest-asyncio
pytest-mock
pytest-cov
litellm
supabase
azure-storage-blob>=12.20.0
```

**Issues Identified:**
1. **Development dependencies** - pytest, pytest-asyncio, pytest-mock, pytest-cov in production
2. **No version pinning** - Dependencies can drift between builds
3. **Large packages** - docling[vlm] includes heavy vision dependencies
4. **No dependency analysis** - Unused dependencies not identified
5. **No security scanning** - Vulnerable dependencies not monitored
6. **No split into production/dev** - Single requirements.txt for all environments

### 1.9 Observability & Monitoring

**Current State:**
- Basic logging to stdout
- No metrics collection (Prometheus, Datadog, etc.)
- No distributed tracing (OpenTelemetry, etc.)
- No health checks in Dockerfile
- No readiness probes
- No alerting on failures
- No performance monitoring

**Issues Identified:**
1. **No application metrics** - No visibility into throughput, latency, errors
2. **No business metrics** - No tracking of documents processed, queries served
3. **No system metrics** - No monitoring of CPU, memory, disk usage in container
4. **No alerting** - No notifications for failures or performance degradation
5. **No distributed tracing** - No ability to trace requests across services
6. **No health endpoints** - No /health endpoint (added but basic)

---

## 2. Performance Bottlenecks Identified

### 2.1 Container Build & Startup

**Bottleneck 1: Large Image Size (2-3GB)**
- **Impact:** Slower pulls, increased storage costs, longer deployment times
- **Evidence:** Single-stage build with build-essential and testing dependencies
- **Root Cause:** No multi-stage build, all dependencies in final image

**Bottleneck 2: Slow Startup (30-60s)**
- **Impact:** Longer auto-scaling times, slower recovery from failures
- **Evidence:** Model preloading in Dockerfile, no lazy loading
- **Root Cause:** All models loaded at startup, even if not immediately needed

**Bottleneck 3: No Health Checks**
- **Impact:** No graceful rollouts, failed containers not detected
- **Evidence:** No HEALTHCHECK in Dockerfile, no healthcheck in docker-compose
- **Root Cause:** Missing health monitoring configuration

### 2.2 FastAPI Performance

**Bottleneck 4: Single Worker Process**
- **Impact:** Underutilizes multi-core systems, limited concurrent request handling
- **Evidence:** Default uvicorn worker count of 1
- **Root Cause:** No worker process configuration
- **Estimated Impact:** 2-4x throughput improvement with 4 workers

**Bottleneck 5: Blocking Operations in Async Context**
- **Impact:** Event loop blocked, reduced concurrency
- **Evidence:** Supabase calls are synchronous in async endpoints
- **Root Cause:** No async Supabase client
- **Estimated Impact:** 30-50% latency reduction with async DB client

**Bottleneck 6: No Connection Limits**
- **Impact:** Memory exhaustion under high load, DoS vulnerability
- **Evidence:** Unlimited concurrent connections in uvicorn and WebSocket manager
- **Root Cause:** No configuration of connection limits
- **Estimated Impact:** Prevents OOM errors under load

### 2.3 Celery Worker Performance

**Bottleneck 7: Prefork Pool for I/O-Heavy Tasks**
- **Impact:** High memory usage, low concurrency for I/O-bound operations
- **Evidence:** Using default prefork pool with concurrency=4
- **Root Cause:** Wrong pool type for workload
- **Estimated Impact:** 3-5x task throughput with gevent/eventlet pool

**Bottleneck 8: No Task Time Limits**
- **Impact:** Hung workers, cascading failures
- **Evidence:** No task_time_limit or task_soft_time_limit
- **Root Cause:** Missing Celery configuration
- **Estimated Impact:** Prevents worker hangs, improves reliability

**Bottleneck 9: No Prefetch Multiplier Tuning**
- **Impact:** Unbalanced task distribution, memory inefficiency
- **Evidence:** Default prefetch_multiplier=4
- **Root Cause:** No workload-specific tuning
- **Estimated Impact:** 10-20% improvement in task distribution

### 2.4 Database & Vector Operations

**Bottleneck 10: No Connection Pooling**
- **Impact:** High latency, connection overhead, database exhaustion
- **Evidence:** Single global Supabase client, no pool configuration
- **Root Cause:** Missing connection pool implementation
- **Estimated Impact:** 40-60% reduction in DB latency with pooling

**Bottleneck 11: No Embedding Caching**
- **Impact:** Repeated expensive embedding generation
- **Evidence:** Each query generates new embedding
- **Root Cause:** No caching layer
- **Estimated Impact:** 70-90% latency reduction for repeated queries

**Bottleneck 12: Inefficient Document Listing**
- **Impact:** Slow document listing, excessive memory usage
- **Evidence:** Fetching up to 10,000 rows for distinct filenames
- **Root Cause:** No database-level distinct query
- **Estimated Impact:** 80-95% reduction in query time

### 2.5 Memory Management

**Bottleneck 13: Pipeline Memory Leaks**
- **Impact:** Memory growth over time, OOM errors
- **Evidence:** Pipelines held as singletons but never cleaned up
- **Root Cause:** No lifecycle management for heavy Docling pipelines
- **Estimated Impact:** 30-50% reduction in memory usage with proper cleanup

**Bottleneck 14: No Batch Size Optimization**
- **Impact:** Excessive memory usage during embeddings
- **Evidence:** Fixed batch_size=64, no dynamic sizing
- **Root Cause:** No memory-aware batch sizing
- **Estimated Impact:** 20-30% reduction in peak memory usage

### 2.6 WebSocket Performance

**Bottleneck 15: Sequential Broadcasting**
- **Impact:** Slow notifications, blocked event loop
- **Evidence:** Broadcasting loops through connections sequentially
- **Root Cause:** No async broadcasting or batching
- **Estimated Impact:** 3-5x faster notifications with concurrent sends

**Bottleneck 16: No Connection Timeout**
- **Impact:** Stale connections, memory leaks
- **Evidence:** No cleanup of inactive connections
- **Root Cause:** No connection tracking or timeout
- **Estimated Impact:** Prevents memory leaks from stale connections

### 2.7 Configuration & Deployment

**Bottleneck 17: No Resource Limits**
- **Impact:** Resource contention, no isolation
- **Evidence:** No memory/CPU limits on backend service
- **Root Cause:** Missing deploy configuration
- **Estimated Impact:** Prevents runaway resource usage

**Bottleneck 18: No Restart Policy**
- **Impact:** Manual recovery from failures
- **Evidence:** No restart policy in docker-compose
- **Root Cause:** Missing container lifecycle configuration
- **Estimated Impact:** Automatic recovery from failures

---

## 3. Optimization Recommendations

### 3.1 Dockerfile Optimization (High Impact, Low Effort)

**Recommendation 1: Implement Multi-Stage Build**

**Location:** `backend/Dockerfile`

**Change:**
```dockerfile
# Builder stage - includes build tools and dev dependencies
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Install PyTorch CPU-only
RUN pip install --no-cache-dir torch torchvision \
    --index-url https://download.pytorch.org/whl/cpu

# Copy requirements and install all dependencies (including dev)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Preload models in builder stage
RUN python preload_models.py

# Production stage - minimal runtime image
FROM python:3.11-slim AS production

WORKDIR /app

# Install only runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Install PyTorch CPU-only (no build tools needed)
RUN pip install --no-cache-dir torch torchvision \
    --index-url https://download.pytorch.org/whl/cpu

# Copy only production dependencies (exclude test dependencies)
COPY requirements.txt .
RUN pip install --no-cache-dir -r <(grep -v "pytest\|pytest-asyncio\|pytest-mock\|pytest-cov" requirements.txt)

# Copy application code and preloaded models from builder
COPY --from=builder /app /app

# Create non-root user for security
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

# Production-optimized uvicorn command
CMD ["uvicorn", "backend_app:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--loop", "uvloop", \
     "--timeout-keep-alive", "5", \
     "--limit-concurrency", "1000", \
     "--backlog", "2048", \
     "--access-log", \
     "--log-level", "info"]
```

**Benefits:**
- 30-40% reduction in image size (estimated 1.5-2GB final)
- Faster deployment times
- Smaller attack surface (no build tools)
- Security improvement (non-root user)

**Effort:** Low
**Risk:** Low

---

**Recommendation 2: Split Requirements into Production and Development**

**Location:** Create `backend/requirements-dev.txt`

**Change:**
```bash
# requirements-prod.txt (production dependencies only)
langchain-openai
pydantic-ai
nest_asyncio
celery
firebase-admin
python-dotenv
fastapi
uvicorn[standard]  # Include uvloop
langchain-text-splitters
watchdog
docling[vlm]
pypdfium2
pandas
xlrd
openpyxl
httpx
litellm
supabase
azure-storage-blob>=12.20.0

# requirements-dev.txt (development dependencies)
-r requirements-prod.txt
pytest
pytest-asyncio
pytest-mock
pytest-cov
black
ruff
mypy
```

**Updated Dockerfile:**
```dockerfile
# In production stage
COPY requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt
```

**Benefits:**
- Smaller production image
- Clear dependency separation
- Faster pip install in production

**Effort:** Low
**Risk:** Low

---

### 3.2 FastAPI/Uvicorn Configuration (High Impact, Low Effort)

**Recommendation 3: Configure Multiple Worker Processes**

**Location:** `backend/Dockerfile` (CMD) and `docker-compose.yml`

**Change in Dockerfile:**
```dockerfile
CMD ["uvicorn", "backend_app:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "${UVICORN_WORKERS:-4}", \
     "--loop", "uvloop", \
     "--timeout-keep-alive", "5", \
     "--limit-concurrency", "${UVICORN_MAX_CONNECTIONS:-1000}", \
     "--backlog", "2048", \
     "--access-log", \
     "--log-level", "${UVICORN_LOG_LEVEL:-info}"]
```

**Change in docker-compose.yml:**
```yaml
backend:
  build: ./backend
  ports:
    - "${BACKEND_PORT:-8000}:8000"
  environment:
    UVICORN_WORKERS: ${UVICORN_WORKERS:-4}
    UVICORN_MAX_CONNECTIONS: ${UVICORN_MAX_CONNECTIONS:-1000}
    UVICORN_LOG_LEVEL: ${UVICORN_LOG_LEVEL:-info}
```

**Benefits:**
- 2-4x throughput improvement
- Better CPU utilization
- Improved resilience to failures

**Effort:** Low
**Risk:** Low

**Rationale:**
- Workers = number of CPU cores (or 2x CPU cores for I/O-heavy workloads)
- uvloop is faster than default asyncio
- Limit connections to prevent OOM
- Keep-alive timeout of 5s is optimal for web APIs

---

**Recommendation 4: Add Async Supabase Client**

**Location:** Create `backend/services/async_supabase_service.py`

**New File:**
```python
import logging
from typing import Any, Optional

import httpx
from supabase import create_async_client

import config

logger = logging.getLogger(__name__)


class AsyncSupabaseService:
    """
    Async Supabase client for better performance in async contexts.
    """

    def __init__(self):
        self.supabase_url = config.SUPABASE_URL
        self.supabase_key = config.SUPABASE_KEY
        self.client: Optional[Any] = None
        self._initialized = False

    async def _ensure_client(self):
        """Lazy initialization of async client."""
        if not self._initialized:
            if self.supabase_url and self.supabase_key:
                try:
                    # Create async client with connection pool
                    self.client = await create_async_client(
                        self.supabase_url,
                        self.supabase_key,
                        timeout=httpx.Timeout(
                            connect=5.0,
                            read=30.0,
                            write=5.0,
                            pool=5.0,
                        ),
                    )
                    self._initialized = True
                    logger.info("Initialized async Supabase client.")
                except Exception as e:
                    logger.error(f"Failed to initialize async Supabase client: {e}")
                    raise
            else:
                logger.warning("SUPABASE_URL or SUPABASE_KEY not set.")

    async def rpc(self, function_name: str, params: dict[str, Any]) -> Any:
        """Execute RPC call asynchronously."""
        await self._ensure_client()
        try:
            return await self.client.rpc(function_name, params).execute()
        except Exception as e:
            logger.error(f"RPC {function_name} failed: {e}")
            raise

    async def upsert(self, table: str, data: list[dict[str, Any]]) -> Any:
        """Upsert records asynchronously."""
        await self._ensure_client()
        try:
            return await self.client.table(table).upsert(data).execute()
        except Exception as e:
            logger.error(f"Upsert to {table} failed: {e}")
            raise

    async def delete(self, table: str, filters: dict[str, Any]) -> Any:
        """Delete records asynchronously."""
        await self._ensure_client()
        try:
            query = self.client.table(table).delete()
            for col, val in filters.items():
                query = query.eq(col, val)
            return await query.execute()
        except Exception as e:
            logger.error(f"Delete from {table} failed: {e}")
            raise

    async def select(
        self,
        table: str,
        columns: str = "*",
        range_start: int = None,
        range_end: int = None,
    ) -> Any:
        """Select records asynchronously."""
        await self._ensure_client()
        try:
            query = self.client.table(table).select(columns)
            if range_start is not None and range_end is not None:
                query = query.range(range_start, range_end)
            return await query.execute()
        except Exception as e:
            logger.error(f"Select from {table} failed: {e}")
            raise

    async def close(self):
        """Close the async client."""
        if self.client:
            try:
                await self.client.close()
                logger.info("Closed async Supabase client.")
            except Exception as e:
                logger.warning(f"Error closing async Supabase client: {e}")
            finally:
                self.client = None
                self._initialized = False


# Global instance
async_supabase_service = AsyncSupabaseService()
```

**Update `backend/services/vector_db.py`:**
```python
# Add import
from services.async_supabase_service import async_supabase_service

# Update search method
async def search(self, query: str, limit: int = 10, document_set: str = None):
    if not async_supabase_service._initialized:
        await async_supabase_service._ensure_client()

    # ... rest of implementation with async_supabase_service
```

**Benefits:**
- 30-50% latency reduction for DB operations
- Better event loop utilization
- Connection pooling with httpx

**Effort:** Medium
**Risk:** Medium (requires testing with async client)

---

**Recommendation 5: Add Embedding Cache**

**Location:** Create `backend/services/cache_service.py`

**New File:**
```python
import logging
from typing import Optional

import hashlib
import json

logger = logging.getLogger(__name__)


class EmbeddingCache:
    """Simple in-memory cache for embeddings to avoid recomputation."""

    def __init__(self, max_size: int = 1000):
        self.cache: dict[str, list[float]] = {}
        self.max_size = max_size
        self.hits = 0
        self.misses = 0

    def _get_key(self, text: str) -> str:
        """Generate cache key from text."""
        return hashlib.md5(text.encode()).hexdigest()

    def get(self, text: str) -> Optional[list[float]]:
        """Get embedding from cache."""
        key = self._get_key(text)
        if key in self.cache:
            self.hits += 1
            return self.cache[key]
        self.misses += 1
        return None

    def set(self, text: str, embedding: list[float]):
        """Store embedding in cache."""
        key = self._get_key(text)
        self.cache[key] = embedding

        # Evict oldest if over limit
        if len(self.cache) > self.max_size:
            oldest_key = next(iter(self.cache))
            del self.cache[oldest_key]

    def get_stats(self) -> dict[str, int]:
        """Get cache statistics."""
        return {
            "size": len(self.cache),
            "max_size": self.max_size,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": self.hits / (self.hits + self.misses) if (self.hits + self.misses) > 0 else 0.0,
        }


# Global instance
embedding_cache = EmbeddingCache(max_size=1000)
```

**Update `backend/services/vector_db.py`:**
```python
# Add import
from services.cache_service import embedding_cache

# Update search method
async def search(self, query: str, limit: int = 10, document_set: str = None):
    if not self.supabase.is_available():
        return []

    # Check cache first
    cached_embedding = embedding_cache.get(query)
    if cached_embedding:
        query_vector = cached_embedding
    else:
        embeddings = get_embeddings_model()
        try:
            query_vector = embeddings.embed_query(query)
            # Cache the result
            embedding_cache.set(query, query_vector)
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            return []

    # ... rest of implementation
```

**Benefits:**
- 70-90% latency reduction for repeated queries
- Reduced load on embedding service
- Better user experience for common queries

**Effort:** Low
**Risk:** Low

---

### 3.3 Celery Configuration (High Impact, Medium Effort)

**Recommendation 6: Configure Gevent Pool for I/O-Heavy Tasks**

**Location:** `backend/config.py` and `docker-compose.worker.yml`

**Add to `backend/config.py`:**
```python
# Celery Configuration
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", f"amqp://guest:guest@{BASE_URL}:5672//")
CELERY_RESULT_BACKEND = "rpc://"
CELERY_QUEUE_NAME = os.getenv("CELERY_QUEUE_NAME") or "celery"

# Celery Performance Settings
CELERY_WORKER_CONCURRENCY = int(os.getenv("CELERY_WORKER_CONCURRENCY", "100"))  # High for gevent
CELERY_WORKER_POOL = os.getenv("CELERY_WORKER_POOL", "gevent")  # gevent for I/O-heavy tasks
CELERY_PREFETCH_MULTIPLIER = int(os.getenv("CELERY_PREFETCH_MULTIPLIER", "1"))  # Low for gevent
CELERY_TASK_TIME_LIMIT = int(os.getenv("CELERY_TASK_TIME_LIMIT", "3600"))  # 1 hour
CELERY_TASK_SOFT_TIME_LIMIT = int(os.getenv("CELERY_TASK_SOFT_TIME_LIMIT", "3300"))  # 55 min
CELERY_BROKER_HEARTBEAT = int(os.getenv("CELERY_BROKER_HEARTBEAT", "10"))  # 10 seconds
CELERY_TASK_ACKS_LATE = os.getenv("CELERY_TASK_ACKS_LATE", "true").lower() == "true"
CELERY_WORKER_PREFETCH_MULTIPLIER = int(os.getenv("CELERY_WORKER_PREFETCH_MULTIPLIER", "4"))
```

**Update `backend/async_tasks.py`:**
```python
# Initialize Celery with performance settings
app = Celery(
    "langchain_agent_sample",
    broker=config.CELERY_BROKER_URL,
    backend=config.CELERY_RESULT_BACKEND,
)

# Configure worker settings
app.conf.update(
    task_default_queue=config.CELERY_QUEUE_NAME,
    worker_concurrency=config.CELERY_WORKER_CONCURRENCY,
    worker_pool=config.CELERY_WORKER_POOL,
    task_acks_late=config.CELERY_TASK_ACKS_LATE,
    task_reject_on_worker_lost=True,
    broker_heartbeat=config.CELERY_BROKER_HEARTBEAT,
    worker_prefetch_multiplier=config.CELERY_PREFETCH_MULTIPLIER,
    task_time_limit=config.CELERY_TASK_TIME_LIMIT,
    task_soft_time_limit=config.CELERY_TASK_SOFT_TIME_LIMIT,
    result_expires=3600,  # Expire results after 1 hour
    task_track_started=True,  # Track task start time
    task_send_sent_event=True,  # Send task-sent events
)
```

**Update `docker-compose.worker.yml`:**
```yaml
worker:
  build: ./backend
  command: celery -A async_tasks worker \
    --loglevel=info \
    --concurrency=${CELERY_WORKER_CONCURRENCY:-100} \
    --pool=${CELERY_WORKER_POOL:-gevent} \
    --prefetch-multiplier=${CELERY_PREFETCH_MULTIPLIER:-1}
  environment:
    CELERY_WORKER_CONCURRENCY: ${CELERY_WORKER_CONCURRENCY:-100}
    CELERY_WORKER_POOL: ${CELERY_WORKER_POOL:-gevent}
    CELERY_PREFETCH_MULTIPLIER: ${CELERY_PREFETCH_MULTIPLIER:-1}
    CELERY_TASK_TIME_LIMIT: ${CELERY_TASK_TIME_LIMIT:-3600}
    CELERY_TASK_SOFT_TIME_LIMIT: ${CELERY_TASK_SOFT_TIME_LIMIT:-3300}
    CELERY_BROKER_HEARTBEAT: ${CELERY_BROKER_HEARTBEAT:-10}
    CELERY_TASK_ACKS_LATE: ${CELERY_TASK_ACKS_LATE:-true}
  deploy:
    resources:
      limits:
        memory: 2G
        cpus: "1.0"
      reservations:
        memory: 512M
        cpus: "0.5"
  healthcheck:
    test: ["CMD", "celery", "-A", "async_tasks", "inspect", "ping"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
  restart: unless-stopped
```

**Benefits:**
- 3-5x task throughput improvement
- Better memory efficiency
- Improved task distribution
- Protection against hung tasks
- Automatic restart on failures

**Effort:** Medium
**Risk:** Medium (requires testing with gevent)

**Rationale:**
- **Gevent pool**: Ideal for I/O-heavy tasks (HTTP requests, DB calls)
- **High concurrency (100)**: Gevent is lightweight, can handle many concurrent tasks
- **Prefetch_multiplier=1**: For gevent, low prefetch prevents task hoarding
- **Time limits**: Prevent hung tasks from blocking workers
- **Late acks**: Only ack after task completes (better reliability)

---

**Recommendation 7: Implement Task-Specific Queues**

**Location:** `backend/config.py` and `backend/async_tasks.py`

**Add to `backend/config.py`:**
```python
# Task-specific queues
CELERY_QUEUE_INGEST = os.getenv("CELERY_QUEUE_INGEST", "ingestion")
CELERY_QUEUE_SUMMARY = os.getenv("CELERY_QUEUE_SUMMARY", "summary")
CELERY_QUEUE_DEFAULT = os.getenv("CELERY_QUEUE_DEFAULT", "celery")
```

**Update `backend/async_tasks.py`:**
```python
# Configure task queues
app.conf.task_queues = [
    {
        "name": config.CELERY_QUEUE_INGEST,
        "routing_key": "ingestion",
    },
    {
        "name": config.CELERY_QUEUE_SUMMARY,
        "routing_key": "summary",
    },
    {
        "name": config.CELERY_QUEUE_DEFAULT,
        "routing_key": "default",
    },
]

app.conf.task_default_queue = config.CELERY_QUEUE_DEFAULT
app.conf.task_default_routing_key = "default"

# Route tasks to specific queues
app.conf.task_routes = {
    "async_tasks.ingest_docs_task": {"queue": config.CELERY_QUEUE_INGEST, "routing_key": "ingestion"},
    "async_tasks.ingest_docs_vlm_task": {"queue": config.CELERY_QUEUE_INGEST, "routing_key": "ingestion"},
    "async_tasks.summarize_document_task": {"queue": config.CELERY_QUEUE_SUMMARY, "routing_key": "summary"},
    "async_tasks.check_knowledge_base": {"queue": config.CELERY_QUEUE_DEFAULT, "routing_key": "default"},
    "async_tasks.answer_question": {"queue": config.CELERY_QUEUE_DEFAULT, "routing_key": "default"},
}
```

**Create separate worker configuration in `docker-compose.worker-ingestion.yml`:**
```yaml
services:
  worker-ingestion:
    build: ./backend
    command: celery -A async_tasks worker \
      --loglevel=info \
      --concurrency=50 \
      --pool=gevent \
      --queues=ingestion
    environment:
      CELERY_BROKER_URL: ${CELERY_BROKER_URL}
      # ... other env vars
    deploy:
      resources:
        limits:
          memory: 4G  # More memory for ingestion
          cpus: "2.0"
        reservations:
          memory: 1G
          cpus: "1.0"
    healthcheck:
      test: ["CMD", "celery", "-A", "async_tasks", "inspect", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
    networks:
      - web
```

**Benefits:**
- Isolate resource-intensive ingestion tasks
- Scale workers independently
- Prevent ingestion from blocking other tasks
- Better resource allocation

**Effort:** Medium
**Risk:** Medium (requires separate worker management)

---

### 3.4 Database Optimization (Medium Impact, Medium Effort)

**Recommendation 8: Optimize Document Listing Query**

**Location:** `backend/services/vector_db.py`

**Current Implementation:**
```python
async def get_distinct_filenames(self) -> list[dict[str, Any]]:
    """Get distinct filenames with their document_set and a sample chunk count."""
    if not self.supabase.is_available():
        return []

    try:
        # Get all distinct filename and document_set combinations
        response = self.supabase.select(
            self.table_name,
            columns="filename, document_set",
            range_start=0,
            range_end=9999,  # Large range to get all unique files
        )

        rows = response.data
        logger.info(f"Retrieved {len(rows)} rows for filename grouping")

        # Group by filename to count chunks
        file_groups = {}
        for row in rows:
            filename = row.get("filename")
            document_set = row.get("document_set", "all")

            if filename:
                if filename not in file_groups:
                    file_groups[filename] = {
                        "filename": filename,
                        "document_set": document_set,
                        "chunk_count": 0,
                    }
                file_groups[filename]["chunk_count"] += 1

        result = list(file_groups.values())
        logger.info(f"Found {len(result)} distinct filenames")
        return result
    except Exception as e:
        logger.error(f"Get distinct filenames failed: {e}")
        return []
```

**Optimized Implementation:**
```python
async def get_distinct_filenames(self) -> list[dict[str, Any]]:
    """
    Get distinct filenames with their document_set and chunk count.
    Uses database aggregation for efficiency.
    """
    if not self.supabase.is_available():
        return []

    try:
        # Use SQL aggregation via RPC for efficiency
        params = {
            "limit": 10000,  # Reasonable limit
        }

        # Call optimized RPC function (needs to be created in Supabase)
        response = self.supabase.rpc("get_distinct_filenames_with_counts", params)
        rows = response.data

        logger.info(f"Retrieved {len(rows)} distinct filenames")
        return rows
    except Exception as e:
        logger.error(f"Get distinct filenames failed: {e}")
        return []
```

**Supabase SQL Function to Create:**
```sql
-- Create optimized function for distinct filenames with counts
CREATE OR REPLACE FUNCTION get_distinct_filenames_with_counts(limit_param int DEFAULT 10000)
RETURNS TABLE (
    filename text,
    document_set text,
    chunk_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        filename,
        document_set,
        COUNT(*) as chunk_count
    FROM documents
    GROUP BY filename, document_set
    ORDER BY filename
    LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;
```

**Benefits:**
- 80-95% reduction in query time
- 90-99% reduction in data transfer
- Reduced memory usage
- Better scalability

**Effort:** Low (SQL function) + Medium (code change)
**Risk:** Low

---

**Recommendation 9: Add Connection Pool Configuration**

**Location:** Update `backend/services/supabase_service.py`

**Add timeout configuration:**
```python
import httpx

# In __init__ method
def __init__(self):
    self.supabase_url = config.SUPABASE_URL
    self.supabase_key = config.SUPABASE_KEY
    self.client: Optional[Client] = None
    self._lock = threading.Lock()
    self._timeout = httpx.Timeout(
        connect=float(os.getenv("SUPABASE_CONNECT_TIMEOUT", "5.0")),
        read=float(os.getenv("SUPABASE_READ_TIMEOUT", "30.0")),
        write=float(os.getenv("SUPABASE_WRITE_TIMEOUT", "5.0")),
        pool=float(os.getenv("SUPABASE_POOL_TIMEOUT", "5.0")),
    )
    self._init_client()
```

**Update `_init_client` method:**
```python
def _init_client(self):
    """Initialize Supabase client with connection pool."""
    if self.supabase_url and self.supabase_key:
        with self._lock:
            if self.client is None:
                try:
                    # Create httpx client with connection pool
                    import httpx

                    http_client = httpx.Client(
                        timeout=self._timeout,
                        limits=httpx.Limits(
                            max_connections=int(os.getenv("SUPABASE_MAX_CONNECTIONS", "100")),
                            max_keepalive_connections=int(os.getenv("SUPABASE_MAX_KEEPALIVE", "20")),
                        ),
                    )

                    self.client = create_client(
                        self.supabase_url,
                        self.supabase_key,
                        client=http_client,  # Use custom httpx client
                    )
                    logger.info("Initialized Supabase REST client with connection pool.")
                except Exception as e:
                    logger.error(f"Failed to initialize Supabase client: {e}")
                    self.client = None
    else:
        logger.warning("SUPABASE_URL or SUPABASE_KEY not set.")
```

**Add environment variables to `docker-compose.yml`:**
```yaml
environment:
  SUPABASE_CONNECT_TIMEOUT: ${SUPABASE_CONNECT_TIMEOUT:-5.0}
  SUPABASE_READ_TIMEOUT: ${SUPABASE_READ_TIMEOUT:-30.0}
  SUPABASE_WRITE_TIMEOUT: ${SUPABASE_WRITE_TIMEOUT:-5.0}
  SUPABASE_POOL_TIMEOUT: ${SUPABASE_POOL_TIMEOUT:-5.0}
  SUPABASE_MAX_CONNECTIONS: ${SUPABASE_MAX_CONNECTIONS:-100}
  SUPABASE_MAX_KEEPALIVE: ${SUPABASE_MAX_KEEPALIVE:-20}
```

**Benefits:**
- 40-60% reduction in connection overhead
- Better resource utilization
- Protection against connection exhaustion
- Configurable timeout behavior

**Effort:** Medium
**Risk:** Low

---

### 3.5 Memory Optimization (Medium Impact, Medium Effort)

**Recommendation 10: Add Dynamic Batch Size Calculation**

**Location:** `backend/services/ingestion.py`

**Add batch size calculation:**
```python
import psutil  # Add to requirements.txt

class IngestionService:
    def __init__(self):
        self.splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        self._standard_pipeline = None
        self._vlm_pipeline = None
        self._calculate_optimal_batch_size()

    def _calculate_optimal_batch_size(self):
        """Calculate optimal batch size based on available memory."""
        try:
            mem = psutil.virtual_memory()
            available_mb = mem.available / (1024 * 1024)

            # Estimate: each embedding ~1KB, each chunk ~1KB
            # Leave 500MB buffer for system
            usable_memory = max(available_mb - 500, 512)  # Min 512MB
            self.optimal_batch_size = int(usable_memory / 2)  # Conservative estimate

            # Clamp to reasonable range
            self.optimal_batch_size = max(16, min(self.optimal_batch_size, 128))

            logger.info(f"Calculated optimal batch size: {self.optimal_batch_size} "
                       f"(available memory: {available_mb:.0f}MB)")
        except Exception as e:
            logger.warning(f"Failed to calculate batch size, using default: {e}")
            self.optimal_batch_size = 64
```

**Update `_process_content_flow` method:**
```python
batch_size = self.optimal_batch_size
for i in range(0, len(points), batch_size):
    try:
        batch_points = points[i : i + batch_size]
        await db_service.upsert_vectors(batch_points)
    except Exception as e:
        return f"Upsert failed for batch {i}: {e}"
```

**Add to `requirements-prod.txt`:**
```
psutil>=5.9.0
```

**Benefits:**
- 20-30% reduction in peak memory usage
- Better performance on memory-constrained systems
- Prevents OOM errors
- Automatic adjustment to system resources

**Effort:** Low
**Risk:** Low

---

**Recommendation 11: Add Pipeline Cleanup**

**Location:** `backend/services/ingestion.py`

**Add cleanup method:**
```python
class IngestionService:
    # ... existing code ...

    def cleanup_pipelines(self):
        """Explicitly clean up pipeline resources to free memory."""
        try:
            if self._standard_pipeline:
                logger.info("Cleaning up standard pipeline...")
                self._standard_pipeline = None

            if self._vlm_pipeline:
                logger.info("Cleaning up VLM pipeline...")
                self._vlm_pipeline = None

            # Force garbage collection
            gc.collect()
            logger.info("Pipeline cleanup complete.")
        except Exception as e:
            logger.error(f"Error during pipeline cleanup: {e}")

    async def _process_content_flow(self, ...):
        # ... existing code ...
        try:
            # ... processing code ...
        finally:
            # Cleanup pipelines periodically to free memory
            import random
            if random.random() < 0.1:  # 10% chance to cleanup
                self.cleanup_pipelines()
```

**Add periodic cleanup in `backend/backend_app.py`:**
```python
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up...")
    init_db()
    init_firebase()

    # Start periodic cleanup task
    cleanup_task = asyncio.create_task(periodic_cleanup())

    # ... rest of startup code ...

    yield

    # Shutdown
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass

    # ... rest of shutdown code ...


async def periodic_cleanup():
    """Periodically clean up resources."""
    from services.ingestion import ingestion_service

    while True:
        await asyncio.sleep(300)  # Every 5 minutes
        try:
            ingestion_service.cleanup_pipelines()
        except Exception as e:
            logger.error(f"Error in periodic cleanup: {e}")
```

**Benefits:**
- 30-50% reduction in long-term memory usage
- Prevents memory leaks
- Better resource management
- Improved stability over long periods

**Effort:** Low
**Risk:** Low

---

### 3.6 WebSocket Optimization (Low Impact, Low Effort)

**Recommendation 12: Add Concurrent Broadcasting**

**Location:** `backend/services/websocket.py`

**Update `ConnectionManager`:**
```python
import asyncio
import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.max_connections = int(os.getenv("WEBSOCKET_MAX_CONNECTIONS", "100"))
        self.connection_timeout = int(os.getenv("WEBSOCKET_CONNECTION_TIMEOUT", "3600"))  # 1 hour

    async def connect(self, websocket: WebSocket):
        """Connect new WebSocket with limits."""
        if len(self.active_connections) >= self.max_connections:
            logger.warning(f"Connection rejected: max connections ({self.max_connections}) reached")
            await websocket.close(code=1008, reason="Server capacity limit reached")
            return False

        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(
            f"WebSocket client connected. Active connections: {len(self.active_connections)}"
        )
        return True

    def disconnect(self, websocket: WebSocket):
        """Disconnect WebSocket."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(
                f"WebSocket client disconnected. Active connections: {len(self.active_connections)}"
            )

    async def broadcast(self, message: dict):
        """Broadcast message concurrently to all connections."""
        if not self.active_connections:
            return

        logger.info(f"Broadcasting message to {len(self.active_connections)} clients: {message}")

        # Send concurrently using asyncio.gather
        tasks = [
            self._send_to_connection(connection, message)
            for connection in self.active_connections
        ]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _send_to_connection(self, connection: WebSocket, message: dict):
        """Send message to a single connection with error handling."""
        try:
            await asyncio.wait_for(
                connection.send_json(message),
                timeout=5.0  # 5 second timeout per send
            )
        except asyncio.TimeoutError:
            logger.warning("WebSocket send timeout, disconnecting client")
            self.disconnect(connection)
        except Exception as e:
            logger.error(f"Error broadcasting to socket: {e}")
            self.disconnect(connection)

    async def cleanup_stale_connections(self):
        """Remove stale connections."""
        # This would require tracking connection timestamps
        # Implementation depends on your requirements
        pass


# Global instance
manager = ConnectionManager()
```

**Add environment variables to `docker-compose.yml`:**
```yaml
environment:
  WEBSOCKET_MAX_CONNECTIONS: ${WEBSOCKET_MAX_CONNECTIONS:-100}
  WEBSOCKET_CONNECTION_TIMEOUT: ${WEBSOCKET_CONNECTION_TIMEOUT:-3600}
```

**Benefits:**
- 3-5x faster notifications
- Connection limits prevent OOM
- Better error handling
- Cleaner disconnection logic

**Effort:** Low
**Risk:** Low

---

### 3.7 Docker Compose Configuration (High Impact, Low Effort)

**Recommendation 13: Add Resource Limits and Health Checks**

**Location:** `docker-compose.yml`

**Updated Configuration:**
```yaml
services:
  backend:
    build: ./backend
    ports:
      - "${BACKEND_PORT:-8000}:8000"
    command: ["uvicorn", "backend_app:app", "--host", "0.0.0.0", "--port", "8000"]
    environment:
      BASE_URL: ${BASE_URL:-192.168.5.204}
      CELERY_BROKER_URL: ${CELERY_BROKER_URL:-amqp://guest:guest@${BASE_URL}:5672//}  # pragma: allowlist secret
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      OPENAI_API_BASE: ${OPENAI_API_BASE}
      OPENAI_MODEL: ${OPENAI_MODEL}
      OPENAI_EMBEDDING_MODEL: ${OPENAI_EMBEDDING_MODEL}
      OPENAI_EMBEDDING_DIMENSIONS: ${OPENAI_EMBEDDING_DIMENSIONS}
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_KEY: ${SUPABASE_KEY}
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS:-https://aidocs.ethanturk.com,http://localhost:3000,http://localhost:3001}

      # Uvicorn Configuration
      UVICORN_WORKERS: ${UVICORN_WORKERS:-4}
      UVICORN_MAX_CONNECTIONS: ${UVICORN_MAX_CONNECTIONS:-1000}
      UVICORN_LOG_LEVEL: ${UVICORN_LOG_LEVEL:-info}

      # Supabase Configuration
      SUPABASE_CONNECT_TIMEOUT: ${SUPABASE_CONNECT_TIMEOUT:-5.0}
      SUPABASE_READ_TIMEOUT: ${SUPABASE_READ_TIMEOUT:-30.0}
      SUPABASE_WRITE_TIMEOUT: ${SUPABASE_WRITE_TIMEOUT:-5.0}
      SUPABASE_MAX_CONNECTIONS: ${SUPABASE_MAX_CONNECTIONS:-100}
      SUPABASE_MAX_KEEPALIVE: ${SUPABASE_MAX_KEEPALIVE:-20}

      # WebSocket Configuration
      WEBSOCKET_MAX_CONNECTIONS: ${WEBSOCKET_MAX_CONNECTIONS:-100}
      WEBSOCKET_CONNECTION_TIMEOUT: ${WEBSOCKET_CONNECTION_TIMEOUT:-3600}

      # Logging Configuration
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
      LOG_FORMAT: ${LOG_FORMAT:-json}  # json or text

    # Resource limits tuned for FastAPI backend
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: "2.0"
        reservations:
          memory: 512M
          cpus: "0.5"

    # Health check to detect when server stops responding
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

    # Restart policy to recover from crashes
    restart: unless-stopped

    networks:
      - web
```

**Benefits:**
- Prevents resource exhaustion
- Automatic recovery from failures
- Better monitoring
- Improved stability

**Effort:** Low
**Risk:** Low

---

**Recommendation 14: Separate Configuration Files for Environments**

**Location:** Create `docker-compose.prod.yml`

**New File:**
```yaml
services:
  backend:
    environment:
      # Production-specific settings
      UVICORN_WORKERS: "8"
      UVICORN_LOG_LEVEL: "warning"
      LOG_LEVEL: "WARNING"

    deploy:
      resources:
        limits:
          memory: 4G
          cpus: "4.0"
        reservations:
          memory: 1G
          cpus: "1.0"

    restart: always

  worker:
    environment:
      # Production-specific settings
      CELERY_WORKER_CONCURRENCY: "200"
      CELERY_WORKER_POOL: "gevent"
      CELERY_PREFETCH_MULTIPLIER: "1"

    deploy:
      resources:
        limits:
          memory: 4G
          cpus: "2.0"
        reservations:
          memory: 1G
          cpus: "1.0"

    restart: always
```

**Usage:**
```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**Benefits:**
- Environment-specific configurations
- Better production settings
- Easy to manage multiple environments

**Effort:** Low
**Risk:** Low

---

### 3.8 Logging & Observability (Medium Impact, Medium Effort)

**Recommendation 15: Implement Structured Logging**

**Location:** Create `backend/logging_config.py`

**New File:**
```python
import json
import logging
import os
import sys
from typing import Any, Dict
from datetime import datetime

import config


class JSONFormatter(logging.Formatter):
    """Structured JSON log formatter for production environments."""

    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Add request context if available (set by middleware)
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        if hasattr(record, "user_id"):
            log_data["user_id"] = record.user_id

        return json.dumps(log_data)


def setup_logging():
    """Configure structured logging based on environment."""
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    log_format = os.getenv("LOG_FORMAT", "text")  # "json" or "text"

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Remove default handlers
    root_logger.handlers.clear()

    # Console handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(log_level)

    # Choose formatter
    if log_format == "json":
        formatter = JSONFormatter()
    else:
        formatter = logging.Formatter(
            fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

    handler.setFormatter(formatter)
    root_logger.addHandler(handler)

    # Suppress noisy libraries
    logging.getLogger("httpx").setLevel("WARNING")
    logging.getLogger("httpcore").setLevel("WARNING")
    logging.getLogger("urllib3").setLevel("WARNING")
    logging.getLogger("celery").setLevel("WARNING")

    logging.info(f"Logging configured: level={log_level}, format={log_format}")


# Initialize logging
setup_logging()
```

**Update `backend/backend_app.py`:**
```python
# Replace logging.basicConfig with:
from logging_config import setup_logging

setup_logging()
logger = logging.getLogger(__name__)
```

**Add environment variable to `docker-compose.yml`:**
```yaml
environment:
  LOG_LEVEL: ${LOG_LEVEL:-INFO}
  LOG_FORMAT: ${LOG_FORMAT:-text}  # Use "json" for production
```

**Benefits:**
- Better log aggregation (ELK, Datadog, etc.)
- Structured data for analysis
- Easier debugging
- Production-ready logs

**Effort:** Medium
**Risk:** Low

---

**Recommendation 16: Add Request Context Middleware**

**Location:** Create `backend/middleware.py`

**New File:**
```python
import uuid
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import time

logger = logging.getLogger(__name__)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Add request context (request_id, timing) to logs."""

    async def dispatch(self, request: Request, call_next):
        # Generate unique request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        # Add user_id from auth if available
        if hasattr(request.state, "user"):
            request.state.user_id = request.state.user.get("uid")

        # Add context to logger
        log_extra = {"request_id": request_id}
        if hasattr(request.state, "user_id"):
            log_extra["user_id"] = request.state.user_id

        # Record start time
        start_time = time.time()

        # Process request
        try:
            response = await call_next(request)

            # Calculate duration
            duration = time.time() - start_time

            # Log request
            logger.info(
                f"{request.method} {request.url.path}",
                extra={
                    **log_extra,
                    "status_code": response.status_code,
                    "duration_ms": round(duration * 1000, 2),
                    "method": request.method,
                    "path": request.url.path,
                },
            )

            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id

            return response

        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Request failed: {request.method} {request.url.path}",
                extra={
                    **log_extra,
                    "error": str(e),
                    "duration_ms": round(duration * 1000, 2),
                    "method": request.method,
                    "path": request.url.path,
                },
                exc_info=True,
            )
            raise
```

**Update `backend/backend_app.py`:**
```python
from middleware import RequestContextMiddleware

app = FastAPI(lifespan=lifespan)

# Add middleware (add before CORS middleware)
app.add_middleware(RequestContextMiddleware)
```

**Benefits:**
- Trace requests across logs
- Performance metrics
- Better debugging
- Request correlation

**Effort:** Low
**Risk:** Low

---

**Recommendation 17: Add Basic Metrics**

**Location:** Create `backend/metrics.py`

**New File:**
```python
import logging
from prometheus_client import Counter, Histogram, Gauge, Info
from prometheus_client.fastapi import metrics as fastapi_metrics

logger = logging.getLogger(__name__)

# Request metrics
http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"]
)

http_request_duration = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration",
    ["method", "endpoint"]
)

# Task metrics
celery_tasks_total = Counter(
    "celery_tasks_total",
    "Total Celery tasks",
    ["task_name", "status"]
)

celery_task_duration = Histogram(
    "celery_task_duration_seconds",
    "Celery task duration",
    ["task_name"]
)

# Database metrics
db_operations_total = Counter(
    "db_operations_total",
    "Total database operations",
    ["operation", "table"]
)

db_operation_duration = Histogram(
    "db_operation_duration_seconds",
    "Database operation duration",
    ["operation", "table"]
)

# System metrics
active_websocket_connections = Gauge(
    "active_websocket_connections",
    "Number of active WebSocket connections"
)

# Application info
app_info = Info("application", "Application info")
app_info.info({
    "version": os.getenv("APP_VERSION", "unknown"),
    "environment": os.getenv("ENVIRONMENT", "development")
})
```

**Add Prometheus endpoint to `backend/backend_app.py`:**
```python
from prometheus_client_fastapi.instruments import Counter as PrometheusCounter

# Add Prometheus metrics
from prometheus_client_fastapi import metrics as fastapi_metrics
app.add_middleware(fastapi_metrics)

# Or manually add endpoint
from prometheus_client import generate_latest

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    return Response(content=generate_latest(), media_type="text/plain")
```

**Benefits:**
- Performance monitoring
- Alerting capabilities
- Capacity planning
- Debugging production issues

**Effort:** Medium
**Risk:** Low

---

### 3.9 Security Hardening (Low Impact, Low Effort)

**Recommendation 18: Add Security Headers Middleware**

**Location:** Create `backend/security.py`

**New File:**
```python
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'"

        return response
```

**Update `backend/backend_app.py`:**
```python
from security import SecurityHeadersMiddleware

app = FastAPI(lifespan=lifespan)
app.add_middleware(SecurityHeadersMiddleware)
```

**Benefits:**
- Protection against XSS
- Clickjacking prevention
- Better security posture
- Compliance requirements

**Effort:** Low
**Risk:** Low

---

**Recommendation 19: Add Rate Limiting**

**Location:** Create `backend/rate_limit.py`

**New File:**
```python
import logging
from collections import defaultdict
from datetime import datetime, timedelta
from fastapi import Request, HTTPException

logger = logging.getLogger(__name__)


class RateLimiter:
    """Simple in-memory rate limiter."""

    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: defaultdict[str, list[datetime]] = defaultdict(list)

    def is_allowed(self, identifier: str) -> bool:
        """Check if request is allowed."""
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=self.window_seconds)

        # Clean old requests
        self.requests[identifier] = [
            req_time for req_time in self.requests[identifier]
            if req_time > window_start
        ]

        # Check limit
        if len(self.requests[identifier]) >= self.max_requests:
            logger.warning(f"Rate limit exceeded for {identifier}")
            return False

        # Record request
        self.requests[identifier].append(now)
        return True


# Global rate limiter
rate_limiter = RateLimiter(
    max_requests=int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "100")),
    window_seconds=int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
)


async def rate_limit_middleware(request: Request, call_next):
    """Rate limit middleware."""
    # Use IP address as identifier
    identifier = request.client.host

    if not rate_limiter.is_allowed(identifier):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    return await call_next(request)
```

**Update `backend/backend_app.py`:**
```python
from rate_limit import rate_limit_middleware

app.add_middleware(rate_limit_middleware)
```

**Add to `docker-compose.yml`:**
```yaml
environment:
  RATE_LIMIT_MAX_REQUESTS: ${RATE_LIMIT_MAX_REQUESTS:-100}
  RATE_LIMIT_WINDOW_SECONDS: ${RATE_LIMIT_WINDOW_SECONDS:-60}
```

**Benefits:**
- Protection against abuse
- Prevents DoS
- Better resource management
- Fair usage

**Effort:** Low
**Risk:** Low

---

## 4. Implementation Plan

### 4.1 Phase 1: High-Impact, Low-Effort Changes (Week 1)

**Goal:** Quick wins with minimal risk

| Priority | Change | File | Effort | Impact |
|----------|--------|------|--------|--------|
| 1 | Add resource limits to docker-compose | `docker-compose.yml` | 1 hour | High |
| 2 | Add health checks to Dockerfile | `backend/Dockerfile` | 30 min | High |
| 3 | Configure Uvicorn workers | `backend/Dockerfile` | 30 min | High |
| 4 | Add restart policy | `docker-compose.yml` | 15 min | Medium |
| 5 | Add security headers | `backend/security.py` | 1 hour | Low |
| 6 | Implement embedding cache | `backend/services/cache_service.py` | 2 hours | High |
| 7 | Optimize document listing query | `backend/services/vector_db.py` + SQL | 2 hours | High |

**Total Effort:** ~7 hours
**Expected Impact:** 40-60% performance improvement

**Testing Strategy:**
- Deploy to staging environment
- Run load tests (100 concurrent users, 1000 requests)
- Monitor memory, CPU, response times
- Rollback if issues detected

---

### 4.2 Phase 2: Medium-Complexity Optimizations (Week 2)

**Goal:** Significant performance improvements

| Priority | Change | File | Effort | Impact |
|----------|--------|------|--------|--------|
| 1 | Implement multi-stage Dockerfile | `backend/Dockerfile` | 2 hours | High |
| 2 | Split requirements files | `backend/requirements-prod.txt` | 30 min | Medium |
| 3 | Add dynamic batch sizing | `backend/services/ingestion.py` | 2 hours | Medium |
| 4 | Add pipeline cleanup | `backend/services/ingestion.py` | 1 hour | Medium |
| 5 | Add connection pooling | `backend/services/supabase_service.py` | 2 hours | High |
| 6 | Configure Celery gevent pool | `backend/config.py`, `docker-compose.worker.yml` | 2 hours | High |
| 7 | Add concurrent broadcasting | `backend/services/websocket.py` | 1 hour | Low |
| 8 | Add request context middleware | `backend/middleware.py` | 1 hour | Low |

**Total Effort:** ~11.5 hours
**Expected Impact:** 30-40% additional improvement

**Testing Strategy:**
- Comprehensive integration tests
- Memory profiling (memory_profiler)
- Performance benchmarking
- Load testing (500 concurrent users)
- Stress testing (1000+ concurrent users)

---

### 4.3 Phase 3: Long-Term Architectural Improvements (Week 3-4)

**Goal:** Production-grade architecture

| Priority | Change | File | Effort | Impact |
|----------|--------|------|--------|--------|
| 1 | Implement async Supabase client | `backend/services/async_supabase_service.py` | 4 hours | High |
| 2 | Add structured logging | `backend/logging_config.py` | 3 hours | Medium |
| 3 | Add Prometheus metrics | `backend/metrics.py` | 4 hours | Medium |
| 4 | Implement task-specific queues | `backend/async_tasks.py`, `docker-compose.worker-ingestion.yml` | 4 hours | Medium |
| 5 | Add rate limiting | `backend/rate_limit.py` | 2 hours | Low |
| 6 | Create production compose file | `docker-compose.prod.yml` | 1 hour | Low |
| 7 | Add comprehensive monitoring | Multiple files | 8 hours | High |
| 8 | Documentation and runbooks | Docs | 4 hours | Low |

**Total Effort:** ~30 hours
**Expected Impact:** 20-30% additional improvement + production readiness

**Testing Strategy:**
- Full production-like environment
- Chaos testing
- Failure scenario testing
- Long-running stability tests (24-48 hours)
- Performance regression testing

---

### 4.4 Rollout Strategy

**Week 1:**
1. Deploy Phase 1 changes to staging
2. Run comprehensive tests
3. Deploy to production with feature flags
4. Monitor for 48 hours

**Week 2:**
1. Deploy Phase 2 changes to staging
2. Run tests and benchmarks
3. Gradual rollout to production (canary deployment)
4. Monitor metrics and errors

**Week 3-4:**
1. Deploy Phase 3 changes to staging
2. Run full integration tests
3. Deploy to production with monitoring
4. Continuous optimization based on metrics

**Rollback Plan:**
- Keep previous Docker images available
- Use blue-green deployment strategy
- Automated rollback on error rate > 5%
- Manual rollback approval for 1%+ latency increase

---

## 5. Proposed Configuration Changes

### 5.1 Updated Dockerfile

**Location:** `backend/Dockerfile`

```dockerfile
# ============================================
# Builder stage - includes build tools and dev dependencies
# ============================================
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Install PyTorch CPU-only (explicitly to avoid GPU bloat)
RUN pip install --no-cache-dir torch torchvision \
    --index-url https://download.pytorch.org/whl/cpu

# Copy requirements and install all dependencies
COPY requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt

# Copy application code
COPY . .

# Preload models in builder stage
RUN python preload_models.py

# ============================================
# Production stage - minimal runtime image
# ============================================
FROM python:3.11-slim AS production

WORKDIR /app

# Install only runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Install PyTorch CPU-only
RUN pip install --no-cache-dir torch torchvision \
    --index-url https://download.pytorch.org/whl/cpu

# Copy only production dependencies
COPY requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt

# Copy application code and preloaded models from builder
COPY --from=builder /app /app

# Create non-root user for security
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

# Production-optimized uvicorn command
CMD ["uvicorn", "backend_app:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "${UVICORN_WORKERS:-4}", \
     "--loop", "uvloop", \
     "--timeout-keep-alive", "5", \
     "--limit-concurrency", "${UVICORN_MAX_CONNECTIONS:-1000}", \
     "--backlog", "2048", \
     "--access-log", \
     "--log-level", "${UVICORN_LOG_LEVEL:-info}"]
```

---

### 5.2 Updated docker-compose.yml

**Location:** `docker-compose.yml`

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "${BACKEND_PORT:-8000}:8000"
    command: ["uvicorn", "backend_app:app", "--host", "0.0.0.0", "--port", "8000"]
    environment:
      # Basic Configuration
      BASE_URL: ${BASE_URL:-192.168.5.204}
      API_URL: ${API_URL}

      # RabbitMQ Configuration
      CELERY_BROKER_URL: ${CELERY_BROKER_URL:-amqp://guest:guest@${BASE_URL}:5672//}  # pragma: allowlist secret

      # OpenAI / LLM Configuration
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      OPENAI_API_BASE: ${OPENAI_API_BASE}
      OPENAI_MODEL: ${OPENAI_MODEL}
      OPENAI_EMBEDDING_MODEL: ${OPENAI_EMBEDDING_MODEL}
      OPENAI_EMBEDDING_DIMENSIONS: ${OPENAI_EMBEDDING_DIMENSIONS}

      # Supabase Configuration
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_KEY: ${SUPABASE_KEY}
      SUPABASE_CONNECT_TIMEOUT: ${SUPABASE_CONNECT_TIMEOUT:-5.0}
      SUPABASE_READ_TIMEOUT: ${SUPABASE_READ_TIMEOUT:-30.0}
      SUPABASE_WRITE_TIMEOUT: ${SUPABASE_WRITE_TIMEOUT:-5.0}
      SUPABASE_POOL_TIMEOUT: ${SUPABASE_POOL_TIMEOUT:-5.0}
      SUPABASE_MAX_CONNECTIONS: ${SUPABASE_MAX_CONNECTIONS:-100}
      SUPABASE_MAX_KEEPALIVE: ${SUPABASE_MAX_KEEPALIVE:-20}

      # Azure Storage Configuration
      AZURE_STORAGE_CONNECTION_STRING: ${AZURE_STORAGE_CONNECTION_STRING}
      AZURE_STORAGE_CONTAINER_NAME: ${AZURE_STORAGE_CONTAINER_NAME:-documents}
      AZURE_STORAGE_ACCOUNT_NAME: ${AZURE_STORAGE_ACCOUNT_NAME}

      # Uvicorn Configuration
      UVICORN_WORKERS: ${UVICORN_WORKERS:-4}
      UVICORN_MAX_CONNECTIONS: ${UVICORN_MAX_CONNECTIONS:-1000}
      UVICORN_LOG_LEVEL: ${UVICORN_LOG_LEVEL:-info}

      # WebSocket Configuration
      WEBSOCKET_MAX_CONNECTIONS: ${WEBSOCKET_MAX_CONNECTIONS:-100}
      WEBSOCKET_CONNECTION_TIMEOUT: ${WEBSOCKET_CONNECTION_TIMEOUT:-3600}

      # Rate Limiting Configuration
      RATE_LIMIT_MAX_REQUESTS: ${RATE_LIMIT_MAX_REQUESTS:-100}
      RATE_LIMIT_WINDOW_SECONDS: ${RATE_LIMIT_WINDOW_SECONDS:-60}

      # Logging Configuration
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
      LOG_FORMAT: ${LOG_FORMAT:-text}

      # CORS Configuration
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS:-https://aidocs.ethanturk.com,http://localhost:3000,http://localhost:3001}

      # Security Configuration
      APP_VERSION: ${APP_VERSION:-1.0.0}
      ENVIRONMENT: ${ENVIRONMENT:-development}

    # Resource limits tuned for FastAPI backend
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: "2.0"
        reservations:
          memory: 512M
          cpus: "0.5"

    # Health check to detect when server stops responding
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

    # Restart policy to recover from crashes
    restart: unless-stopped

    networks:
      - web

networks:
  web:
    external: true
    name: web
```

---

### 5.3 Updated docker-compose.worker.yml

**Location:** `docker-compose.worker.yml`

```yaml
services:
  worker:
    build: ./backend
    command: celery -A async_tasks worker \
      --loglevel=info \
      --concurrency=${CELERY_WORKER_CONCURRENCY:-100} \
      --pool=${CELERY_WORKER_POOL:-gevent} \
      --prefetch-multiplier=${CELERY_PREFETCH_MULTIPLIER:-1} \
      --queues=${CELERY_QUEUE_NAME:-celery}

    environment:
      # Basic Configuration
      BASE_URL: ${BASE_URL:-192.168.5.204}
      API_URL: ${API_URL}

      # RabbitMQ Configuration
      CELERY_BROKER_URL: ${CELERY_BROKER_URL:-amqp://guest:guest@192.168.5.204:5672//}  # pragma: allowlist secret
      CELERY_QUEUE_NAME: ${CELERY_QUEUE_NAME:-celery}

      # Celery Performance Settings
      CELERY_WORKER_CONCURRENCY: ${CELERY_WORKER_CONCURRENCY:-100}
      CELERY_WORKER_POOL: ${CELERY_WORKER_POOL:-gevent}
      CELERY_PREFETCH_MULTIPLIER: ${CELERY_PREFETCH_MULTIPLIER:-1}
      CELERY_TASK_TIME_LIMIT: ${CELERY_TASK_TIME_LIMIT:-3600}
      CELERY_TASK_SOFT_TIME_LIMIT: ${CELERY_TASK_SOFT_TIME_LIMIT:-3300}
      CELERY_BROKER_HEARTBEAT: ${CELERY_BROKER_HEARTBEAT:-10}
      CELERY_TASK_ACKS_LATE: ${CELERY_TASK_ACKS_LATE:-true}

      # OpenAI / LLM Configuration
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      OPENAI_API_BASE: ${OPENAI_API_BASE}
      OPENAI_MODEL: ${OPENAI_MODEL}
      OPENAI_EMBEDDING_MODEL: ${OPENAI_EMBEDDING_MODEL}
      OPENAI_EMBEDDING_DIMENSIONS: ${OPENAI_EMBEDDING_DIMENSIONS}

      # Supabase Configuration
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_KEY: ${SUPABASE_KEY}
      SUPABASE_CONNECT_TIMEOUT: ${SUPABASE_CONNECT_TIMEOUT:-5.0}
      SUPABASE_READ_TIMEOUT: ${SUPABASE_READ_TIMEOUT:-30.0}
      SUPABASE_WRITE_TIMEOUT: ${SUPABASE_WRITE_TIMEOUT:-5.0}
      SUPABASE_MAX_CONNECTIONS: ${SUPABASE_MAX_CONNECTIONS:-100}
      SUPABASE_MAX_KEEPALIVE: ${SUPABASE_MAX_KEEPALIVE:-20}

      # Azure Storage Configuration
      AZURE_STORAGE_CONNECTION_STRING: ${AZURE_STORAGE_CONNECTION_STRING}
      AZURE_STORAGE_CONTAINER_NAME: ${AZURE_STORAGE_CONTAINER_NAME:-documents}
      AZURE_STORAGE_ACCOUNT_NAME: ${AZURE_STORAGE_ACCOUNT_NAME}

      # Logging Configuration
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
      LOG_FORMAT: ${LOG_FORMAT:-text}

    # Resource limits tuned for Celery worker
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: "1.0"
        reservations:
          memory: 512M
          cpus: "0.5"

    # Health check to detect worker status
    healthcheck:
      test: ["CMD", "celery", "-A", "async_tasks", "inspect", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

    # Restart policy to recover from crashes
    restart: unless-stopped

    networks:
      - web

networks:
  web:
    external: true
    name: web
```

---

### 5.4 New File: requirements-prod.txt

**Location:** `backend/requirements-prod.txt`

```
langchain-openai
pydantic-ai
nest_asyncio
celery
firebase-admin
python-dotenv
fastapi
uvicorn[standard]
langchain-text-splitters
watchdog
docling[vlm]
pypdfium2
pandas
xlrd
openpyxl
httpx
litellm
supabase
azure-storage-blob>=12.20.0
psutil>=5.9.0
```

---

### 5.5 New File: requirements-dev.txt

**Location:** `backend/requirements-dev.txt`

```
-r requirements-prod.txt
pytest
pytest-asyncio
pytest-mock
pytest-cov
black
ruff
mypy
httpx[cli]
```

---

## 6. Testing & Validation Strategy

### 6.1 Performance Benchmarking

**Before Optimization (Baseline):**

```bash
# Build current image
docker-compose build backend

# Start services
docker-compose up -d backend

# Wait for startup
sleep 30

# Run load test
ab -n 1000 -c 100 http://localhost:8000/health

# Record metrics:
# - Response time (avg, p50, p95, p99)
# - Throughput (requests/second)
# - Error rate
# - Memory usage (docker stats)
# - CPU usage (docker stats)

# Collect container stats
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Check image size
docker images | grep backend
```

**After Optimization:**

```bash
# Build optimized image
docker-compose build backend

# Start services
docker-compose up -d backend

# Wait for startup
sleep 30

# Run same load test
ab -n 1000 -c 100 http://localhost:8000/health

# Record metrics and compare

# Additional tests:
# - Concurrent WebSocket connections (100 connections)
# - Document ingestion (10 PDF files, 100MB total)
# - Vector search (1000 queries)
# - Document listing performance
```

**Expected Improvements:**
- **Image Size:** 30-40% reduction
- **Startup Time:** 20-30% faster
- **Throughput:** 2-4x increase
- **Memory Usage:** 20-30% reduction
- **Response Time:** 30-50% reduction for cached queries

---

### 6.2 Load Testing Script

**Location:** Create `scripts/load_test.sh`

```bash
#!/bin/bash

# Configuration
BASE_URL="${BASE_URL:-http://localhost:8000}"
CONCURRENCY="${CONCURRENCY:-100}"
REQUESTS="${REQUESTS:-1000}"
DURATION="${DURATION:-60s}"

echo "=== Load Test Configuration ==="
echo "Base URL: $BASE_URL"
echo "Concurrency: $CONCURRENCY"
echo "Requests: $REQUESTS"
echo "Duration: $DURATION"
echo "=============================="

# Test 1: Health endpoint (baseline)
echo ""
echo "Test 1: Health Endpoint"
ab -n $REQUESTS -c $CONCURRENCY -g health_results.tsv $BASE_URL/health

# Test 2: Document search endpoint
echo ""
echo "Test 2: Document Search"
curl -s -X POST $BASE_URL/agent/search \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test query", "limit": 10, "document_set": "all"}' \
  > /dev/null

# Test 3: Document listing
echo ""
echo "Test 3: Document Listing"
ab -n 100 -c 10 -g list_results.tsv $BASE_URL/agent/documents

# Test 4: WebSocket connections
echo ""
echo "Test 4: WebSocket Connections"
# Use a WebSocket client or custom script
python3 scripts/websocket_load_test.py --url ws://localhost:8000/ws --connections $CONCURRENCY --duration $DURATION

# Collect system metrics
echo ""
echo "=== System Metrics ==="
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""
echo "=== Test Complete ==="
echo "Results saved to: health_results.tsv, list_results.tsv"
```

---

### 6.3 Memory Profiling

**Location:** Create `scripts/memory_profile.py`

```python
#!/usr/bin/env python3
"""Memory profiling script for backend services."""

import memory_profiler
import time
import requests
import sys

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"


@memory_profiler.profile
def test_document_ingestion():
    """Profile memory usage during document ingestion."""
    # Simulate document upload
    files = {"files": open("test_document.pdf", "rb")}
    data = {"document_set": "test"}

    response = requests.post(
        f"{BASE_URL}/agent/upload",
        files=files,
        data=data
    )
    print(f"Upload response: {response.status_code}")


@memory_profiler.profile
def test_vector_search():
    """Profile memory usage during vector search."""
    for i in range(100):
        response = requests.post(
            f"{BASE_URL}/agent/search",
            json={
                "prompt": f"test query {i}",
                "limit": 10,
                "document_set": "all"
            }
        )
        print(f"Search {i}: {response.status_code}")


if __name__ == "__main__":
    print("=== Memory Profiling ===")
    print("Testing document ingestion...")
    test_document_ingestion()

    time.sleep(5)

    print("\nTesting vector search...")
    test_vector_search()

    print("\n=== Profiling Complete ===")
```

---

### 6.4 Integration Testing

**Location:** Create `backend/tests/integration/test_performance.py`

```python
import pytest
import time
import requests
from typing import Dict, Any


class TestPerformance:
    """Performance integration tests."""

    BASE_URL = "http://localhost:8000"

    @pytest.mark.integration
    def test_health_endpoint_latency(self):
        """Test health endpoint meets latency requirements."""
        start_time = time.time()
        response = requests.get(f"{self.BASE_URL}/health")
        latency = (time.time() - start_time) * 1000  # Convert to ms

        assert response.status_code == 200
        assert latency < 100, f"Health endpoint too slow: {latency}ms"

    @pytest.mark.integration
    def test_document_listing_performance(self):
        """Test document listing meets performance requirements."""
        start_time = time.time()
        response = requests.get(f"{self.BASE_URL}/agent/documents")
        latency = (time.time() - start_time) * 1000

        assert response.status_code == 200
        assert latency < 500, f"Document listing too slow: {latency}ms"

    @pytest.mark.integration
    def test_concurrent_requests(self):
        """Test server handles concurrent requests."""
        import concurrent.futures

        def make_request():
            response = requests.get(f"{self.BASE_URL}/health")
            return response.status_code

        start_time = time.time()
        with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
            futures = [executor.submit(make_request) for _ in range(100)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        latency = (time.time() - start_time) * 1000

        assert all(r == 200 for r in results), "Some requests failed"
        assert latency < 5000, f"Concurrent requests too slow: {latency}ms"

    @pytest.mark.integration
    def test_search_with_cache(self):
        """Test cached search is faster than uncached."""
        query = {"prompt": "test query", "limit": 10, "document_set": "all"}

        # First request (uncached)
        start_time = time.time()
        response1 = requests.post(f"{self.BASE_URL}/agent/search", json=query)
        latency1 = (time.time() - start_time) * 1000

        # Second request (cached)
        start_time = time.time()
        response2 = requests.post(f"{self.BASE_URL}/agent/search", json=query)
        latency2 = (time.time() - start_time) * 1000

        assert response1.status_code == 200
        assert response2.status_code == 200
        # Cached should be at least 50% faster
        assert latency2 < latency1 * 0.5, f"Cache not effective: {latency1}ms vs {latency2}ms"
```

---

### 6.5 Monitoring & Alerting

**Prometheus Metrics to Track:**

```yaml
# Key metrics to monitor
metrics:
  - http_requests_total              # Total HTTP requests
  - http_request_duration_seconds    # Request latency
  - celery_tasks_total               # Celery task counts
  - celery_task_duration_seconds     # Task execution time
  - db_operations_total              # Database operation counts
  - db_operation_duration_seconds    # Database operation latency
  - active_websocket_connections     # Active WebSocket count
  - container_memory_usage_bytes     # Container memory usage
  - container_cpu_usage_seconds_total # Container CPU usage
```

**Alert Rules:**

```yaml
# Alert on high error rate
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "High error rate detected"

# Alert on high latency
- alert: HighLatency
  expr: histogram_quantile(0.95, http_request_duration_seconds) > 1.0
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "95th percentile latency above 1s"

# Alert on high memory usage
- alert: HighMemoryUsage
  expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.8
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Memory usage above 80%"

# Alert on hung workers
- alert: HungWorker
  expr: increase(celery_tasks_total{status="STARTED"}[5m]) > 0 and \
        increase(celery_tasks_total{status="SUCCESS"}[5m]) == 0
  for: 10m
  labels:
    severity: critical
  annotations:
    summary: "Celery worker appears hung"
```

---

### 6.6 Validation Checklist

**Before Deployment:**

- [ ] All unit tests pass (`pytest -m unit`)
- [ ] All integration tests pass (`pytest -m integration`)
- [ ] Code coverage > 90% (`pytest --cov`)
- [ ] No security vulnerabilities (`bandit -r backend/`)
- [ ] Code formatting compliant (`black --check backend/`)
- [ ] Linting passes (`ruff check backend/`)
- [ ] Type checking passes (`mypy backend/`)
- [ ] Docker image builds successfully
- [ ] Health check endpoint responds
- [ ] WebSocket connections work
- [ ] Celery worker processes tasks
- [ ] Document ingestion works
- [ ] Vector search returns results
- [ ] No memory leaks in 1-hour stress test

**After Deployment:**

- [ ] Container starts successfully
- [ ] Health check passes
- [ ] No errors in logs
- [ ] Metrics collection working
- [ ] Load tests meet SLAs
- [ ] Memory usage within limits
- [ ] CPU usage within limits
- [ ] Error rate < 1%
- [ ] P95 latency < 500ms
- [ ] WebSocket connections stable
- [ ] Celery tasks complete successfully
- [ ] No database connection errors
- [ ] No OOM errors in 24 hours

---

## 7. Summary & Next Steps

### 7.1 Expected Outcomes

**Performance Improvements:**
- **Container Size:** 30-40% reduction (2-3GB → 1.2-1.5GB)
- **Startup Time:** 20-30% faster (30-60s → 20-45s)
- **Throughput:** 2-4x increase (100 req/s → 200-400 req/s)
- **Memory Usage:** 20-30% reduction
- **Response Time:** 30-50% reduction for cached queries
- **Task Processing:** 3-5x improvement with gevent pool

**Operational Improvements:**
- Better resource utilization
- Automatic recovery from failures
- Production-ready monitoring
- Comprehensive observability
- Improved security posture
- Better debugging capabilities

### 7.2 Risk Assessment

**Low Risk Changes:**
- Dockerfile multi-stage build
- Resource limits configuration
- Health checks
- Security headers
- Embedding cache
- Structured logging
- Request context middleware

**Medium Risk Changes:**
- Async Supabase client
- Celery gevent pool configuration
- Connection pooling
- Dynamic batch sizing
- Task-specific queues

**High Risk Changes:**
- Major architecture changes (none recommended)
- Database schema changes (minimal - one function)
- Breaking API changes (none recommended)

**Mitigation Strategies:**
- Gradual rollout (canary deployment)
- Feature flags for toggling changes
- Comprehensive testing before production
- Monitoring and alerting
- Quick rollback capability

### 7.3 Success Metrics

**Performance Metrics:**
- P95 response time < 500ms
- Error rate < 1%
- Throughput > 200 requests/second
- Memory usage < 2GB
- CPU usage < 80%
- Container uptime > 99.9%

**Operational Metrics:**
- Mean time to recovery (MTTR) < 5 minutes
- Deployment success rate > 95%
- Alert noise < 5 per week
- Mean time to detection (MTTD) < 1 minute

### 7.4 Ongoing Optimization

**Continuous Improvements:**
1. Monitor metrics and identify bottlenecks
2. Implement caching strategies (Redis)
3. Add more sophisticated rate limiting
4. Implement distributed tracing (OpenTelemetry)
5. Add APM integration (Datadog, New Relic)
6. Optimize database queries and indexes
7. Implement read replicas for scaling
8. Add CDN for static content
9. Implement circuit breakers for external services
10. Add autoscaling based on metrics

### 7.5 Recommended Next Steps

1. **Immediate (This Week):**
   - Review and approve recommendations
   - Create feature branch for optimizations
   - Implement Phase 1 changes
   - Deploy to staging environment
   - Run comprehensive tests

2. **Short-term (Next 2 Weeks):**
   - Implement Phase 2 changes
   - Create monitoring dashboards
   - Set up alerting rules
   - Document procedures
   - Train team on new monitoring

3. **Medium-term (Next Month):**
   - Implement Phase 3 changes
   - Optimize based on production metrics
   - Create runbooks for common issues
   - Implement autoscaling
   - Add more sophisticated caching

4. **Long-term (Next Quarter):**
   - Evaluate and implement Redis caching
   - Add distributed tracing
   - Implement advanced monitoring
   - Optimize database performance
   - Scale to handle 10x current load

---

## Appendix A: Environment Variables Reference

**New Environment Variables:**

```bash
# Uvicorn Configuration
UVICORN_WORKERS=4                          # Number of worker processes
UVICORN_MAX_CONNECTIONS=1000               # Max concurrent connections
UVICORN_LOG_LEVEL=info                    # Log level: debug, info, warning, error

# Supabase Configuration
SUPABASE_CONNECT_TIMEOUT=5.0              # Connection timeout (seconds)
SUPABASE_READ_TIMEOUT=30.0                 # Read timeout (seconds)
SUPABASE_WRITE_TIMEOUT=5.0                # Write timeout (seconds)
SUPABASE_POOL_TIMEOUT=5.0                 # Pool timeout (seconds)
SUPABASE_MAX_CONNECTIONS=100               # Max connections in pool
SUPABASE_MAX_KEEPALIVE=20                  # Max keepalive connections

# WebSocket Configuration
WEBSOCKET_MAX_CONNECTIONS=100              # Max WebSocket connections
WEBSOCKET_CONNECTION_TIMEOUT=3600          # Connection timeout (seconds)

# Celery Configuration
CELERY_WORKER_CONCURRENCY=100             # Worker concurrency (for gevent)
CELERY_WORKER_POOL=gevent                  # Pool type: prefork, gevent, eventlet, solo
CELERY_PREFETCH_MULTIPLIER=1               # Task prefetch multiplier
CELERY_TASK_TIME_LIMIT=3600                # Max task duration (seconds)
CELERY_TASK_SOFT_TIME_LIMIT=3300           # Soft timeout (seconds)
CELERY_BROKER_HEARTBEAT=10                 # Broker heartbeat (seconds)
CELERY_TASK_ACKS_LATE=true                 # Ack after task completion

# Rate Limiting Configuration
RATE_LIMIT_MAX_REQUESTS=100                # Max requests per window
RATE_LIMIT_WINDOW_SECONDS=60               # Time window (seconds)

# Logging Configuration
LOG_LEVEL=INFO                             # Log level: DEBUG, INFO, WARNING, ERROR
LOG_FORMAT=text                            # Log format: text, json

# Security Configuration
APP_VERSION=1.0.0                          # Application version
ENVIRONMENT=development                    # Environment: development, staging, production
```

---

## Appendix B: Command Reference

**Build and Run:**

```bash
# Build optimized backend
docker-compose build backend

# Start backend with optimizations
docker-compose up -d backend

# Start worker with optimizations
docker-compose -f docker-compose.worker.yml up -d worker

# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f backend

# View container stats
docker stats

# Execute command in container
docker-compose exec backend bash
```

**Testing:**

```bash
# Run unit tests
docker-compose exec backend pytest -m unit

# Run integration tests
docker-compose exec backend pytest -m integration

# Run with coverage
docker-compose exec backend pytest --cov=.

# Run load tests
./scripts/load_test.sh

# Memory profiling
python3 scripts/memory_profile.py
```

**Monitoring:**

```bash
# Check health
curl http://localhost:8000/health

# View metrics
curl http://localhost:8000/metrics

# Check Celery worker status
docker-compose exec worker celery -A async_tasks inspect active
docker-compose exec worker celery -A async_tasks inspect stats

# Check RabbitMQ queues
curl -u guest:guest http://localhost:15672/api/queues
```

---

## Appendix C: Troubleshooting

**Common Issues:**

**Issue: Container fails to start**
```bash
# Check logs
docker-compose logs backend

# Check if port is in use
netstat -tulpn | grep 8000

# Check health
curl http://localhost:8000/health
```

**Issue: High memory usage**
```bash
# Check memory stats
docker stats backend

# Check process memory
docker-compose exec backend ps aux

# Profile memory
python3 scripts/memory_profile.py
```

**Issue: Slow response times**
```bash
# Check latency distribution
curl -w "@curl-format.txt" http://localhost:8000/health

# Check database queries
# (Requires database logging enabled)

# Check slow queries
# (Requires query logging)
```

**Issue: Celery worker not processing tasks**
```bash
# Check worker status
docker-compose exec worker celery -A async_tasks inspect active

# Check broker connection
docker-compose exec worker celery -A async_tasks inspect ping

# Check queues
curl -u guest:guest http://localhost:15672/api/queues
```

**Issue: WebSocket connections dropping**
```bash
# Check connection count
curl http://localhost:8000/metrics | grep active_websocket_connections

# Check logs
docker-compose logs backend | grep WebSocket
```

---

**Document Version:** 1.0
**Last Updated:** 2025-01-09
**Author:** Backend Performance Analysis
**Reviewers:** [To be filled]
**Approved:** [To be filled]
