import os
import logging
import base64
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Form, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from celery.result import AsyncResult

# Internal Imports
import config
from auth import init_firebase, get_current_user
from database import init_db, get_all_summaries, save_summary, get_summary
from file_watcher import start_watching

# Service Layer
from services.vector_db import db_service
from services.agent import run_sync_agent, perform_rag, run_qa_agent
from services.websocket import manager
from async_tasks import ingest_docs_task, summarize_document_task, check_knowledge_base, answer_question, app as celery_app
from celery import chain

# API Models
from api.models import (
    AgentRequest, TaskResponse, IngestRequest, SearchRequest, 
    SummarizeRequest, NotificationRequest, SummaryQARequest, SearchQARequest
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

os.environ["USE_NNPACK"] = "0"
MONITORED_DIR = config.MONITORED_DIR

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up...")
    init_db()
    init_firebase()
    db_service.ensure_collection_exists()

    observer = start_watching(MONITORED_DIR, lambda files: ingest_docs_task.delay(files))
    yield
    # Shutdown
    observer.stop()
    observer.join()
    logger.info("Shutting down...")

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

@app.get("/health")
def health_check():
    return {"status": "ok"}

# --- Agent Endpoints ---

@app.post("/agent/sync", dependencies=[Depends(get_current_user)])
def run_sync(request: AgentRequest):
    logger.info(f"Received sync agent request: {request.prompt}")
    return {"response": run_sync_agent(request.prompt)}

@app.post("/agent/async", dependencies=[Depends(get_current_user)])
def run_async(request: AgentRequest):
    logger.info(f"Received async request: {request.prompt}")
    workflow = chain(check_knowledge_base.s(request.prompt) | answer_question.s())
    task = workflow.apply_async()
    return {"task_id": task.id}

@app.get("/agent/status/{task_id}", response_model=TaskResponse)
def get_status(task_id: str):
    task_result = AsyncResult(task_id, app=celery_app)
    return {
        "task_id": task_id,
        "status": task_result.status,
        "result": str(task_result.result) if task_result.ready() else None
    }

# --- Document Management ---

@app.post("/agent/ingest", dependencies=[Depends(get_current_user)])
def ingest_documents(request: IngestRequest):
    logger.info(f"Ingesting {len(request.files)} files")
    task = ingest_docs_task.delay(request.files)
    return {"task_id": task.id}

@app.post("/agent/search", dependencies=[Depends(get_current_user)])
def search_documents_endpoint(request: SearchRequest):
    return perform_rag(request.prompt, request.limit, request.document_set)

@app.get("/agent/documents", dependencies=[Depends(get_current_user)])
def list_documents():
    try:
        all_docs = db_service.list_documents()
        docs = []
        for point in all_docs:
             docs.append({
                 "id": point.id,
                 "filename": point.payload.get("filename", "unknown"),
                 "document_set": point.payload.get("document_set", "all"),
                 "content_snippet": point.payload.get("content", "")[:200]
             })
        return {"documents": docs}
    except Exception as e:
        logger.warning(f"Error listing documents: {e}")
        return {"documents": []}

@app.get("/agent/documentsets", dependencies=[Depends(get_current_user)])
def list_document_sets():
    try:
        all_docs = db_service.list_documents()
        sets = set()
        for point in all_docs:
            sets.add(point.payload.get("document_set", "all"))
        return {"document_sets": list(sets)}
    except Exception as e:
        logger.warning(f"Error listing document sets: {e}")
        return {"document_sets": []}

@app.delete("/agent/documents/{filename:path}", dependencies=[Depends(get_current_user)])
def delete_document_endpoint(filename: str, document_set: str = "all"):
    import re
    from pathlib import Path

    try:
        # Delete from filesystem if a specific set is provided or mapped
        if document_set == "all":
             # If "all", we need to find the file in any of the document set folders
             root = Path(MONITORED_DIR)
             if root.exists():
                 for item in root.iterdir():
                     if item.is_dir():
                         target = item / filename
                         if target.exists() and target.is_file():
                             try:
                                 os.remove(target)
                                 logger.info(f"Deleted file from filesystem (set='{item.name}'): {target}")
                             except Exception as e:
                                 logger.error(f"Failed to delete file {target}: {e}")

        elif document_set:
            sanitized_set = re.sub(r'[^a-z0-9_]', '_', document_set.lower().strip()).strip('_')
            file_path = Path(MONITORED_DIR) / sanitized_set / filename
            if file_path.exists():
                try:
                    os.remove(file_path)
                    logger.info(f"Deleted file from filesystem: {file_path}")
                except Exception as e:
                    logger.error(f"Failed to delete file {file_path}: {e}")
                    # Continue to delete from DB even if FS delete fails (or maybe it was already gone)

        db_service.delete_document(filename, document_set)
        return {"status": "success", "message": f"Deleted {filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agent/upload", dependencies=[Depends(get_current_user)])
async def upload_files(files: list[UploadFile] = File(...), document_set: str = Form(...)):
    import shutil
    import re
    from pathlib import Path

    sanitized_set = re.sub(r'[^a-z0-9_]', '_', document_set.lower().strip()).strip('_')
    if not sanitized_set:
        raise HTTPException(status_code=400, detail="Invalid document set name")

    target_dir = Path(MONITORED_DIR) / sanitized_set
    try:
        target_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Failed to create directory: {e}")

    uploaded_files = []
    try:
        for file in files:
            filename = Path(file.filename).name
            file_path = target_dir / filename
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            uploaded_files.append(filename)
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    return {"status": "success", "uploaded": uploaded_files, "document_set": sanitized_set}

# --- Summarization and QA ---

@app.post("/agent/summarize", dependencies=[Depends(get_current_user)])
def summarize_document_endpoint(request: SummarizeRequest):
    filepath = request.filename
    if not os.path.isabs(filepath):
         filepath = os.path.join(MONITORED_DIR, request.filename)
         
    if not os.path.exists(filepath):
         raise HTTPException(status_code=404, detail="File not found")

    try:
        with open(filepath, "rb") as f:
            content_b64 = base64.b64encode(f.read()).decode('utf-8')
            
        notify_url = f"{config.API_URL}/internal/notify"
        task = summarize_document_task.delay(request.filename, content_b64, notify_url)
        return {"task_id": task.id, "message": "Summarization started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/agent/summaries", dependencies=[Depends(get_current_user)])
def get_summaries_history():
    return {"summaries": get_all_summaries()}

@app.post("/agent/summary_qa", dependencies=[Depends(get_current_user)])
def summary_qa_endpoint(request: SummaryQARequest):
    summary_record = get_summary(request.filename)
    if not summary_record:
         return {"answer": "Summary not found. Please summarize the document first."}
    
    return {"answer": run_qa_agent(summary_record['summary_text'], request.question)}

@app.post("/agent/search_qa", dependencies=[Depends(get_current_user)])
def search_qa_endpoint(request: SearchQARequest):
    context_str = "\n\n".join([
        f"Source '{r['metadata'].get('filename', 'Unknown')}':\n{r.get('content', '')}" 
        for r in request.context_results
    ])
    return {"answer": run_qa_agent(context_str, request.question)}

# --- WebSocket & Notifications ---

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

@app.post("/internal/notify")
async def notify_endpoint(notification: NotificationRequest):
    logger.info(f"Notification: {notification.type} for {notification.filename}")
    if notification.status == 'completed' and notification.result:
        try:
             save_summary(notification.filename, notification.result)
        except Exception as e:
             logger.error(f"DB Error: {e}")

    await manager.broadcast(notification.dict())
    return {"status": "ok"}
