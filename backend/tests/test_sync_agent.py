import pytest
from unittest.mock import MagicMock
from sync_agent import run_sync_agent, search_documents, perform_rag
import config

def test_run_sync_agent_success(mock_openai_agent):
    response = run_sync_agent("Hello")
    assert response == "Mocked LLM response"

def test_run_sync_agent_no_key(mocker):
    mocker.patch.object(config, 'OPENAI_API_KEY', None)
    response = run_sync_agent("Hello")
    assert "Error: OPENAI_API_KEY not found" in response

def test_search_documents_empty(mock_qdrant_client):
    results = search_documents("query")
    assert results == []

def test_perform_rag_success(mock_qdrant_client, mock_openai_agent):
    # Mock Qdrant results for RAG context
    mock_hit = MagicMock()
    mock_hit.payload = {"content": "important info", "filename": "doc.txt"}
    mock_group = MagicMock()
    mock_group.hits = [mock_hit]
    mock_response = MagicMock()
    mock_response.groups = [mock_group]
    mock_qdrant_client.query_points_groups.return_value = mock_response

    result = perform_rag("question")
    assert result["answer"] == "Mocked LLM response"
    assert len(result["results"]) == 1
    assert result["results"][0]["content"] == "important info"
