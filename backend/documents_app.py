import logging

from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, File, Form, HTTPException, Response, UploadFile

# Internal Imports
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

# Common imports
from common import get_current_user

# Service Layer
from services.azure_storage import azure_storage_service
from services.file_management import file_service
from services.vector_db import db_service

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Documents service starting...")
    yield
    # Shutdown
    logger.info("Documents service shutting down...")


app = FastAPI(lifespan=lifespan)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/agent/documents", dependencies=[Depends(get_current_user)])
async def list_documents():
    try:
        file_data = await db_service.get_distinct_filenames()
        docs = []
        for file_info in file_data:
            docs.append(
                {
                    "id": file_info["filename"],
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
        sets = await db_service.get_distinct_document_sets()
        return {"document_sets": sets}
    except Exception as e:
        logger.warning(f"Error listing document sets: {e}")
        return {"document_sets": []}


@app.post("/agent/upload", dependencies=[Depends(get_current_user)])
async def upload_files(files: list[UploadFile] = File(...), document_set: str = Form(...)):
    from services.queue_service import init_queue_service

    target_dir, sanitized_set = file_service.validate_upload(files, document_set)
    uploaded_files = []

    try:
        for file in files:
            filename = await file_service.save_uploaded_file(file, target_dir)
            uploaded_files.append(filename)
            logger.info(f"Uploaded file: {filename} to {sanitized_set}")

            queue = init_queue_service()
            await queue.submit_task(
                "ingest",
                {"filename": filename, "document_set": sanitized_set},
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    return {
        "status": "success",
        "uploaded": uploaded_files,
        "document_set": sanitized_set,
    }


@app.delete("/agent/documents/{filename:path}", dependencies=[Depends(get_current_user)])
async def delete_document_endpoint(filename: str, document_set: str = "all"):
    try:
        file_service.delete_file(filename, document_set)
        return {"status": "success", "message": f"Deleted {filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/agent/files/{document_set}/{filename}")
async def proxy_file(document_set: str, filename: str):
    """
    Proxy file from Azure Storage.
    """
    from utils.validation import sanitize_document_set

    sanitized_set = sanitize_document_set(document_set) if document_set else "all"

    file_content = await azure_storage_service.download_file(filename, sanitized_set)

    if not file_content:
        raise HTTPException(
            status_code=404, detail="File not found or storage temporarily unavailable"
        )

    ext = Path(filename).suffix.lower()
    content_types = {
        ".pdf": "application/pdf",
        ".txt": "text/plain; charset=utf-8",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".doc": "application/msword",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xls": "application/vnd.ms-excel",
        ".csv": "text/csv; charset=utf-8",
        ".md": "text/markdown; charset=utf-8",
        ".json": "application/json",
        ".xml": "application/xml",
    }
    content_type = content_types.get(ext, "application/octet-stream")

    return Response(content=file_content, media_type=content_type)


@app.post("/agent/ingest", dependencies=[Depends(get_current_user)])
async def ingest_documents_endpoint():
    """
    Document ingestion endpoint for serverless deployment.
    For serverless deployment, this returns 503 as ingestion is handled by queue service.
    """
    raise HTTPException(
        status_code=503,
        detail="Document ingestion not available in serverless deployment. Please use file upload instead. Ingestion is handled by external queue service after upload.",
    )
