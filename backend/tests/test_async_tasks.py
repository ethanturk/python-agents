import pytest
from unittest.mock import MagicMock, ANY
from async_tasks import check_knowledge_base, answer_question, ingest_docs_task, summarize_document_task
import config

@pytest.fixture
def mock_async_deps(mocker):
    # Mock external classes used in async_tasks
    mocker.patch('async_tasks.QdrantClient', return_value=MagicMock())
    mocker.patch('async_tasks.OpenAI', return_value=MagicMock())
    mocker.patch('async_tasks.DocumentConverter', return_value=MagicMock())
    
    mock_agent = MagicMock()
    mock_agent.run_sync.return_value.output = "Mocked Agent Output"
    mocker.patch('async_tasks.Agent', return_value=mock_agent)
    
    return mock_agent

def test_check_knowledge_base(mock_async_deps, mocker):
    mocker.patch('async_tasks.os.path.exists', return_value=True)
    # Mock agent response to be YES
    mock_async_deps.run_sync.return_value.output = "YES"
    
    result = check_knowledge_base("input")
    assert result["step1_decision"] == "YES"
    assert result["kb_location"] == "existing_kb.txt"

def test_answer_question(mock_async_deps, mocker):
    context = {"user_input": "Question", "kb_location": "dummy.txt"}
    mocker.patch("builtins.open", mocker.mock_open(read_data="KB Content"))
    
    result = answer_question(context)
    assert "Answer: Mocked Agent Output" in result

def test_ingest_docs_task(mocker):
    mock_qdrant = MagicMock()
    mock_qdrant.count.return_value.count = 0
    mocker.patch('async_tasks.qdrant_client', mock_qdrant)
    
    mock_openai = MagicMock()
    mock_openai.embeddings.create.return_value.data = [MagicMock(embedding=[0.1]*1536)]
    mocker.patch('async_tasks.openai_client', mock_openai)
    
    # Mock Docling converter
    mock_converter = MagicMock()
    mock_converter.convert.return_value.document.export_to_markdown.return_value = "Content"
    mocker.patch('async_tasks.get_docling_converter', return_value=mock_converter)

    files = [{"filename": "doc.pdf", "content": b"data"}]
    result = ingest_docs_task(files)
    
    assert "Indexed doc.pdf" in result
    mock_qdrant.upsert.assert_called()

def test_summarize_document_task(mocker):
    mocker.patch('async_tasks.summarize_document', return_value="Summary Result")
    mock_httpx = mocker.patch('async_tasks.httpx.Client')
    
    import base64
    content = base64.b64encode(b"data").decode()
    
    result = summarize_document_task("doc.pdf", content, "http://callback")
    
    assert result == "Summary Result"
    mock_httpx.return_value.__enter__.return_value.post.assert_called_with(
        "http://callback", 
        json={"type": "summary_complete", "filename": "doc.pdf", "status": "completed", "result": "Summary Result"}
    )
