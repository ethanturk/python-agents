"""
Vercel serverless function handler for Agent API.

This module wraps the agent_app FastAPI app with Mangum to make it compatible
with Vercel's serverless function runtime.
"""

import logging
import sys
from pathlib import Path

from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException
from mangum import Mangum

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(backend_dir))

# Local imports
from .models import AgentRequest, SearchRequest, TaskResponse
from .service import perform_rag, run_qa_agent, run_sync_agent
from common import get_current_user
from services.queue_service import init_queue_service

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Agent service starting...")
    yield
    # Shutdown
    logger.info("Agent service shutting down...")


app = FastAPI(lifespan=lifespan)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/agent/sync", dependencies=[Depends(get_current_user)])
def run_sync(request: AgentRequest):
    logger.info(f"Received sync agent request: {request.prompt}")
    return {"response": run_sync_agent(request.prompt)}


@app.post("/agent/async", dependencies=[Depends(get_current_user)])
async def run_async(request: AgentRequest):
    """
    Submit async agent task to queue service.
    """
    queue = init_queue_service()

    try:
        task_id = await queue.submit_task("agent_async", {"prompt": request.prompt})
        return {"task_id": task_id}
    except Exception as e:
        logger.error(f"Failed to submit task: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit task to queue: {str(e)}",
        )


@app.get("/agent/status/{task_id}", response_model=TaskResponse)
async def get_status(task_id: str):
    """
    Get status of async task from queue service.
    """
    queue = init_queue_service()

    try:
        status = await queue.get_task_status(task_id)
        return TaskResponse(
            task_id=task_id,
            status=status.get("status", "unknown"),
            result=status.get("result"),
        )
    except Exception as e:
        logger.error(f"Failed to get task status: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get task status: {str(e)}",
        )


@app.post("/agent/search", dependencies=[Depends(get_current_user)])
def search_documents_endpoint(request: SearchRequest):
    """
    Search documents using RAG.
    """
    logger.info(f"Search request: {request.prompt}")
    result = perform_rag(request.prompt, request.limit, request.document_set or "all")
    return result


# Vercel serverless handler
handler = Mangum(app, lifespan="off")
