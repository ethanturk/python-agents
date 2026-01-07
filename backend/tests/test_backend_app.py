import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock


@pytest.mark.unit
def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.unit
def test_run_sync_agent(client, mock_openai_agent):
    response = client.post("/agent/sync", json={"prompt": "Hello"})
    assert response.status_code == 200
    assert "response" in response.json()
    assert response.json()["response"] == "Mocked LLM response"


@pytest.mark.unit
def test_run_async_agent(client, mock_celery_task):
    response = client.post("/agent/async", json={"prompt": "Research task"})
    assert response.status_code == 200
    assert response.json() == {"task_id": "mock-task-id"}


@pytest.mark.unit
def test_ingest_documents(client, mock_celery_task):
    files = [{"filename": "test.txt", "content": "test content"}]
    response = client.post("/agent/ingest", json={"files": files})
    assert response.status_code == 200
    assert response.json() == {"task_id": "mock-task-id"}


@pytest.mark.unit
def test_list_documents_empty(client, mock_vector_db):
    response = client.get("/agent/documents")
    assert response.status_code == 200
    assert response.json() == {"documents": []}


@pytest.mark.unit
def test_search_documents(client, mock_vector_db, mock_openai_agent):
    # Mock db_service.search outcome for integration test
    # We patch the service method to return a list of dicts as expected by the endpoint
    # The endpoint calls perform_rag which calls db_service.search

    # Actually, perform_rag is called.
    # We can mock perform_rag directly to test the endpoint, OR mock the DB service.
    # Mocking perform_rag is cleaner for testing the API layer.

    with pytest.helpers.mock.patch(
        "backend_app.perform_rag", return_value={"answer": "Mocked", "results": []}
    ):
        response = client.post("/agent/search", json={"prompt": "test query", "limit": 5})
        assert response.status_code == 200
        assert "answer" in response.json()


@pytest.mark.unit
def test_search_qa_endpoint(client, mock_openai_agent):
    payload = {
        "question": "What is the capital?",
        "context_results": [
            {"metadata": {"filename": "doc1.txt"}, "content": "The capital of France is Paris."}
        ],
    }
    # Mock internal run_qa_agent
    with pytest.helpers.mock.patch("backend_app.run_qa_agent", return_value="Mocked LLM response"):
        response = client.post("/agent/search_qa", json=payload)
        assert response.status_code == 200
        assert response.json() == {"answer": "Mocked LLM response"}
