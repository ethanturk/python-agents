from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from celery.result import AsyncResult
from sync_agent import run_sync_agent, search_documents, perform_rag
from async_tasks import check_knowledge_base, answer_question, ingest_docs_task, app as celery_app
from celery import chain
import logging
from contextlib import asynccontextmanager
from file_watcher import start_watching
import os
# Import needed for listing documents - assuming we add a helper or do it here
from async_tasks import qdrant_client
from qdrant_client.http.models import Filter, FieldCondition, MatchValue 

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Directory to monitor
MONITORED_DIR = "/data/monitored"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up...")
    observer = start_watching(MONITORED_DIR, lambda files: ingest_docs_task.delay(files))
    yield
    # Shutdown
    observer.stop()
    observer.join()
    logger.info("Shutting down...")

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AgentRequest(BaseModel):
    prompt: str

class TaskResponse(BaseModel):
    task_id: str
    status: str
    result: str | None = None

class IngestRequest(BaseModel):
    files: list[dict] # List of {"filename": "foo.txt", "content": "..."}

class SearchRequest(BaseModel):
    prompt: str

@app.post("/agent/sync")
def run_sync(request: AgentRequest):
    logger.info(f"Received sync agent request with prompt: {request.prompt}")
    try:
        response = run_sync_agent(request.prompt)
        return {"response": response}
    except Exception as e:
        logger.error(f"Error in sync agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agent/async")
def run_async(request: AgentRequest):
    logger.info(f"Received async agent request with prompt: {request.prompt}")
    try:
        # Define the chain: Step 1 -> Step 2
        # As configured in original main.py: check_knowledge_base.s(user_input) | answer_question.s()
        workflow = chain(check_knowledge_base.s(request.prompt) | answer_question.s())
        task = workflow.apply_async()
        return {"task_id": task.id}
    except Exception as e:
        logger.error(f"Error triggering async agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/agent/status/{task_id}", response_model=TaskResponse)
def get_status(task_id: str):
    task_result = AsyncResult(task_id, app=celery_app)
    result = {
        "task_id": task_id,
        "status": task_result.status,
        "result": str(task_result.result) if task_result.ready() else None
    }
    return result

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/agent/ingest")
def ingest_documents(request: IngestRequest):
    logger.info(f"Received ingest request for {len(request.files)} files")
    try:
        task = ingest_docs_task.delay(request.files)
        return {"task_id": task.id}
    except Exception as e:
        logger.error(f"Error triggering ingest: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agent/search")
def search_documents_endpoint(request: SearchRequest):
    logger.info(f"Received search request: {request.prompt}")
    try:
        result = perform_rag(request.prompt)
        return result
    except Exception as e:
        logger.error(f"Error executing search: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/agent/documents")
def list_documents():
    """
    List all documents in the Qdrant collection.
    """
    try:
        all_points = []
        offset = None
        while True:
            result, offset = qdrant_client.scroll(
                collection_name="documents",
                limit=100,
                with_payload=True,
                with_vectors=False,
                offset=offset
            )
            all_points.extend(result)
            if offset is None:
                break
        
        docs = []
        for point in all_points:
             docs.append({
                 "id": point.id,
                 "filename": point.payload.get("filename", "unknown"),
                 "content_snippet": point.payload.get("content", "")[:200]
             })
        return {"documents": docs}
    except Exception as e:
        # Collection might not exist yet
        logger.warning(f"Error fetching documents (likely empty): {e}")
        return {"documents": []}

@app.delete("/agent/documents/{filename:path}")
def delete_document_endpoint(filename: str):
    logger.info(f"Received delete request for document: {filename}")
    try:
        qdrant_client.delete(
            collection_name="documents",
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="filename",
                        match=MatchValue(value=filename)
                    )
                ]
            )
        )
        return {"status": "success", "message": f"Deleted {filename}"}
    except Exception as e:
        logger.error(f"Error deleting document {filename}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
