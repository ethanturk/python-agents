import os
from pathlib import Path
from fastapi import HTTPException, UploadFile

from services.azure_storage import azure_storage_service
from utils.validation import sanitize_document_set


class FileManagementService:
    """Handles file upload, deletion, and filesystem operations using Azure Storage."""

    def __init__(self):
        # Azure Storage is used instead of local filesystem
        self.max_file_size = int(os.getenv("MAX_FILE_SIZE", 100_000_000))
        self.max_files_per_upload = int(os.getenv("MAX_FILES_PER_UPLOAD", 10))
        self.allowed_extensions = {
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

    def validate_upload(self, files: list[UploadFile], document_set: str) -> tuple:
        """Validation logic returns sanitized document set."""
        if len(files) > self.max_files_per_upload:
            raise HTTPException(
                status_code=400,
                detail=f"Too many files. Maximum {self.max_files_per_upload} files per upload.",
            )

        sanitized_set = sanitize_document_set(document_set)
        if not sanitized_set:
            raise HTTPException(status_code=400, detail="Invalid document set name")

        return sanitized_set, sanitized_set

    async def save_uploaded_file(self, file: UploadFile, document_set: str) -> str:
        """Save uploaded file to Azure Storage instead of local filesystem"""
        filename = Path(file.filename).name
        file_ext = Path(filename).suffix.lower()

        # File type validation (keep existing)
        if file_ext not in self.allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"File type '{file_ext}' not allowed. Allowed: {', '.join(self.allowed_extensions)}",
            )

        file_content = await file.read()
        file_size = len(file_content)

        # File size validation (keep existing)
        if file_size > self.max_file_size:
            raise HTTPException(
                status_code=400,
                detail=f"File too large ({file_size / 1_000_000:.2f}MB). Max: {self.max_file_size / 1_000_000:.0f}MB",
            )

        # Upload to Azure (REPLACE local file write)
        success = await azure_storage_service.upload_file(file_content, filename, document_set)

        if not success:
            raise HTTPException(
                status_code=503,
                detail="File storage service unavailable. Please try again later. Your file was not saved.",
            )

        return filename

    async def delete_file(self, filename: str, document_set: str = "all") -> bool:
        """Delete file from Azure Storage instead of local filesystem"""
        if document_set == "all":
            # Cannot delete "all" in Azure - require explicit document set
            raise HTTPException(
                status_code=400,
                detail="Must specify document_set when deleting files. Bulk deletion not supported.",
            )

        sanitized_set = sanitize_document_set(document_set)

        # Validate document set
        if not sanitized_set:
            raise HTTPException(status_code=400, detail="Invalid document set name")

        # Delete from Azure (REPLACE local file deletion)
        success = await azure_storage_service.delete_file(filename, sanitized_set)

        if not success:
            raise HTTPException(
                status_code=503,
                detail="File storage service unavailable. Please try again later. Your file was not deleted.",
            )

        return True


file_service = FileManagementService()
