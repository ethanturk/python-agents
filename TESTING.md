# Testing Guide

This document provides a comprehensive guide to testing the python-agents project.

## Overview

The testing system is designed to run completely isolated in containers, with support for:
- **Unit tests**: Fast tests using mocks (default)
- **Integration tests**: Tests requiring real database and message queue
- **End-to-end tests**: Full system tests including frontend

## Test Infrastructure

### Test Containers

The project uses `docker-compose.test.yml` to run isolated test services:

- **PostgreSQL + pgvector**: Test database on port 5433
- **RabbitMQ**: Test message broker on ports 5673 (AMQP) and 15673 (Management UI)
- **Redis**: Test cache on port 6380

These are separate from production containers to ensure isolation.

### Test Database Setup

The test database is automatically initialized with:
- `test-documents` table with vector support
- `match_documents` function for RAG searches
- Helper functions for document operations
- Sample test data

See `backend/tests/test_db_setup.sql` for schema details.

## Running Tests

### Quick Start

```bash
# Run all unit tests (fastest)
./run_tests.sh --unit

# Run with coverage
./run_tests.sh --unit --coverage

# Run integration tests with containers
./run_tests.sh --integration --containers

# Run all tests
./run_tests.sh --all --containers --coverage
```

### Direct pytest Commands

```bash
# From backend directory
cd backend

# Run unit tests
pytest -m unit

# Run integration tests (requires containers)
USE_TEST_CONTAINERS=true pytest -m integration

# Run specific test file
pytest tests/test_vector_db_real.py

# Run with coverage
pytest --cov=. --cov-report=html
```

### Frontend Tests

```bash
# From frontend directory
cd frontend

# Run tests
npm test

# Run in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

## Test Organization

### Test Markers

Tests are organized using pytest markers:

- `@pytest.mark.unit`: Unit tests (use mocks, no external dependencies)
- `@pytest.mark.integration`: Integration tests (require test containers)
- `@pytest.mark.e2e`: End-to-end tests (require full system)
- `@pytest.mark.slow`: Slow tests (can be skipped with `-m "not slow"`)

### Test Structure

```
backend/tests/
├── conftest.py              # Shared fixtures and configuration
├── test_db_setup.sql        # Database schema for tests
├── test_vector_db_real.py   # Integration tests for vector DB
├── test_vector_db_integration.py  # Vector DB lifecycle tests
├── test_agent_service.py    # Agent service unit tests
├── test_backend_app.py      # FastAPI endpoint tests
├── test_async_tasks.py      # Celery task tests
└── test_summarizer.py       # Summarization tests
```

## Fixtures

### Common Fixtures

- `client()`: FastAPI TestClient
- `mock_vector_db`: Mocked vector DB service
- `mock_openai_agent`: Mocked LLM agent
- `mock_celery_task`: Mocked Celery tasks
- `sample_documents`: Sample document data
- `sample_embeddings`: Sample embedding vectors

### Integration Fixtures

- `test_db_connection`: Real PostgreSQL connection (requires containers)
- `test_rabbitmq_connection`: Real RabbitMQ connection (requires containers)

## Writing Tests

### Unit Test Example

```python
import pytest
from services.agent import run_sync_agent

@pytest.mark.unit
def test_run_sync_agent_success(mock_openai_agent):
    response = run_sync_agent("Hello")
    assert response == "Mocked LLM response"
```

### Integration Test Example

```python
import pytest
from services.vector_db import db_service

@pytest.mark.integration
@pytest.mark.asyncio
async def test_vector_db_real_connection(test_db_connection):
    # Test with real database
    await db_service.upsert_vectors([point])
    docs = await db_service.list_documents()
    assert len(docs) > 0
```

### Endpoint Test Example

```python
def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Start test containers
        run: docker-compose -f docker-compose.test.yml up -d
      
      - name: Run tests
        run: ./run_tests.sh --all --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Troubleshooting

### Test Containers Won't Start

```bash
# Check container logs
docker-compose -f docker-compose.test.yml logs

# Restart containers
docker-compose -f docker-compose.test.yml restart

# Force rebuild
docker-compose -f docker-compose.test.yml up -d --build
```

### Database Connection Errors

```bash
# Check if database is ready
docker exec test-db pg_isready -U test_user

# View database logs
docker logs test-db

# Check connection string
echo $DATABASE_CONN_STRING
```

### Tests Fail Randomly

```bash
# Run tests with retries
pytest --retries 3

# Increase timeout
pytest --timeout=300

# Run in verbose mode to see what's happening
pytest -v -s
```

## Best Practices

1. **Isolation**: Each test should be independent. Clean up after yourself.
2. **Speed**: Prefer unit tests with mocks over integration tests.
3. **Clarity**: Use descriptive test names that explain what is being tested.
4. **Coverage**: Aim for >80% code coverage, but don't sacrifice readability.
5. **Documentation**: Add docstrings to complex tests explaining the test logic.

## Test Coverage

To generate coverage reports:

```bash
# HTML report (view in browser)
./run_tests.sh --coverage
open backend/htmlcov/index.html

# Terminal report
cd backend
pytest --cov=. --cov-report=term-missing
```

## Continuous Testing

For rapid development workflow:

```bash
# Watch mode (rerun tests on file changes)
pytest -f

# Only run tests related to changed files
pytest -n auto --dist loadscope

# Run failed tests only
pytest --lf
```

## Mocking Guidelines

- **Mock external services**: Always mock databases, APIs, and LLM calls in unit tests
- **Don't mock the system under test**: Test the actual logic of your functions
- **Use fixtures**: Reuse mocks through fixtures for consistency
- **Clear expectations**: Make it obvious what behavior you're mocking

## Performance Testing

For load testing and performance benchmarks:

```bash
# Run with concurrency
pytest -n auto

# Profile slow tests
pytest --durations=10

# Memory profiling
pytest --memprof
```

## Security Testing

The project includes security markers via flake8-bandit:

```bash
# Run security checks
ruff check backend/
```

Always check for:
- SQL injection vulnerabilities
- Command injection risks
- Secret/credential exposure
- Auth bypass possibilities
