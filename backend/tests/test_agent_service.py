import pytest

import config
from services.agent import perform_rag, run_sync_agent


@pytest.mark.unit
def test_run_sync_agent_success(mock_openai_agent):
    response = run_sync_agent("Hello")
    assert response == "Mocked LLM response"


@pytest.mark.unit
def test_run_sync_agent_no_key(mocker):
    mocker.patch.object(config, "OPENAI_API_KEY", None)
    response = run_sync_agent("Hello")
    assert "Error: OPENAI_API_KEY not found" in response


@pytest.mark.unit
def test_perform_rag_success(mock_vector_db, mock_openai_agent):
    # Mock Qdrant results via db_service mock (handled in conftest implicit patch of client)
    # We need to ensure db_service.search returns what we want.
    # Since db_service.search calls client.query_points_groups, and logic handles parsing,
    # let's mock the search method of db_service directly for simplicity,
    # OR rely on the detailed client mock in conftest.

    # Let's mock db_service.search directly to test the Agent logic in perform_rag
    # rather than testing the db_service logic again.
    from services.vector_db import db_service

    mock_results = [{"content": "important info", "metadata": {"filename": "doc.txt"}}]
    # We need to patch the method on the instance
    with pytest.helpers.mock.patch.object(db_service, "search", return_value=mock_results):
        result = perform_rag("question")
        assert result["answer"] == "Mocked LLM response"
        assert len(result["results"]) == 1
        assert result["results"][0]["content"] == "important info"


@pytest.mark.unit
def test_perform_rag_success_v2(mocker, mock_openai_agent):
    mock_results = [{"content": "important info", "metadata": {"filename": "doc.txt"}}]
    mocker.patch("services.vector_db.db_service.search", return_value=mock_results)

    result = perform_rag("question")
    assert result["answer"] == "Mocked LLM response"
