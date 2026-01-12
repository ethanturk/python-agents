"""Tests for queue service."""

import pytest
from backend.services.queue_service import (
    MockQueueService,
    get_queue_service,
)


@pytest.mark.asyncio
async def test_mock_queue_submit():
    """Test submitting task to mock queue."""
    queue = MockQueueService()
    task_id = await queue.submit_task("test_task", {"data": "test"})
    assert task_id is not None
    assert isinstance(task_id, str)


@pytest.mark.asyncio
async def test_mock_queue_status():
    """Test getting task status from mock queue."""
    queue = MockQueueService()
    task_id = await queue.submit_task("test_task", {"data": "test"})
    status = await queue.get_task_status(task_id)
    assert status["task_id"] == task_id
    assert status["status"] == "completed"


@pytest.mark.asyncio
async def test_mock_queue_cancel():
    """Test cancelling task in mock queue."""
    queue = MockQueueService()
    task_id = await queue.submit_task("test_task", {"data": "test"})
    cancelled = await queue.cancel_task(task_id)
    assert cancelled is True


def test_get_queue_service_default():
    """Test getting default (mock) queue service."""
    queue = get_queue_service()
    assert isinstance(queue, MockQueueService)
