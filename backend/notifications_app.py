import asyncio
import logging
import time
from collections import deque
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Query

# Internal Imports
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

# Common imports
from common import NotificationRequest, get_current_user

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Notifications service starting...")
    yield
    # Shutdown
    logger.info("Notifications service shutting down...")


app = FastAPI(lifespan=lifespan)


@app.get("/health")
def health_check():
    return {"status": "ok"}


# Notification Queue for Polling
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
            self.queue.append({"id": self.last_id, "timestamp": time.time(), "data": message})
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


@app.get("/poll")
async def poll_notifications(
    since_id: int = Query(0),
    current_user: dict = Depends(get_current_user),
):
    """
    Long-polling endpoint for notifications.
    Waits up to 20 seconds for new messages since the given ID.
    """
    messages = await notification_queue.get_since(since_id, timeout=20.0)
    return {"messages": messages}


@app.post("/internal/notify")
async def notify_endpoint(notification: NotificationRequest):
    logger.info(f"Notification: {notification.type} for {notification.filename}")

    if notification.status == "completed" and notification.result:
        try:
            from database import save_summary

            save_summary(notification.filename, notification.result)
        except Exception as e:
            logger.error(f"DB Error: {e}")

    await notification_queue.push(notification.dict())
    return {"status": "ok"}


# Removed endpoints (not supported in serverless)
# @app.websocket("/ws") - Not supported by Vercel
# @app.get("/sse") - Not supported by Vercel
