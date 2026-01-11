"""
Notifications service for serverless deployment.

This module provides in-memory notification queue for polling.
Uses only fastapi (no external dependencies).
"""

import asyncio
import logging
import time
from collections import deque
from typing import Optional

logger = logging.getLogger(__name__)


class NotificationQueue:
    """In-memory notification queue for long-polling."""

    def __init__(self):
        self.queue = deque(maxlen=1000)
        self.last_id = 0
        self._lock = asyncio.Lock()

    async def push(self, message: dict) -> int:
        """Add message to queue and return its ID."""
        async with self._lock:
            self.last_id += 1
            self.queue.append(
                {"id": self.last_id, "timestamp": time.time(), "data": message}
            )
            return self.last_id

    async def get_since(self, since_id: int, timeout: float = 20.0) -> list:
        """Get messages since a specific ID, waiting up to timeout seconds."""
        start = time.time()
        while time.time() - start < timeout:
            async with self._lock:
                messages = [msg for msg in self.queue if msg["id"] > since_id]
            if messages:
                return messages
            await asyncio.sleep(0.5)
        return []


notification_queue = NotificationQueue()


async def poll_notifications(since_id: int, timeout: float = 20.0) -> list:
    """
    Long-polling endpoint for notifications.
    Waits up to 20 seconds for new messages since the given ID.
    """
    messages = await notification_queue.get_since(since_id, timeout=timeout)
    return messages


async def notify(notification: dict):
    """Process a notification and add to queue."""
    logger.info(
        f"Notification: {notification.get('type')} for {notification.get('filename')}"
    )

    if notification.get("status") == "completed" and notification.get("result"):
        try:
            # Import database lazily
            import sys
            from pathlib import Path

            backend_dir = Path(__file__).resolve().parent.parent.parent
            sys_path = str(backend_dir)
            if sys_path not in sys.path:
                sys.path.insert(0, sys_path)

            from database import save_summary

            save_summary(
                notification.get("filename", ""), notification.get("result", "")
            )
        except Exception as e:
            logger.error(f"DB Error: {e}")

    await notification_queue.push(notification)
    return {"status": "ok"}
