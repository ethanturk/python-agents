from io import BytesIO
from unittest.mock import MagicMock

import pytest

from summarizer import summarize_document


@pytest.fixture
def mock_document_converter(mocker):
    mock_converter = MagicMock()
    mock_result = MagicMock()
    mock_result.document.export_to_markdown.return_value = "Mocked document content"
    mock_converter.convert.return_value = mock_result

    mocker.patch("summarizer.DocumentConverter", return_value=mock_converter)
    return mock_converter


@pytest.fixture
def mock_openai_agent_summarizer(mocker):
    mock_agent = MagicMock()
    mock_result = MagicMock()
    mock_result.output = "Mocked summary"
    mock_agent.run_sync.return_value = mock_result

    mocker.patch("summarizer.Agent", return_value=mock_agent)
    return mock_agent


@pytest.mark.unit
def test_summarize_document_success(mock_document_converter, mock_openai_agent_summarizer):
    content = b"fake pdf content"
    result = summarize_document(BytesIO(content), "test.pdf")
    assert result == "Mocked summary"
    mock_document_converter.convert.assert_called_once()


@pytest.mark.unit
def test_summarize_document_xls_conversion(
    mock_document_converter, mock_openai_agent_summarizer, mocker
):
    # Mock pandas and tempfile
    mock_pd = mocker.patch("summarizer.pd")
    mock_pd.read_excel.return_value = {"Sheet1": MagicMock()}

    mock_temp = mocker.patch("summarizer.tempfile.NamedTemporaryFile")
    mock_temp.return_value.name = "/tmp/test.xlsx"

    # Mock os.path.exists and remove
    mocker.patch("summarizer.os.path.exists", return_value=True)
    mocker.patch("summarizer.os.remove")

    result = summarize_document(BytesIO(b"xls content"), "test.xls")

    assert result == "Mocked summary"
    mock_pd.read_excel.assert_called()
    # Verify it tried to convert using DocumentConverter on the temp file
    args, _ = mock_document_converter.convert.call_args
    assert args[0] == "/tmp/test.xlsx"


@pytest.mark.unit
def test_summarize_document_empty(mock_document_converter):
    mock_document_converter.convert.return_value.document.export_to_markdown.return_value = ""
    result = summarize_document(BytesIO(b"empty"), "empty.pdf")
    assert "Error: Document is empty" in result


@pytest.mark.unit
def test_summarize_document_large_split(
    mock_document_converter, mock_openai_agent_summarizer, mocker
):
    # Mock large content causing split
    long_content = "a" * 200000
    mock_document_converter.convert.return_value.document.export_to_markdown.return_value = (
        long_content
    )

    # Mock splitter to return 2 chunks
    mock_splitter = MagicMock()
    mock_splitter.split_text.return_value = ["chunk1", "chunk2"]
    mocker.patch("summarizer.RecursiveCharacterTextSplitter", return_value=mock_splitter)

    result = summarize_document(BytesIO(b"large"), "large.pdf")

    # map agent called twice, reduce agent called once = 3 calls
    assert mock_openai_agent_summarizer.run_sync.call_count >= 3
    assert result == "Mocked summary"
