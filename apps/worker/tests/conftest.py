import asyncio
import os
import sys
import tempfile
from unittest.mock import MagicMock

import pytest

# Add worker to path so we can import modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set up test environment
os.environ.setdefault("MONITORED_DIR", tempfile.mkdtemp())
os.environ.setdefault(
    "DATABASE_CONN_STRING",
    "postgresql://test_user:test_pass@localhost:5433/test_db",  # pragma: allowlist secret
)
os.environ.setdefault("OPENAI_API_KEY", "sk-test-key")
os.environ.setdefault("OPENAI_API_BASE", "https://api.openai.com/v1")
os.environ.setdefault("OPENAI_MODEL", "gpt-4o-mini")
os.environ.setdefault("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
os.environ.setdefault("OPENAI_EMBEDDING_DIMENSIONS", "1536")
os.environ.setdefault("VECTOR_TABLE_NAME", "test_documents")
os.environ.setdefault("CELERY_QUEUE_NAME", "test-queue")
os.environ.setdefault(
    "CELERY_BROKER_URL",
    "amqp://test_user:test_pass@localhost:5673//",  # pragma: allowlist secret
)
os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_KEY", "test-key")  # pragma: allowlist secret


# Check if we're running with test containers
USE_TEST_CONTAINERS = os.getenv("USE_TEST_CONTAINERS", "false").lower() == "true"

if not USE_TEST_CONTAINERS:
    # Mock nest_asyncio to prevent conflicts
    sys.modules["nest_asyncio"] = MagicMock()

    # Mock docling and heavy dependencies
    sys.modules["docling"] = MagicMock()
    sys.modules["docling.datamodel"] = MagicMock()
    sys.modules["docling.datamodel.base_models"] = MagicMock()
    sys.modules["docling.datamodel.pipeline_options"] = MagicMock()
    sys.modules["docling.document_converter"] = MagicMock()
    sys.modules["docling.backend"] = MagicMock()
    sys.modules["docling.backend.pypdfium2_backend"] = MagicMock()
    sys.modules["docling.pipeline.vlm_pipeline"] = MagicMock()

    # Mock supabase client
    sys.modules["supabase"] = MagicMock()
    sys.modules["postgrest"] = MagicMock()
    sys.modules["gotrue"] = MagicMock()
    sys.modules["storage3"] = MagicMock()


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

    # Mock Celery task delays
    mocker.patch("async_tasks.ingest_docs_task.delay", return_value=mock_task)
    mocker.patch("async_tasks.summarize_document_task.delay", return_value=mock_task)

    return mock_task


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
