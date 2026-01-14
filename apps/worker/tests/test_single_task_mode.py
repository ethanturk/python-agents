"""Tests for single-task execution mode (ACI)."""

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from queue_worker import (
    SingleTaskRunner,
    parse_task_data,
    process_single_task,
)


class TestParseTaskData:
    """Tests for parse_task_data function."""

    def test_parse_simple_json(self):
        """Test parsing simple JSON task data."""
        task_data = '{"task_type": "ingest", "payload": {"filename": "test.pdf"}}'
        task_id, task_type, payload, webhook_url = parse_task_data(task_data)

        assert task_id == "unknown"
        assert task_type == "ingest"
        assert payload == {"filename": "test.pdf"}
        assert webhook_url is None

    def test_parse_with_task_id_prefix(self):
        """Test parsing task data with task_id|json format."""
        task_data = 'abc123|{"task_type": "summarize", "payload": {"filename": "doc.pdf"}}'
        task_id, task_type, payload, webhook_url = parse_task_data(task_data)

        assert task_id == "abc123"
        assert task_type == "summarize"
        assert payload == {"filename": "doc.pdf"}

    def test_parse_with_webhook_url(self):
        """Test parsing task data with webhook URL."""
        task_data = json.dumps(
            {
                "task_type": "ingest",
                "payload": {"filename": "test.pdf"},
                "webhook_url": "https://example.com/webhook",
            }
        )
        task_id, task_type, payload, webhook_url = parse_task_data(task_data)

        assert task_type == "ingest"
        assert webhook_url == "https://example.com/webhook"

    def test_parse_with_task_id_in_json(self):
        """Test that task_id in JSON overrides prefix."""
        task_data = 'prefix123|{"task_type": "ingest", "task_id": "json456", "payload": {}}'
        task_id, task_type, payload, webhook_url = parse_task_data(task_data)

        assert task_id == "json456"  # JSON task_id takes precedence

    def test_parse_invalid_json_raises(self):
        """Test that invalid JSON raises ValueError."""
        with pytest.raises(ValueError, match="Invalid JSON"):
            parse_task_data("not valid json")

    def test_parse_missing_task_type_raises(self):
        """Test that missing task_type raises ValueError."""
        with pytest.raises(ValueError, match="Missing required field: task_type"):
            parse_task_data('{"payload": {"filename": "test.pdf"}}')

    def test_parse_empty_payload_defaults(self):
        """Test that missing payload defaults to empty dict."""
        task_data = '{"task_type": "ingest"}'
        task_id, task_type, payload, webhook_url = parse_task_data(task_data)

        assert payload == {}


class TestSingleTaskRunner:
    """Tests for SingleTaskRunner class."""

    @pytest.fixture
    def mock_handlers(self, mocker):
        """Mock task handlers."""
        mock_ingest = MagicMock()
        mock_ingest.execute = AsyncMock(return_value={"status": "completed", "result": "success"})

        mock_summarize = MagicMock()
        mock_summarize.execute = AsyncMock(
            return_value={"status": "completed", "result": "summary text"}
        )

        mocker.patch(
            "queue_worker.get_handlers",
            return_value={
                "ingest": mock_ingest,
                "summarize": mock_summarize,
            },
        )

        return {"ingest": mock_ingest, "summarize": mock_summarize}

    @pytest.fixture
    def mock_notification_service(self, mocker):
        """Mock notification service."""
        mock_service = MagicMock()
        mock_service.send_webhook = AsyncMock(return_value=True)
        mocker.patch(
            "queue_worker.NotificationService",
            return_value=mock_service,
        )
        return mock_service

    @pytest.mark.asyncio
    async def test_run_successful_task(self, mock_handlers, mock_notification_service):
        """Test running a successful task returns exit code 0."""
        task_data = json.dumps(
            {
                "task_type": "ingest",
                "task_id": "test-123",
                "payload": {"filename": "test.pdf"},
                "webhook_url": "https://example.com/webhook",
            }
        )

        runner = SingleTaskRunner(timeout=60)
        exit_code = await runner.run(task_data)

        assert exit_code == 0
        mock_handlers["ingest"].execute.assert_called_once_with({"filename": "test.pdf"})
        mock_notification_service.send_webhook.assert_called_once()

    @pytest.mark.asyncio
    async def test_run_failed_task(self, mock_handlers, mock_notification_service):
        """Test running a failed task returns exit code 1."""
        mock_handlers["ingest"].execute = AsyncMock(
            return_value={"status": "failed", "error": "File not found"}
        )

        task_data = json.dumps(
            {
                "task_type": "ingest",
                "task_id": "test-123",
                "payload": {"filename": "missing.pdf"},
                "webhook_url": "https://example.com/webhook",
            }
        )

        runner = SingleTaskRunner(timeout=60)
        exit_code = await runner.run(task_data)

        assert exit_code == 1
        mock_notification_service.send_webhook.assert_called_once()

    @pytest.mark.asyncio
    async def test_run_unknown_task_type(self, mock_handlers, mock_notification_service):
        """Test running unknown task type returns exit code 1."""
        task_data = json.dumps(
            {
                "task_type": "unknown_type",
                "task_id": "test-123",
                "payload": {},
            }
        )

        runner = SingleTaskRunner(timeout=60)
        exit_code = await runner.run(task_data)

        assert exit_code == 1

    @pytest.mark.asyncio
    async def test_run_timeout(self, mock_handlers, mock_notification_service):
        """Test task timeout returns exit code 1."""
        import asyncio

        # Make handler take longer than timeout
        async def slow_execute(payload):
            await asyncio.sleep(2)
            return {"status": "completed", "result": "success"}

        mock_handlers["ingest"].execute = slow_execute

        task_data = json.dumps(
            {
                "task_type": "ingest",
                "task_id": "test-123",
                "payload": {"filename": "test.pdf"},
                "webhook_url": "https://example.com/webhook",
            }
        )

        runner = SingleTaskRunner(timeout=1)  # 1 second timeout
        exit_code = await runner.run(task_data)

        assert exit_code == 1
        # Webhook should be called with failure
        call_args = mock_notification_service.send_webhook.call_args
        assert call_args[0][1]["status"] == "failed"
        assert "timeout" in call_args[0][1]["error"].lower()

    @pytest.mark.asyncio
    async def test_run_no_webhook(self, mock_handlers, mock_notification_service):
        """Test running task without webhook URL."""
        task_data = json.dumps(
            {
                "task_type": "ingest",
                "task_id": "test-123",
                "payload": {"filename": "test.pdf"},
                # No webhook_url
            }
        )

        runner = SingleTaskRunner(timeout=60)
        exit_code = await runner.run(task_data)

        assert exit_code == 0
        mock_notification_service.send_webhook.assert_not_called()

    @pytest.mark.asyncio
    async def test_run_invalid_task_data(self, mock_handlers, mock_notification_service):
        """Test running with invalid task data returns exit code 1."""
        runner = SingleTaskRunner(timeout=60)
        exit_code = await runner.run("invalid json")

        assert exit_code == 1


class TestProcessSingleTask:
    """Tests for process_single_task function."""

    @pytest.mark.asyncio
    async def test_process_single_task_success(self, mocker):
        """Test process_single_task convenience function."""
        mock_runner = MagicMock()
        mock_runner.run = AsyncMock(return_value=0)
        mocker.patch("queue_worker.SingleTaskRunner", return_value=mock_runner)

        task_data = '{"task_type": "ingest", "payload": {}}'
        exit_code = await process_single_task(task_data, timeout=120)

        assert exit_code == 0
        mock_runner.run.assert_called_once_with(task_data)

    @pytest.mark.asyncio
    async def test_process_single_task_with_custom_timeout(self, mocker):
        """Test process_single_task uses custom timeout."""
        mock_runner_class = mocker.patch("queue_worker.SingleTaskRunner")
        mock_runner_instance = MagicMock()
        mock_runner_instance.run = AsyncMock(return_value=0)
        mock_runner_class.return_value = mock_runner_instance

        task_data = '{"task_type": "ingest", "payload": {}}'
        await process_single_task(task_data, timeout=300)

        mock_runner_class.assert_called_once_with(timeout=300)
