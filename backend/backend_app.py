import os
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect

from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List
from celery.result import AsyncResult
from sync_agent import run_sync_agent, search_documents, perform_rag
from async_tasks import check_knowledge_base, answer_question, ingest_docs_task, summarize_document_task, app as celery_app
from celery import chain
import logging
from contextlib import asynccontextmanager
from file_watcher import start_watching
import os
# Import needed for listing documents - assuming we add a helper or do it here
from async_tasks import qdrant_client
from qdrant_client.http.models import Filter, FieldCondition, MatchValue 
from summarizer import summarize_document 
from database import init_db, get_summary, get_all_summaries
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import config 

os.environ["USE_NNPACK"] = "0"

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Directory to monitor
MONITORED_DIR = "/data/monitored"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up...")
    init_db()
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

# Mount static files
if not os.path.exists(MONITORED_DIR):
    os.makedirs(MONITORED_DIR)
app.mount("/agent/files", StaticFiles(directory=MONITORED_DIR), name="files")

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
    limit: int = 10

class SummarizeRequest(BaseModel):
    filename: str

class NotificationRequest(BaseModel):
    type: str
    filename: str
    status: str
    result: str

class SummaryQARequest(BaseModel):
    filename: str
    question: str

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to socket: {e}")

manager = ConnectionManager()

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
    logger.info(f"Received search request: {request.prompt} (limit={request.limit})")
    try:
        result = perform_rag(request.prompt, request.limit)
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

@app.post("/agent/summarize")
def summarize_document_endpoint(request: SummarizeRequest):
    logger.info(f"Received async summarization request for: {request.filename}")
    try:
        # Check if filename is path or just name. The watcher sends full path usually, 
        # but the request might just send what's in the DB.
        # If it's an absolute path, use it. If not, join with MONITORED_DIR.
        filepath = request.filename
        if not os.path.isabs(filepath):
             filepath = os.path.join(MONITORED_DIR, request.filename)
             
        # Trigger Async Task
        # We need to pass the backend URL so the worker can call us back
        # In Docker, 'backend' is the hostname. Port is 8000 internal.
        notify_url = f"{config.API_URL}/internal/notify"
        
        task = summarize_document_task.delay(filepath, notify_url)
        return {"task_id": task.id, "message": "Summarization started"}
        
    except Exception as e:
        logger.error(f"Error triggering summarization for {request.filename}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We just keep it open. Validated receiving not needed for now.
            await websocket.receive_text() 
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
             manager.disconnect(websocket)
        except:
            pass

@app.post("/internal/notify")
async def notify_endpoint(notification: NotificationRequest):
    logger.info(f"Received notification from worker: {notification.type} for {notification.filename}")
    await manager.broadcast(notification.dict())
    return {"status": "ok"}

@app.get("/agent/summaries")
def get_summaries_history():
    try:
        data = get_all_summaries()
        return {"summaries": data}
    except Exception as e:
        logger.error(f"Error fetching summaries: {e}")
        return {"summaries": []}

@app.post("/agent/summary_qa")
def summary_qa_endpoint(request: SummaryQARequest):
    """
    Answer questions based on a specific summary history.
    """
    logger.info(f"QA on summary for {request.filename}: {request.question}")
    try:
        # 1. Get summary from DB
        # We might need to match partial filename if headers differ, but let's try exact first
        # OR if filename sent is just basename vs full path.
        # Let's try to match logic: existing DB stores what task sent.
        
        # Try finding by basename if full path provided or vice versa could be complex.
        # For now, simplistic exact match or basename match.
        
        summary_record = get_summary(request.filename)
        if not summary_record:
            # Try basename
            # summary_record = get_summary(os.path.basename(request.filename))
            pass
            
        if not summary_record:
             return {"answer": "Summary not found. Please summarize the document first."}
             
        summary_text = summary_record['summary_text']
        
        # 2. RAG-like QA but just on this text
        llm = ChatOpenAI(
            api_key=config.OPENAI_API_KEY,
            base_url=config.OPENAI_API_BASE,
            model=config.OPENAI_MODEL
        )
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an assistant answering questions based oNLY on the provided summary."),
            ("user", "Summary:\n{summary}\n\nQuestion: {question}")
        ])
        
        chain = prompt | llm | StrOutputParser()
        answer = chain.invoke({"summary": summary_text, "question": request.question})
        
        return {"answer": answer}

    except Exception as e:
        logger.error(f"Error in Summary QA: {e}")
        raise HTTPException(status_code=500, detail=str(e))
