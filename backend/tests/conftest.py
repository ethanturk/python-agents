import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
import sys
import os
import tempfile

# Set up test environment
os.environ["MONITORED_DIR"] = tempfile.mkdtemp()
os.environ["DATABASE_CONN_STRING"] = "postgresql://user:pass@localhost:5432/db"
os.environ["OPENAI_API_KEY"] = "sk-test-key"
os.environ["VECTOR_TABLE_NAME"] = "test-documents"
os.environ["CELERY_QUEUE_NAME"] = "test-queue"

# Mock nest_asyncio to prevent conflict with TestClient
sys.modules["nest_asyncio"] = MagicMock()
sys.modules["firebase_admin"] = MagicMock()
sys.modules["auth"] = MagicMock()

# Add backend to path so we can import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend_app import app
from auth import get_current_user

# Mock Authentication
app.dependency_overrides[get_current_user] = lambda: {"uid": "test-user", "email": "test@example.com"}

@pytest.fixture
def mock_vector_db(mocker):
    # Mock methods of the global db_service instance
    mocker.patch('services.vector_db.db_service.ensure_collection_exists', return_value=None)
    mocker.patch('services.vector_db.db_service.search', return_value=[])
    mocker.patch('services.vector_db.db_service.upsert_vectors', return_value=None)
    mocker.patch('services.vector_db.db_service.delete_document', return_value=None)
    mocker.patch('services.vector_db.db_service.list_documents', return_value=[])
    
    # Also patch psycopg2.connect to avoid actual DB attempts if initialization happens
    mocker.patch('services.vector_db.psycopg2.connect', return_value=MagicMock())
    
    from services.vector_db import db_service
    return db_service

@pytest.fixture
def mock_openai_agent(mocker):
    mock_agent = MagicMock()
    mock_result = MagicMock()
    mock_result.output = "Mocked LLM response"
    mock_agent.run_sync.return_value = mock_result
    
    # Patch Agent in services
    mocker.patch('services.agent.Agent', return_value=mock_agent)
    # Patch Agent in async_tasks
    mocker.patch('async_tasks.Agent', return_value=mock_agent)
    
    return mock_agent

@pytest.fixture
def mock_celery_task(mocker):
    mock_task = MagicMock()
    mock_task.id = "mock-task-id"
    
    mocker.patch('backend_app.ingest_docs_task.delay', return_value=mock_task)
    mocker.patch('backend_app.summarize_document_task.delay', return_value=mock_task)
    
    mock_workflow = MagicMock()
    mock_workflow.apply_async.return_value = mock_task
    mocker.patch('backend_app.chain', return_value=mock_workflow)
    
    return mock_task

@pytest.fixture
def client():
    return TestClient(app)
