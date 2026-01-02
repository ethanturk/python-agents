import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
import sys
import os
import tempfile

# Set up test environment
os.environ["MONITORED_DIR"] = tempfile.mkdtemp()
os.environ["QDRANT_HOST"] = "localhost"
os.environ["OPENAI_API_KEY"] = "sk-test-key"
os.environ["QDRANT_COLLECTION_NAME"] = "test-documents"
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
def mock_qdrant_client(mocker):
    mock_client = MagicMock()
    mock_client.scroll.return_value = ([], None)
    mock_group = MagicMock()
    mock_group.hits = []
    mock_response = MagicMock()
    mock_response.groups = [mock_group]
    mock_client.query_points_groups.return_value = mock_response
    
    # Patch the client inside the service
    mocker.patch('services.vector_db.VectorDBService.client', mock_client)
    # Also patch the global qdrant_client if used directly (legacy check)
    mocker.patch('services.vector_db.QdrantClient', return_value=mock_client)
    
    # Patch the global db_service instance's client attribute directly to be safe
    from services.vector_db import db_service
    db_service.client = mock_client
    
    return mock_client

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
