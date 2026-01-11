"""
Vercel serverless function handler for Documents API.

This module wraps the documents_app FastAPI app with Mangum to make it compatible
with Vercel's serverless function runtime.
"""

import logging
import sys
from pathlib import Path
from typing import Optional

from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, File, Form, HTTPException, Response, UploadFile
from mangum import Mangum

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(backend_dir))

# Local imports
from .service import (
    delete_document,
    list_document_sets,
    list_documents,
    proxy_file,
    upload_files,
)
from common import get_current_user

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
async def list_documents_endpoint():
    try:
        docs = await list_documents()
        return {"documents": docs}
    except Exception as e:
        logger.warning(f"Error listing documents: {e}")
        return {"documents": []}


@app.get("/agent/documentsets", dependencies=[Depends(get_current_user)])
async def list_document_sets_endpoint():
    try:
        sets = await list_document_sets()
        return {"document_sets": sets}
    except Exception as e:
        logger.warning(f"Error listing document sets: {e}")
        return {"document_sets": []}


@app.post("/agent/upload", dependencies=[Depends(get_current_user)])
async def upload_files_endpoint(
    files: list[UploadFile] = File(...), document_set: str = Form(...)
):
    try:
        result = await upload_files(files, document_set)
        return {
            "status": "success",
            **result,
        }
    except Exception as e:
        logger.error(f"Failed to upload files: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")


@app.delete(
    "/agent/documents/{filename:path}", dependencies=[Depends(get_current_user)]
)
async def delete_document_endpoint(filename: str, document_set: Optional[str] = "all"):
    try:
        result = await delete_document(filename, document_set)
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"Failed to delete document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/agent/files/{document_set}/{filename}")
async def proxy_file_endpoint(document_set: str, filename: str):
    """
    Proxy file from Azure Storage.
    """
    file_content = await proxy_file(document_set, filename)

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


# Vercel serverless handler
handler = Mangum(app, lifespan="off")
