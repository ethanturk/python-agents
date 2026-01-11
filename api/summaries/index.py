"""
Vercel serverless function handler for Summaries API.

This module wraps the summaries_app FastAPI app with Mangum to make it compatible
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
from .models import SearchQARequest, SummarizeRequest, SummaryQARequest
from .service import (
    get_summaries,
    search_qa,
    summarize_document,
    summary_qa,
)
from common import get_current_user

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    logger.info("Summaries service starting...")
    yield
    # Shutdown
    logger.info("Summaries service shutting down...")


app = FastAPI(lifespan=lifespan)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/agent/summaries", dependencies=[Depends(get_current_user)])
def get_summaries_history():
    return {"summaries": get_summaries()}


@app.post("/agent/summary_qa", dependencies=[Depends(get_current_user)])
def summary_qa_endpoint(request: SummaryQARequest):
    return summary_qa(request.filename, request.question)


@app.post("/agent/search_qa", dependencies=[Depends(get_current_user)])
def search_qa_endpoint(request: SearchQARequest):
    return search_qa(request.question, request.context_results)


@app.post("/agent/summarize", dependencies=[Depends(get_current_user)])
async def summarize_document_endpoint(request: SummarizeRequest):
    """
    Submit document summarization task to queue service.
    """
    try:
        result = await summarize_document(request.filename)
        return result
    except Exception as e:
        logger.error(f"Failed to submit summarization task: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit summarization task: {str(e)}",
        )


# Vercel serverless handler
handler = Mangum(app, lifespan="off")
