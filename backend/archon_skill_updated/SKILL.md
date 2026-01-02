---
description: Interactive Archon integration for knowledge base and project management via REST API.
---

# Archon

Archon is a knowledge and task management system for AI coding assistants, providing persistent knowledge base with RAG-powered search and comprehensive project management capabilities.

---

## ⚠️ CRITICAL WORKFLOW - READ THIS FIRST ⚠️

**MANDATORY STEPS - Execute in this exact order:**

1. **FIRST:** Read `references/api_reference.md` to learn correct API endpoints
2. **SECOND:** Ask user for Archon host URL (default: `http://localhost:8181`)
3. **THIRD:** Verify connection with `GET /api/projects`
4. **FOURTH:** Use correct endpoint paths from api_reference.md for all operations

**Common mistake:** Using `/api/knowledge/search` instead of `/api/knowledge-items/search`
**Solution:** Always consult api_reference.md for authoritative endpoint paths.

### Quick Endpoint Reference (Verify with api_reference.md)

```
Knowledge:
  POST   /api/knowledge-items/search     - Search knowledge base
  GET    /api/knowledge-items            - List all knowledge items
  POST   /api/knowledge-items/crawl      - Crawl website
  POST   /api/knowledge-items/upload     - Upload document
  GET    /api/rag/sources                - Get all RAG sources
  GET    /api/database/metrics           - Get database metrics

Projects:
  GET    /api/projects                   - List all projects
  GET    /api/projects/{id}              - Get project details
  POST   /api/projects                   - Create project

Tasks:
  GET    /api/tasks                      - List tasks (with filters)
  GET    /api/tasks/{id}                 - Get task details
  POST   /api/tasks                      - Create task
  PUT    /api/tasks/{id}                 - Update task (status, etc.)
```

## Quick Start Scripts

This skill includes helper scripts to make interacting with Archon easier.

### 1. Find Tasks (`scripts/find_tasks.py`)

Quickly find tasks assigned to you or in a specific project.

```python
# Usage
python scripts/find_tasks.py
```

_Note: You may need to edit the script to set the correct `project_id` or `status` filter._

### 2. Manage Tasks (`scripts/manage_task.py`)

Create or update tasks from the command line.

```bash
# Update a task status
python scripts/manage_task.py update <task_id> --status doing

# Create a new task
python scripts/manage_task.py create <project_id> "Task Title" --description "Details here"
```

### 3. Archon Client (`scripts/archon_client.py`)

A reusable Python client for the Archon API. Use this in your own scripts to interact with Archon programmatically.

```python
from scripts.archon_client import ArchonClient

client = ArchonClient(base_url="http://localhost:8181")
projects = client.list_projects()
print(projects)
```

## Configuration

**Host URL:** Provided by user at skill activation (e.g., `http://localhost:8181`, `http://192.168.1.100:8181`)

**Default Settings:**

- Default search: hybrid strategy with reranking
- Default crawl depth: 3 levels
- Default results: 10 items

**Using Custom Host:**

```python
from scripts.archon_client import ArchonClient

# Always use the host URL provided by the user
archon_host = "http://192.168.1.100:8181"  # Example
client = ArchonClient(base_url=archon_host)
```
