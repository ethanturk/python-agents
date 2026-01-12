import asyncio
import json
import logging
import os
import signal
import sys
from io import BytesIO
from typing import Any, Dict

import httpx

import config
from services.azure_storage import azure_storage_service
from services.ingestion import ingestion_service
from services.llm import LLMService
from services.queue_service import AzureQueueService
from summarizer import summarize_document

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for sending webhook notifications on task completion."""

    def __init__(self):
        self.timeout = 30

    async def send_webhook(self, webhook_url: str, task_data: Dict[str, Any]) -> bool:
        """Send webhook notification to frontend server."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(webhook_url, json=task_data)
                response.raise_for_status()
                logger.info(f"Webhook sent successfully to {webhook_url}")
                return True
        except httpx.HTTPError as e:
            logger.error(f"Webhook failed: {e}")
            return False


class IngestionHandler:
    """Handler for document ingestion tasks."""

    def __init__(self):
        self.ingestion_service = ingestion_service

    async def execute(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Execute document ingestion task."""
        filename = payload.get("filename")
        document_set = payload.get("document_set", "default")

        logger.info(f"Starting ingestion task: {filename} in {document_set}")

        try:
            content = await azure_storage_service.download_file(filename, document_set)
            if not content:
                raise ValueError(f"Failed to download file: {filename}")

            result = await self.ingestion_service.process_file(
                filename,
                content=content,
                document_set=document_set,
            )

            logger.info(f"Ingestion completed: {filename}")
            return {"status": "completed", "result": result}
        except Exception as e:
            logger.error(f"Ingestion failed: {filename}: {e}")
            return {"status": "failed", "error": str(e)}


class SummarizationHandler:
    """Handler for document summarization tasks."""

    def __init__(self):
        pass

    async def execute(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Execute document summarization task."""
        filename = payload.get("filename")
        document_set = payload.get("document_set", "default")

        logger.info(f"Starting summarization task: {filename} in {document_set}")

        try:
            content = await azure_storage_service.download_file(filename, document_set)
            if not content:
                raise ValueError(f"Failed to download file: {filename}")

            source = BytesIO(content)
            summary = summarize_document(source, filename)

            logger.info(f"Summarization completed: {filename}")
            return {"status": "completed", "result": summary}
        except Exception as e:
            logger.error(f"Summarization failed: {filename}: {e}")
            return {"status": "failed", "error": str(e)}


class AsyncWorker:
    """Main async worker for processing queue tasks."""

    def __init__(self):
        self.client_id = os.getenv("CLIENT_ID", "default").lower()
        self.queue_name = f"{self.client_id}-tasks"
        self.polling_interval = int(os.getenv("WORKER_POLLING_INTERVAL", "5"))
        self.visibility_timeout = int(os.getenv("WORKER_VISIBILITY_TIMEOUT", "30"))
        self.max_messages = int(os.getenv("WORKER_MAX_MESSAGES", "10"))
        self.running = False
        self.shutdown_event = asyncio.Event()

        self.queue_service = AzureQueueService()
        self.notification_service = NotificationService()

        self.handlers = {
            "ingest": IngestionHandler(),
            "summarize": SummarizationHandler(),
        }

        logger.info(f"AsyncWorker initialized for client '{self.client_id}'")

    def get_handler(self, task_type: str):
        """Get handler for task type."""
        return self.handlers.get(task_type)

    async def process_message(self, message) -> None:
        """Process a single queue message."""
        try:
            message_content = message.content

            if "|" in message_content:
                task_id, json_content = message_content.split("|", 1)
            else:
                task_id = "unknown"
                json_content = message_content

            task_data = json.loads(json_content)
            task_type = task_data.get("task_type")
            payload = task_data.get("payload", {})
            webhook_url = task_data.get("webhook_url")

            logger.info(f"Processing task {task_id}: {task_type}")

            handler = self.get_handler(task_type)
            if not handler:
                logger.warning(f"Unknown task type: {task_type}")
                await self._send_failure_notification(
                    webhook_url, task_id, f"Unknown task type: {task_type}"
                )
                return

            result = await handler.execute(payload)

            notification_data = {
                "task_id": task_id,
                "task_type": task_type,
                "status": result.get("status"),
                "result": result.get("result"),
                "error": result.get("error"),
            }

            if webhook_url:
                await self.notification_service.send_webhook(
                    webhook_url, notification_data
                )

            logger.info(f"Task {task_id} completed with status: {result.get('status')}")

        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in message: {e}")
        except Exception as e:
            logger.error(f"Error processing message: {e}")

    async def _send_failure_notification(
        self, webhook_url: str, task_id: str, error: str
    ) -> None:
        """Send failure notification."""
        if webhook_url:
            notification_data = {
                "task_id": task_id,
                "status": "failed",
                "error": error,
            }
            await self.notification_service.send_webhook(webhook_url, notification_data)

    async def run(self) -> None:
        """Main worker loop."""
        logger.info(f"Worker starting for queue: {self.queue_name}")
        self.running = True

        try:
            while self.running:
                try:
                    messages = await self.queue_service.receive_messages(
                        max_messages=self.max_messages,
                        visibility_timeout=self.visibility_timeout,
                    )

                    if messages:
                        logger.info(f"Received {len(messages)} messages")

                        for message in messages:
                            await self.process_message(message)
                            await self.queue_service.delete_message(message)
                    else:
                        await asyncio.sleep(self.polling_interval)

                except Exception as e:
                    logger.error(f"Error in worker loop: {e}")
                    await asyncio.sleep(self.polling_interval)

        except asyncio.CancelledError:
            logger.info("Worker cancelled, shutting down...")
        finally:
            self.running = False
            logger.info("Worker stopped")

    async def shutdown(self) -> None:
        """Gracefully shutdown the worker."""
        logger.info("Initiating shutdown...")
        self.running = False
        self.shutdown_event.set()
        await asyncio.sleep(1)

    def setup_signal_handlers(self) -> None:
        """Setup signal handlers for graceful shutdown."""

        def handle_signal(signum, frame):
            logger.info(f"Received signal {signum}")
            loop = asyncio.get_event_loop()
            loop.create_task(self.shutdown())

        signal.signal(signal.SIGTERM, handle_signal)
        signal.signal(signal.SIGINT, handle_signal)


async def main() -> None:
    """Main entry point."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    logger.info("=" * 60)
    logger.info("Async Worker Starting")
    logger.info(f"Client ID: {os.getenv('CLIENT_ID', 'default')}")
    logger.info(f"Queue: {os.getenv('CLIENT_ID', 'default')}-tasks")
    logger.info(f"Polling Interval: {os.getenv('WORKER_POLLING_INTERVAL', '5')}s")
    logger.info(f"Visibility Timeout: {os.getenv('WORKER_VISIBILITY_TIMEOUT', '30')}s")
    logger.info("=" * 60)

    worker = AsyncWorker()
    worker.setup_signal_handlers()

    try:
        await worker.run()
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt, shutting down...")
    finally:
        await worker.shutdown()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
