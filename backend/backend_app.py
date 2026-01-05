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

# Security: File upload configuration
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 100_000_000))  # 100MB default
MAX_FILES_PER_UPLOAD = int(os.getenv("MAX_FILES_PER_UPLOAD", 10))
ALLOWED_EXTENSIONS = {'.pdf', '.txt', '.docx', '.doc', '.xlsx', '.xls', '.csv', '.md', '.json', '.xml'}

# Security: Path traversal prevention
from pathlib import Path

def safe_path_join(base_dir: str, user_path: str) -> Path:
    """
    Safely join a base directory with a user-provided path.
    Prevents path traversal attacks by ensuring the resolved path is within base_dir.

    Args:
        base_dir: The base directory (trusted)
        user_path: User-provided path component (untrusted)

    Returns:
        Resolved Path object

    Raises:
        HTTPException: If path traversal is detected
    """
    base = Path(base_dir).resolve()
    # Only use the filename component to prevent directory traversal
    safe_filename = Path(user_path).name
    full_path = (base / safe_filename).resolve()

    # Ensure the resolved path is still within the base directory
    try:
        full_path.relative_to(base)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid file path: path traversal detected"
        )

    return full_path

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up...")
    init_db()
    init_firebase()

    observer = start_watching(MONITORED_DIR, lambda files: ingest_docs_task.delay(files))
    
    # Embedded Worker Logic
    worker_process = None
    if config.RUN_WORKER_EMBEDDED:
        import subprocess
        import sys
        logger.info("Starting embedded Celery worker...")
        # Use sys.executable to ensure we use the same python interpreter/env
        cmd = [
            sys.executable, "-m", "celery", 
            "-A", "async_tasks", "worker", 
            "--loglevel=info", 
            "-Q", config.CELERY_QUEUE_NAME
        ]
        try:
            worker_process = subprocess.Popen(cmd)
            logger.info(f"Embedded worker started with PID {worker_process.pid}")
        except Exception as e:
            logger.error(f"Failed to start embedded worker: {e}")

    yield
    # Shutdown
    if worker_process:
        logger.info("Stopping embedded worker...")
        worker_process.terminate()
        try:
            worker_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            worker_process.kill()
        logger.info("Embedded worker stopped.")

    observer.stop()
    observer.join()
    logger.info("Shutting down...")

app = FastAPI(lifespan=lifespan)

# CORS Configuration - Restrict origins for security
# Configure allowed origins via environment variable or use defaults
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001,https://apps.ethanturk.com"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
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
async def list_documents():
    try:
        all_docs = await db_service.list_documents()
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
async def list_document_sets():
    try:
        all_docs = await db_service.list_documents()
        sets = set()
        for point in all_docs:
            sets.add(point.payload.get("document_set", "all"))
        return {"document_sets": list(sets)}
    except Exception as e:
        logger.warning(f"Error listing document sets: {e}")
        return {"document_sets": []}

@app.delete("/agent/documents/{filename:path}", dependencies=[Depends(get_current_user)])
async def delete_document_endpoint(filename: str, document_set: str = "all"):
    import re

    try:
        # Delete from filesystem if a specific set is provided or mapped
        if document_set == "all":
             # If "all", we need to find the file in any of the document set folders
             root = Path(MONITORED_DIR)
             if root.exists():
                 for item in root.iterdir():
                     if item.is_dir():
                         # Use safe path join to prevent path traversal
                         try:
                             target = safe_path_join(str(item), filename)
                         except HTTPException:
                             continue  # Skip invalid paths

                         if target.exists() and target.is_file():
                             try:
                                 os.remove(target)
                                 logger.info(f"Deleted file from filesystem (set='{item.name}'): {target}")
                             except Exception as e:
                                 logger.error(f"Failed to delete file {target}: {e}")

        elif document_set:
            sanitized_set = re.sub(r'[^a-z0-9_]', '_', document_set.lower().strip()).strip('_')
            # Use safe path join to prevent path traversal
            base_path = Path(MONITORED_DIR) / sanitized_set
            file_path = safe_path_join(str(base_path), filename)

            if file_path.exists():
                try:
                    os.remove(file_path)
                    logger.info(f"Deleted file from filesystem: {file_path}")
                except Exception as e:
                    logger.error(f"Failed to delete file {file_path}: {e}")
                    # Continue to delete from DB even if FS delete fails (or maybe it was already gone)

        # Normalize filename for DB deletion
        # The DB likely stores absolute paths (e.g. /data/monitored/...), but the URL param might be relative (data/monitored/...)
        db_filename = filename
        if not filename.startswith('/') and MONITORED_DIR.startswith('/'):
             db_filename = '/' + filename
        
        logger.info(f"Deleting from Vector DB: {db_filename} (set={document_set})")
        await db_service.delete_document(db_filename, document_set)
        return {"status": "success", "message": f"Deleted {filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agent/upload", dependencies=[Depends(get_current_user)])
async def upload_files(files: list[UploadFile] = File(...), document_set: str = Form(...)):
    import shutil
    import re

    # Validate number of files
    if len(files) > MAX_FILES_PER_UPLOAD:
        raise HTTPException(
            status_code=400,
            detail=f"Too many files. Maximum {MAX_FILES_PER_UPLOAD} files per upload."
        )

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
            # Validate file extension
            filename = Path(file.filename).name
            file_ext = Path(filename).suffix.lower()

            if file_ext not in ALLOWED_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail=f"File type '{file_ext}' not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
                )

            # Use safe path join to prevent path traversal
            file_path = safe_path_join(str(target_dir), filename)

            # Read and validate file size
            file_content = await file.read()
            file_size = len(file_content)

            if file_size > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"File '{filename}' is too large ({file_size / 1_000_000:.2f}MB). Maximum size: {MAX_FILE_SIZE / 1_000_000:.0f}MB"
                )

            # Write file
            with open(file_path, "wb") as buffer:
                buffer.write(file_content)

            uploaded_files.append(filename)
            logger.info(f"Uploaded file: {filename} ({file_size} bytes) to {document_set}")

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Failed to save file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

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
