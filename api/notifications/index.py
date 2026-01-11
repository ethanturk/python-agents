"""
Vercel serverless function handler for Notifications API.

This module wraps the notifications_app FastAPI app with Mangum to make it compatible
with Vercel's serverless function runtime.
"""

import logging
import sys
from pathlib import Path

from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, Query
from mangum import Mangum

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(backend_dir))

# Local imports
from .models import NotificationRequest
from .service import notify, poll_notifications
from common import get_current_user

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


@app.get("/poll")
async def poll_notifications_endpoint(
    since_id: int = Query(0),
    current_user: dict = Depends(get_current_user),
):
    """
    Long-polling endpoint for notifications.
    Waits up to 20 seconds for new messages since the given ID.
    """
    messages = await poll_notifications(since_id, timeout=20.0)
    return {"messages": messages}


@app.post("/internal/notify")
async def notify_endpoint(notification: NotificationRequest):
    result = await notify(notification.dict())
    return result


# Removed endpoints (not supported in serverless)
# @app.websocket("/ws") - Not supported by Vercel
# @app.get("/sse") - Not supported by Vercel


# Vercel serverless handler
handler = Mangum(app, lifespan="off")
