"""
Shared dependencies for serverless functions.

This module contains common FastAPI dependencies used across multiple domain functions.
"""

import logging
import os

from fastapi import HTTPException, File, Form, UploadFile
from pathlib import Path

# Import from common layer

logger = logging.getLogger(__name__)

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


async def validate_upload(
    files: list[UploadFile] = File(...),
    document_set: str = Form(...),
) -> tuple[Path, str]:
    """
    Validates file upload request.

    Args:
        files: List of uploaded files
        document_set: Document set name

    Returns:
        Tuple of (target_dir, sanitized_document_set)

    Raises:
        HTTPException: If validation fails
    """
    # Validate number of files
    if len(files) > MAX_FILES_PER_UPLOAD:
        raise HTTPException(
            status_code=400, detail=f"Maximum {MAX_FILES_PER_UPLOAD} files per upload"
        )

    # Validate file extensions
    for file in files:
        ext = Path(file.filename).suffix.lower() if file.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

        # Validate file size (if content length is available)
        if file.size and file.size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File {file.filename} exceeds {MAX_FILE_SIZE} byte limit",
            )

    # Sanitize document set name
    import re

    sanitized_set = re.sub(r"[^a-z0-9_]", "_", document_set.lower())

    # Return validated data
    return (None, sanitized_set)  # target_dir will be set by caller
