import os
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, File, UploadFile, Form
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from typing import List
from celery.result import AsyncResult
from sync_agent import run_sync_agent, search_documents, perform_rag
from async_tasks import check_knowledge_base, answer_question, ingest_docs_task, summarize_document_task, app as celery_app
from celery import chain
import logging
from contextlib import asynccontextmanager
from file_watcher import start_watching
import os
from async_tasks import qdrant_client
from qdrant_client.http.models import Filter, FieldCondition, MatchValue 
from summarizer import summarize_document 
from database import init_db, get_summary, get_all_summaries, save_summary
import config 
import base64 
from fastapi import Depends
from auth import init_firebase, get_current_user

os.environ["USE_NNPACK"] = "0"

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Directory to monitor
# Directory to monitor
MONITORED_DIR = config.MONITORED_DIR

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up...")
    init_db()
    init_firebase()
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
    document_set: str | None = None

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

class SearchQARequest(BaseModel):
    question: str
    context_results: List[dict] # List of results from the search response


# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Active connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"WebSocket client disconnected. Active connections: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        logger.info(f"Broadcasting message to {len(self.active_connections)} clients: {message}")
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to socket: {e}")

manager = ConnectionManager()

@app.post("/agent/sync", dependencies=[Depends(get_current_user)])
def run_sync(request: AgentRequest):
    logger.info(f"Received sync agent request with prompt: {request.prompt}")
    try:
        response = run_sync_agent(request.prompt)
        return {"response": response}
    except Exception as e:
        logger.error(f"Error in sync agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agent/async", dependencies=[Depends(get_current_user)])
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


@app.post("/agent/ingest", dependencies=[Depends(get_current_user)])
def ingest_documents(request: IngestRequest):
    logger.info(f"Received ingest request for {len(request.files)} files")
    try:
        task = ingest_docs_task.delay(request.files)
        return {"task_id": task.id}
    except Exception as e:
        logger.error(f"Error triggering ingest: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agent/search", dependencies=[Depends(get_current_user)])
def search_documents_endpoint(request: SearchRequest):
    logger.info(f"Received search request: {request.prompt} (limit={request.limit}, set={request.document_set})")
    try:
        result = perform_rag(request.prompt, request.limit, request.document_set)
        return result
    except Exception as e:
        logger.error(f"Error executing search: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/agent/documents", dependencies=[Depends(get_current_user)])
def list_documents():
    """
    List all documents in the Qdrant collection.
    """
    try:
        all_points = []
        offset = None
        while True:
            result, offset = qdrant_client.scroll(
                collection_name=config.QDRANT_COLLECTION_NAME,
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
                 "document_set": point.payload.get("document_set", "default"),
                 "content_snippet": point.payload.get("content", "")[:200]
             })
        return {"documents": docs}
    except Exception as e:
        # Collection might not exist yet
        logger.warning(f"Error fetching documents (likely empty): {e}")
        return {"documents": []}

@app.get("/agent/documentsets", dependencies=[Depends(get_current_user)])
def list_document_sets():
    """
    List distinct document sets.
    """
    try:
        # We can use qdrant scroll to get all and unique them, or just rely on what we have.
        # Since we might have many docs, scrolling all is expensive.
        # Ideally Qdrant has a faceted search or unique value, but for now scrolling "filename" payload with a limit 
        # or just iterating might be okay if dataset is small.
        # A better approach for scalability would be to keep a separate set or use Qdrant group by?
        # Qdrant doesn't have a "get all unique values for field" API efficiently without iterating.
        
        # Let's iterate but with a high limit, assuming reasonable number of docs for this agent.
        
        sets = set()
        offset = None
        while True:
            # We only need the payload
            result, offset = qdrant_client.scroll(
                collection_name=config.QDRANT_COLLECTION_NAME,
                limit=1000,
                with_payload=["document_set"],
                with_vectors=False,
                offset=offset
            )
            for point in result:
                ds = point.payload.get("document_set")
                if ds:
                    sets.add(ds)
            
            if offset is None:
                break
        
        # Ensure "default" is always there if nothing else?
        # Or just return what we found.
        
        sorted_sets = sorted(list(sets))
        return {"document_sets": sorted_sets}
    except Exception as e:
        logger.warning(f"Error fetching document sets: {e}")
        return {"document_sets": []}

@app.delete("/agent/documents/{filename:path}", dependencies=[Depends(get_current_user)])
def delete_document_endpoint(filename: str):
    logger.info(f"Received delete request for document: {filename}")
    try:
        qdrant_client.delete(
            collection_name=config.QDRANT_COLLECTION_NAME,
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

@app.post("/agent/summarize", dependencies=[Depends(get_current_user)])
def summarize_document_endpoint(request: SummarizeRequest):
    logger.info(f"Received async summarization request for: {request.filename}")
    try:
        # Check if filename is path or just name. The watcher sends full path usually, 
        # but the request might just send what's in the DB.
        # If it's an absolute path, use it. If not, join with MONITORED_DIR.
        filepath = request.filename
        if not os.path.isabs(filepath):
             filepath = os.path.join(MONITORED_DIR, request.filename)
             
        if not os.path.exists(filepath):
             raise HTTPException(status_code=404, detail="File not found on backend")

        # Read file content
        try:
            with open(filepath, "rb") as f:
                content = f.read()
            content_b64 = base64.b64encode(content).decode('utf-8')
        except Exception as read_err:
             raise HTTPException(status_code=500, detail=f"Failed to read file: {read_err}")

        # Trigger Async Task
        # We need to pass the backend URL so the worker can call us back
        # In Docker, 'backend' is the hostname. Port is 8000 internal.
        notify_url = f"{config.API_URL}/internal/notify"
        
        task = summarize_document_task.delay(request.filename, content_b64, notify_url)
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
    
    # Save to DB if completed
    if notification.status == 'completed' and notification.result:
        try:
             logger.info(f"Saving summary to DB for: {notification.filename}")
             save_summary(notification.filename, notification.result)
             logger.info("Summary saved successfully.")
        except Exception as db_err:
             logger.error(f"Failed to save summary to DB: {db_err}")

    logger.info("Broadcasting notification...")
    await manager.broadcast(notification.dict())
    return {"status": "ok"}

@app.get("/agent/summaries", dependencies=[Depends(get_current_user)])
def get_summaries_history():
    try:
        data = get_all_summaries()
        return {"summaries": data}
    except Exception as e:
        logger.error(f"Error fetching summaries: {e}")
        return {"summaries": []}

def get_model():
    return OpenAIChatModel(
        config.OPENAI_MODEL,
        provider=OpenAIProvider(
            base_url=config.OPENAI_API_BASE,
            api_key=config.OPENAI_API_KEY
        )
    )

@app.post("/agent/summary_qa", dependencies=[Depends(get_current_user)])
def summary_qa_endpoint(request: SummaryQARequest):
    """
    Answer questions based on a specific summary history.
    """
    logger.info(f"QA on summary for {request.filename}: {request.question}")
    try:
        summary_record = get_summary(request.filename)
        if not summary_record:
            pass
            
        if not summary_record:
             logger.warning(f"Summary lookup failed for: {request.filename}. DB contents may mismatch.")
             return {"answer": "Summary not found. Please summarize the document first."}
             
        summary_text = summary_record['summary_text']
        
        # PydanticAI Agent
        agent = Agent(
            get_model(),
            system_prompt="You are an assistant answering questions based oNLY on the provided summary."
        )
        
        user_prompt = f"Summary:\n{summary_text}\n\nQuestion: {request.question}"
        
        result = agent.run_sync(user_prompt)
        
        return {"answer": result.output}

    except Exception as e:
        logger.error(f"Error in Summary QA: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agent/search_qa", dependencies=[Depends(get_current_user)])
def search_qa_endpoint(request: SearchQARequest):
    """
    Answer questions based on provided search results context.
    """
    logger.info(f"QA on Search Results: {request.question}")
    try:
        # Construct context from the provided results
        context_str = "\n\n".join([
            f"Source '{r['metadata'].get('filename', 'Unknown')}':\n{r.get('content', '')}" 
            for r in request.context_results
        ])
        
        # PydanticAI Agent
        agent = Agent(
            get_model(),
            system_prompt=(
                "You are a helpful assistant. Answer the user's question based ONLY on the following context. "
                "If the answer is not in the context, say so.\n\n"
            )
        )
        
        user_prompt = f"Context:\n{context_str}\n\nQuestion: {request.question}"
        
        result = agent.run_sync(user_prompt)
        
        return {"answer": result.output}

@app.post("/agent/upload", dependencies=[Depends(get_current_user)])
async def upload_files(
    files: List[UploadFile] = File(...),
    document_set: str = Form(...)
):
    """
    Upload one or more files to a specific document set (folder).
    """
    logger.info(f"Received upload request for {len(files)} files to document set: {document_set}")
    
    # Sanitize document set name
    import re
    import shutil
    from pathlib import Path

    sanitized_set = re.sub(r'[^a-z0-9_]', '_', document_set.lower().strip())
    # Ensure no leading/trailing underscores from replacement
    sanitized_set = sanitized_set.strip('_')
    
    if not sanitized_set:
        raise HTTPException(status_code=400, detail="Invalid document set name")

    target_dir = Path(MONITORED_DIR) / sanitized_set
    
    # Create directory if not exists
    try:
        if not target_dir.exists():
            target_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        logger.error(f"Failed to create directory {target_dir}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create document set directory: {str(e)}")

    uploaded_files = []
    
    try:
        for file in files:
            # Secure filename logic? For now assume trusted input or basic basename
            filename = Path(file.filename).name
            file_path = target_dir / filename
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            uploaded_files.append(filename)
            
    except Exception as e:
        logger.error(f"Error saving uploaded file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    return {"status": "success", "uploaded": uploaded_files, "document_set": sanitized_set}
