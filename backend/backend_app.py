import os
import logging
import base64
from fastapi import (
    FastAPI,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    UploadFile,
    File,
    Form,
    Depends,
)
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
from services.file_management import file_service
from async_tasks import (
    ingest_docs_task,
    summarize_document_task,
    check_knowledge_base,
    answer_question,
    app as celery_app,
)
from celery import chain

# API Models
from api.models import (
    AgentRequest,
    TaskResponse,
    IngestRequest,
    SearchRequest,
    SummarizeRequest,
    NotificationRequest,
    SummaryQARequest,
    SearchQARequest,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

os.environ["USE_NNPACK"] = "0"
MONITORED_DIR = config.MONITORED_DIR

# Security: File upload configuration
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 100_000_000))  # 100MB default
MAX_FILES_PER_UPLOAD = int(os.getenv("MAX_FILES_PER_UPLOAD", 10))
ALLOWED_EXTENSIONS = {
    ".pdf",
    ".txt",
    ".docx",
    ".doc",
    ".xlsx",
    ".xls",
    ".csv",
    ".md",
    ".json",
    ".xml",
}

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
        raise HTTPException(status_code=400, detail="Invalid file path: path traversal detected")

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
            sys.executable,
            "-m",
            "celery",
            "-A",
            "async_tasks",
            "worker",
            "--loglevel=info",
            "-Q",
            config.CELERY_QUEUE_NAME,
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
    "ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001,https://apps.ethanturk.com"
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
        "result": str(task_result.result) if task_result.ready() else None,
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
        # Use efficient distinct filename query instead of fetching all rows
        file_data = await db_service.get_distinct_filenames()
        docs = []
        for file_info in file_data:
            docs.append(
                {
                    "id": file_info["filename"],  # Use filename as ID for grouping
                    "filename": file_info["filename"],
                    "document_set": file_info["document_set"],
                    "chunk_count": file_info["chunk_count"],
                }
            )
        return {"documents": docs}
    except Exception as e:
        logger.warning(f"Error listing documents: {e}")
        return {"documents": []}


@app.get("/agent/documentsets", dependencies=[Depends(get_current_user)])
async def list_document_sets():
    try:
        # Use efficient distinct query instead of fetching all rows
        sets = await db_service.get_distinct_document_sets()
        return {"document_sets": sets}
    except Exception as e:
        logger.warning(f"Error listing document sets: {e}")
        return {"document_sets": []}


@app.delete("/agent/documents/{filename:path}", dependencies=[Depends(get_current_user)])
async def delete_document_endpoint(filename: str, document_set: str = "all"):
    try:
        file_service.delete_file(filename, document_set)

        db_filename = filename
        if not filename.startswith("/") and MONITORED_DIR.startswith("/"):
            db_filename = "/" + filename

        logger.info(f"Deleting from Vector DB: {db_filename} (set={document_set})")
        await db_service.delete_document(db_filename, document_set)
        return {"status": "success", "message": f"Deleted {filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/agent/upload", dependencies=[Depends(get_current_user)])
async def upload_files(files: list[UploadFile] = File(...), document_set: str = Form(...)):
    target_dir, sanitized_set = file_service.validate_upload(files, document_set)
    uploaded_files = []

    try:
        for file in files:
            filename = await file_service.save_uploaded_file(file, target_dir)
            uploaded_files.append(filename)
            logger.info(f"Uploaded file: {filename} to {sanitized_set}")

    except HTTPException:
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
            content_b64 = base64.b64encode(f.read()).decode("utf-8")

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
    if notification.status == "completed" and notification.result:
        try:
            save_summary(notification.filename, notification.result)
        except Exception as e:
            logger.error(f"DB Error: {e}")

    await manager.broadcast(notification.dict())
    return {"status": "ok"}
