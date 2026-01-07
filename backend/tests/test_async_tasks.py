from unittest.mock import MagicMock

import pytest

from async_tasks import (
    answer_question,
    check_knowledge_base,
    ingest_docs_task,
    summarize_document_task,
)


@pytest.fixture
def mock_async_deps(mocker):
    # Mock external classes used in async_tasks
    mock_agent = MagicMock()
    mock_agent.run_sync.return_value.output = "Mocked Agent Output"
    mocker.patch("async_tasks.Agent", return_value=mock_agent)
    return mock_agent


@pytest.mark.unit
def test_check_knowledge_base(mock_async_deps, mocker):
    mocker.patch("async_tasks.os.path.exists", return_value=True)
    mock_async_deps.run_sync.return_value.output = "YES"
    result = check_knowledge_base("input")
    assert "user_input" in result
    assert "kb_location" in result


@pytest.mark.unit
def test_answer_question(mock_async_deps, mocker):
    context = {"user_input": "Question", "kb_location": "dummy.txt"}
    result = answer_question(context)
    # The logic is simplified in async_tasks.py to just return "Answer is 42" logic or similar
    # In my refactor I changed it to: agent.run_sync(user_input).output with prompt containing "42"
    assert "Mocked Agent Output" in result


@pytest.mark.unit
def test_ingest_docs_task(mocker):
    # Mock ingestion_service
    mock_ingestion = mocker.patch("async_tasks.ingestion_service")
    mock_ingestion.process_file.return_value = "Indexed doc.pdf: 1 chunks."

    files = [{"filename": "doc.pdf", "content": b"data"}]
    result = ingest_docs_task(files)

    assert "Indexed doc.pdf" in result
    mock_ingestion.process_file.assert_called_once()


@pytest.mark.unit
def test_summarize_document_task(mocker):
    mocker.patch("async_tasks.summarize_document", return_value="Summary Result")
    mock_httpx = mocker.patch("async_tasks.httpx.Client")

    import base64

    content = base64.b64encode(b"data").decode()

    result = summarize_document_task("doc.pdf", content, "http://callback")

    assert result == "Summary Result"
    mock_httpx.return_value.__enter__.return_value.post.assert_called_with(
        "http://callback",
        json={
            "type": "summary_complete",
            "filename": "doc.pdf",
            "status": "completed",
            "result": "Summary Result",
        },
    )
