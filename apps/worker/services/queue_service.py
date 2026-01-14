"""
Queue service abstraction layer for serverless deployments.

This module provides a unified interface for queue services (AWS SQS, Azure Queue Storage, etc.)
to replace Celery in serverless deployments.
"""

import asyncio
import json
import logging
import os
from functools import wraps
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)


def retry_with_backoff(
    max_retries: int = 3, base_delay: float = 1.0, max_delay: float = 10.0
):
    """Decorator for retrying operations with exponential backoff."""

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_error: Optional[Exception] = None
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    if attempt < max_retries - 1:
                        delay = min(base_delay * (2**attempt), max_delay)
                        logger.warning(
                            f"Attempt {attempt + 1}/{max_retries} failed: {e}. Retrying in {delay}s..."
                        )
                        await asyncio.sleep(delay)
                    else:
                        logger.error(f"All {max_retries} attempts failed: {e}")
                        raise last_error
            raise RuntimeError("Unexpected error in retry logic")

        return wrapper

    return decorator


class QueueService:
    """
    Abstract base class for queue service implementations.
    """

    async def submit_task(self, task_type: str, payload: Dict[str, Any]) -> str:
        """
        Submit a task to the queue.

        Args:
            task_type: Type of task (e.g., "ingest", "summarize")
            payload: Task data

        Returns:
            Task ID for tracking
        """
        raise NotImplementedError

    async def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        Get status of a task.

        Args:
            task_id: Task ID

        Returns:
            Task status info with keys: status, result, error
        """
        raise NotImplementedError

    async def cancel_task(self, task_id: str) -> bool:
        """
        Cancel a task.

        Args:
            task_id: Task ID

        Returns:
            True if cancelled, False otherwise
        """
        raise NotImplementedError


class SQSService(QueueService):
    """
    AWS SQS implementation of queue service.
    """

    def __init__(self):
        self.queue_url = os.getenv("AWS_SQS_QUEUE_URL")
        if not self.queue_url:
            logger.warning("AWS_SQS_QUEUE_URL not configured")

    async def submit_task(self, task_type: str, payload: Dict[str, Any]) -> str:
        if not self.queue_url:
            raise RuntimeError("SQS not configured")

        import boto3

        sqs = boto3.client("sqs")

        message_body = {"task_type": task_type, "payload": payload}

        response = sqs.send_message(
            QueueUrl=self.queue_url,
            MessageBody=message_body,
        )

        task_id = response["MessageId"]
        logger.info(f"Submitted task {task_type} with ID {task_id}")
        return task_id

    async def get_task_status(self, task_id: str) -> Dict[str, Any]:
        # SQS doesn't have built-in task status tracking
        # This would need a separate status tracking mechanism
        return {
            "status": "queued",
            "task_id": task_id,
            "message": "Status tracking not implemented for SQS",
        }

    async def cancel_task(self, task_id: str) -> bool:
        logger.warning(f"Cancel not implemented for task {task_id}")
        return False


class AzureQueueService(QueueService):
    """
    Azure Queue Storage implementation of queue service.
    Supports per-client queue isolation via CLIENT_ID environment variable.
    Queue naming convention: {CLIENT_ID}-tasks
    """

    MAX_MESSAGE_SIZE = 64 * 1024  # 64KB Azure Queue limit

    def __init__(self):
        self.connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
        self.client_id = os.getenv("CLIENT_ID", "default").lower()
        self.queue_name = f"{self.client_id}-tasks"
        self._queue_ensured = False

        if not self.connection_string:
            logger.warning("AZURE_STORAGE_CONNECTION_STRING not configured")
        else:
            # Ensure queue exists on initialization
            self._ensure_queue_exists()

        logger.info(
            f"AzureQueueService initialized for client '{self.client_id}' with queue '{self.queue_name}'"
        )

    def _ensure_queue_exists(self) -> None:
        """Create the queue if it doesn't exist."""
        if self._queue_ensured or not self.connection_string:
            return

        try:
            from azure.storage.queue import QueueServiceClient
            from azure.core.exceptions import ResourceExistsError

            queue_service = QueueServiceClient.from_connection_string(
                self.connection_string
            )
            queue_client = queue_service.get_queue_client(self.queue_name)

            try:
                queue_client.create_queue()
                logger.info(f"Created queue '{self.queue_name}'")
            except ResourceExistsError:
                logger.debug(f"Queue '{self.queue_name}' already exists")

            self._queue_ensured = True
        except Exception as e:
            logger.error(f"Failed to ensure queue exists: {e}")

    def _validate_message_size(self, message: str) -> None:
        """Validate message is under 64KB limit."""
        message_size = len(message.encode("utf-8"))
        if message_size > self.MAX_MESSAGE_SIZE:
            logger.warning(
                f"Message size {message_size} bytes exceeds Azure Queue limit of {self.MAX_MESSAGE_SIZE} bytes"
            )
            raise ValueError(
                f"Message too large: {message_size} bytes (max {self.MAX_MESSAGE_SIZE} bytes)"
            )

    @retry_with_backoff(max_retries=3, base_delay=1.0, max_delay=10.0)
    async def submit_task(self, task_type: str, payload: Dict[str, Any]) -> str:
        if not self.connection_string:
            raise RuntimeError("Azure Queue not configured")

        import uuid
        import json

        from azure.storage.queue import QueueServiceClient

        queue_client = QueueServiceClient.from_connection_string(self.connection_string)
        queue_client = queue_client.get_queue_client(self.queue_name)

        task_id = str(uuid.uuid4())
        message = json.dumps({"task_type": task_type, "payload": payload})

        self._validate_message_size(message)
        queue_client.send_message(task_id + "|" + message)
        logger.info(f"Submitted task {task_type} with ID {task_id}")
        return task_id

    @retry_with_backoff(max_retries=3, base_delay=1.0, max_delay=10.0)
    async def receive_messages(
        self, max_messages: int = 10, visibility_timeout: int = 30
    ) -> list:
        """Receive messages from the queue."""
        if not self.connection_string:
            raise RuntimeError("Azure Queue not configured")

        from azure.storage.queue import QueueServiceClient

        queue_client = QueueServiceClient.from_connection_string(self.connection_string)
        queue_client = queue_client.get_queue_client(self.queue_name)

        messages = queue_client.receive_messages(
            messages_per_page=max_messages, visibility_timeout=visibility_timeout
        )
        return list(messages)

    @retry_with_backoff(max_retries=3, base_delay=1.0, max_delay=10.0)
    async def delete_message(self, message) -> None:
        """Delete a message from the queue."""
        if not self.connection_string:
            raise RuntimeError("Azure Queue not configured")

        from azure.storage.queue import QueueServiceClient

        queue_client = QueueServiceClient.from_connection_string(self.connection_string)
        queue_client = queue_client.get_queue_client(self.queue_name)

        queue_client.delete_message(message)

    async def get_task_status(self, task_id: str) -> Dict[str, Any]:
        # Azure Queue doesn't have built-in task status tracking
        # This would need a separate status tracking mechanism
        return {
            "status": "queued",
            "task_id": task_id,
            "message": "Status tracking not implemented for Azure Queue",
        }

    async def cancel_task(self, task_id: str) -> bool:
        logger.warning(f"Cancel not implemented for task {task_id}")
        return False


class MockQueueService(QueueService):
    """
    Mock queue service for development/testing.
    """

    async def submit_task(self, task_type: str, payload: Dict[str, Any]) -> str:
        import uuid

        task_id = str(uuid.uuid4())
        logger.info(
            f"[MOCK] Submitted task {task_type} with ID {task_id}, payload: {payload}"
        )
        return task_id

    async def get_task_status(self, task_id: str) -> Dict[str, Any]:
        logger.info(f"[MOCK] Getting status for task {task_id}")
        return {"status": "completed", "task_id": task_id, "result": "mock_result"}

    async def cancel_task(self, task_id: str) -> bool:
        logger.info(f"[MOCK] Cancelling task {task_id}")
        return True


def get_queue_service() -> QueueService:
    """
    Get the configured queue service implementation.

    Returns:
        QueueService instance
    """
    provider = os.getenv("QUEUE_PROVIDER", "mock").lower()

    if provider == "sqs":
        logger.info("Using AWS SQS queue service")
        return SQSService()
    elif provider == "azure":
        logger.info("Using Azure Queue service")
        return AzureQueueService()
    else:
        logger.info("Using mock queue service")
        return MockQueueService()


queue_service: Optional[QueueService] = None


def init_queue_service():
    """
    Initialize the queue service singleton.
    """
    global queue_service
    if queue_service is None:
        queue_service = get_queue_service()
    return queue_service
