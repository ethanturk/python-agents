from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from celery.result import AsyncResult
from sync_agent import run_sync_agent

from async_tasks import check_knowledge_base, answer_question, ingest_docs_task, search_docs_sync, app as celery_app
from celery import chain
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

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
def search_documents(request: SearchRequest):
    logger.info(f"Received search request: {request.prompt}")
    try:
        results = search_docs_sync(request.prompt)
        return {"results": results}
    except Exception as e:
        logger.error(f"Error executing search: {e}")
        raise HTTPException(status_code=500, detail=str(e))
