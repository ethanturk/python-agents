import pytest
from fastapi.testclient import TestClient

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_run_sync_agent(client, mock_openai_agent):
    response = client.post("/agent/sync", json={"prompt": "Hello"})
    assert response.status_code == 200
    assert "response" in response.json()
    assert response.json()["response"] == "Mocked LLM response"

def test_run_async_agent(client, mock_celery_task):
    response = client.post("/agent/async", json={"prompt": "Research task"})
    assert response.status_code == 200
    assert response.json() == {"task_id": "mock-task-id"}

def test_ingest_documents(client, mock_celery_task):
    files = [{"filename": "test.txt", "content": "test content"}]
    response = client.post("/agent/ingest", json={"files": files})
    assert response.status_code == 200
    assert response.json() == {"task_id": "mock-task-id"}

def test_list_documents_empty(client, mock_qdrant_client):
    response = client.get("/agent/documents")
    assert response.status_code == 200
    assert response.json() == {"documents": []}

def test_search_documents(client, mock_qdrant_client, mock_openai_agent):
    # Mock Qdrant response with some data
    mock_hit = MagicMock()
    mock_hit.payload = {"content": "test content", "filename": "test.txt"}
    
    mock_group = MagicMock()
    mock_group.hits = [mock_hit]
    
    mock_response = MagicMock()
    mock_response.groups = [mock_group]
    
    mock_qdrant_client.query_points_groups.return_value = mock_response

    response = client.post("/agent/search", json={"prompt": "test query", "limit": 5})
    assert response.status_code == 200
    assert "answer" in response.json()
    assert "results" in response.json()
    
# Import MagicMock for the test above
from unittest.mock import MagicMock
