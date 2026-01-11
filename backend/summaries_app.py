import logging

from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException

# Internal Imports
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

# Common imports
from common import (
    SearchQARequest,
    SummarizeRequest,
    SummaryQARequest,
    get_current_user,
)

# Service Layer
from database import get_all_summaries, get_summary, init_db
from services.agent import run_qa_agent

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
    return {"summaries": get_all_summaries()}


@app.post("/agent/summary_qa", dependencies=[Depends(get_current_user)])
def summary_qa_endpoint(request: SummaryQARequest):
    summary_record = get_summary(request.filename)
    if not summary_record:
        return {"answer": "Summary not found. Please summarize the document first."}

    return {"answer": run_qa_agent(summary_record["summary_text"], request.question)}


@app.post("/agent/search_qa", dependencies=[Depends(get_current_user)])
def search_qa_endpoint(request: SearchQARequest):
    context_str = "\n\n".join(
        [
            f"Source '{r['metadata'].get('filename', 'Unknown')}':\n{r.get('content', '')}"
            for r in request.context_results
        ]
    )
    return {"answer": run_qa_agent(context_str, request.question)}


@app.post("/agent/summarize", dependencies=[Depends(get_current_user)])
async def summarize_document_endpoint(request: SummarizeRequest):
    """
    Submit document summarization task to queue service.
    """
    from services.queue_service import init_queue_service
    from common.config import API_URL

    queue = init_queue_service()

    try:
        task_id = await queue.submit_task("summarize", {"filename": request.filename})

        webhook_url = f"{API_URL}/internal/notify"
        return {"task_id": task_id, "webhook": webhook_url}
    except Exception as e:
        logger.error(f"Failed to submit summarization task: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit summarization task: {str(e)}",
        )
