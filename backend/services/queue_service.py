"""
Queue service abstraction layer for serverless deployments.

This module provides a unified interface for queue services (AWS SQS, Azure Queue Storage, etc.)
to replace Celery in serverless deployments.
"""

import logging
from typing import Any, Dict, Optional
import os

logger = logging.getLogger(__name__)


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
    """

    def __init__(self):
        self.connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
        self.queue_name = os.getenv("AZURE_QUEUE_NAME", "tasks")

        if not self.connection_string:
            logger.warning("AZURE_STORAGE_CONNECTION_STRING not configured")

    async def submit_task(self, task_type: str, payload: Dict[str, Any]) -> str:
        if not self.connection_string:
            raise RuntimeError("Azure Queue not configured")

        import uuid
        import json

        from azure.storage.queue import QueueServiceClient

        queue_client = QueueServiceClient.from_connection_string(
            self.connection_string, self.queue_name
        )

        task_id = str(uuid.uuid4())
        message = json.dumps({"task_type": task_type, "payload": payload})

        queue_client.send_message(task_id + "|" + message)
        logger.info(f"Submitted task {task_type} with ID {task_id}")
        return task_id

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
        logger.info(f"[MOCK] Submitted task {task_type} with ID {task_id}, payload: {payload}")
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
