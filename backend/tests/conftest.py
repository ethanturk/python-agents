import pytest
import asyncio
import time
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
import sys
import os
import tempfile
from typing import Generator

# Add backend to path so we can import modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set up test environment
os.environ.setdefault("MONITORED_DIR", tempfile.mkdtemp())
os.environ.setdefault(
    "DATABASE_CONN_STRING", "postgresql://test_user:test_pass@localhost:5433/test_db"
)
os.environ.setdefault("OPENAI_API_KEY", "sk-test-key")
os.environ.setdefault("VECTOR_TABLE_NAME", "test_documents")
os.environ.setdefault("CELERY_QUEUE_NAME", "test-queue")
os.environ.setdefault("CELERY_BROKER_URL", "amqp://test_user:test_pass@localhost:5673//")

# Check if we're running with test containers
USE_TEST_CONTAINERS = os.getenv("USE_TEST_CONTAINERS", "false").lower() == "true"

if not USE_TEST_CONTAINERS:
    # Mock nest_asyncio to prevent conflict with TestClient
    sys.modules["nest_asyncio"] = MagicMock()
    sys.modules["firebase_admin"] = MagicMock()
    sys.modules["auth"] = MagicMock()

# Import after environment setup
from backend_app import app
from auth import get_current_user

# Mock Authentication
app.dependency_overrides[get_current_user] = lambda: {
    "uid": "test-user",
    "email": "test@example.com",
}


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_vector_db(mocker):
    """Mock vector DB service for unit tests."""
    mocker.patch("services.vector_db.db_service.search", return_value=[])
    mocker.patch("services.vector_db.db_service.upsert_vectors", return_value=None)
    mocker.patch("services.vector_db.db_service.delete_document", return_value=None)
    mocker.patch("services.vector_db.db_service.list_documents", return_value=[])
    mocker.patch("services.vector_db.psycopg2.connect", return_value=MagicMock())

    from services.vector_db import db_service

    return db_service


@pytest.fixture
def mock_openai_agent(mocker):
    """Mock OpenAI agent for unit tests."""
    mock_agent = MagicMock()
    mock_result = MagicMock()
    mock_result.output = "Mocked LLM response"
    mock_agent.run_sync.return_value = mock_result

    mocker.patch("services.agent.Agent", return_value=mock_agent)
    mocker.patch("async_tasks.Agent", return_value=mock_agent)

    return mock_agent


@pytest.fixture
def mock_celery_task(mocker):
    """Mock Celery tasks for unit tests."""
    mock_task = MagicMock()
    mock_task.id = "mock-task-id"

    mocker.patch("backend_app.ingest_docs_task.delay", return_value=mock_task)
    mocker.patch("backend_app.summarize_document_task.delay", return_value=mock_task)

    mock_workflow = MagicMock()
    mock_workflow.apply_async.return_value = mock_task
    mocker.patch("backend_app.chain", return_value=mock_workflow)

    return mock_task


@pytest.fixture
def client():
    """Create test client for FastAPI app."""
    return TestClient(app)


@pytest.fixture
def sample_documents():
    """Provide sample document data for tests."""
    return [
        {
            "filename": "doc1.txt",
            "content": "This is the first test document.",
            "document_set": "test_set",
        },
        {
            "filename": "doc2.txt",
            "content": "This is the second test document.",
            "document_set": "test_set",
        },
    ]


@pytest.fixture
def sample_embeddings():
    """Provide sample embedding vectors for tests."""
    import numpy as np

    return np.random.rand(10, 1536).tolist()


@pytest.fixture
def test_file(tmp_path):
    """Create a temporary test file."""
    file_path = tmp_path / "test.txt"
    file_path.write_text("Test content")
    return file_path


@pytest.fixture
def test_pdf_file(tmp_path):
    """Create a temporary test PDF file (placeholder)."""
    file_path = tmp_path / "test.pdf"
    file_path.write_bytes(b"%PDF-1.4\nfake pdf content")
    return file_path


# Integration test fixtures
@pytest.fixture(scope="session")
def test_db_connection():
    """
    Integration fixture for real database connection.
    Skips tests if USE_TEST_CONTAINERS is not set to true.
    """
    if not USE_TEST_CONTAINERS:
        pytest.skip("Set USE_TEST_CONTAINERS=true to run integration tests")

    # Wait for database to be ready
    import psycopg2

    max_retries = 10
    for i in range(max_retries):
        try:
            conn = psycopg2.connect(
                host="localhost",
                port=5433,
                user="test_user",
                password="test_pass",
                database="test_db",
            )
            yield conn
            conn.close()
            break
        except psycopg2.OperationalError:
            if i < max_retries - 1:
                time.sleep(2)
            else:
                pytest.skip("Could not connect to test database")


@pytest.fixture(scope="session")
def test_rabbitmq_connection():
    """
    Integration fixture for RabbitMQ connection.
    Skips tests if USE_TEST_CONTAINERS is not set to true.
    """
    if not USE_TEST_CONTAINERS:
        pytest.skip("Set USE_TEST_CONTAINERS=true to run integration tests")

    import pika

    max_retries = 10
    for i in range(max_retries):
        try:
            connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host="localhost",
                    port=5673,
                    credentials=pika.PlainCredentials("test_user", "test_pass"),
                )
            )
            yield connection
            connection.close()
            break
        except pika.exceptions.AMQPConnectionError:
            if i < max_retries - 1:
                time.sleep(2)
            else:
                pytest.skip("Could not connect to test RabbitMQ")


def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests (requires containers)"
    )
    config.addinivalue_line("markers", "unit: marks tests as unit tests (use mocks)")
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line(
        "markers", "e2e: marks tests as end-to-end tests (requires full system)"
    )
