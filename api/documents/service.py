"""
Documents service wrapper for serverless deployment.

This module provides a thin wrapper around backend document services,
using minimal dependencies (fastapi, azure-storage-blob, supabase).
"""

import asyncio
import logging
import os
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent.parent
sys_path = str(backend_dir)
if sys_path not in sys.path:
    sys.path.insert(0, sys_path)

from services.azure_storage import azure_storage_service
from services.file_management import file_service
from services.vector_db import db_service

logger = logging.getLogger(__name__)


async def list_documents():
    """List all documents with metadata."""
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
        return docs
    except Exception as e:
        logger.warning(f"Error listing documents: {e}")
        return []


async def list_document_sets():
    """List all document sets."""
    try:
        sets = await db_service.get_distinct_document_sets()
        return sets
    except Exception as e:
        logger.warning(f"Error listing document sets: {e}")
        return []


async def upload_files(files, document_set: str):
    """Upload files and submit to ingestion queue."""
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
        return {"uploaded": uploaded_files, "document_set": sanitized_set}
    except Exception as e:
        logger.error(f"Failed to save file: {e}")
        raise


async def delete_document(filename: str, document_set: str = "all"):
    """Delete a document."""
    try:
        file_service.delete_file(filename, document_set)
        return {"message": f"Deleted {filename}"}
    except Exception as e:
        logger.error(f"Failed to delete file: {e}")
        raise


async def proxy_file(document_set: str, filename: str) -> bytes | None:
    """Proxy file from Azure Storage."""
    from utils.validation import sanitize_document_set

    sanitized_set = sanitize_document_set(document_set) if document_set else "all"

    file_content = await azure_storage_service.download_file(filename, sanitized_set)

    return file_content
