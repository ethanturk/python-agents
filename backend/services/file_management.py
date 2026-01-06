import os
from pathlib import Path
from fastapi import UploadFile, HTTPException
from typing import List
import config
from utils.validation import sanitize_document_set


class FileManagementService:
    """Handles file upload, deletion, and filesystem operations."""

    def __init__(self, monitored_dir: str):
        self.monitored_dir = Path(monitored_dir)
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

    def sanitize_path(self, base_dir: Path, user_path: str) -> Path:
        """Safely join base directory with user path, preventing traversal attacks."""
        base = base_dir.resolve()
        safe_filename = Path(user_path).name
        full_path = (base / safe_filename).resolve()

        try:
            full_path.relative_to(base)
        except ValueError:
            raise HTTPException(
                status_code=400, detail="Invalid file path: path traversal detected"
            )

        return full_path

    def validate_upload(self, files: List[UploadFile], document_set: str) -> tuple:
        """Validate upload request and return target directory and sanitized set name."""
        if len(files) > self.max_files_per_upload:
            raise HTTPException(
                status_code=400,
                detail=f"Too many files. Maximum {self.max_files_per_upload} files per upload.",
            )

        sanitized_set = sanitize_document_set(document_set)
        if not sanitized_set:
            raise HTTPException(status_code=400, detail="Invalid document set name")

        target_dir = self.monitored_dir / sanitized_set
        try:
            target_dir.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create directory: {e}")

        return target_dir, sanitized_set

    async def save_uploaded_file(self, file: UploadFile, target_dir: Path) -> str:
        """Save uploaded file to target directory with validation."""
        filename = Path(file.filename).name
        file_ext = Path(filename).suffix.lower()

        if file_ext not in self.allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"File type '{file_ext}' not allowed. Allowed: {', '.join(self.allowed_extensions)}",
            )

        file_path = self.sanitize_path(target_dir, filename)
        file_content = await file.read()
        file_size = len(file_content)

        if file_size > self.max_file_size:
            raise HTTPException(
                status_code=400,
                detail=f"File too large ({file_size / 1_000_000:.2f}MB). Max: {self.max_file_size / 1_000_000:.0f}MB",
            )

        with open(file_path, "wb") as buffer:
            buffer.write(file_content)

        return filename

    def delete_file(self, filename: str, document_set: str = "all") -> bool:
        """Delete file from filesystem."""
        if document_set == "all":
            root = self.monitored_dir
            if root.exists():
                for item in root.iterdir():
                    if item.is_dir():
                        try:
                            target = self.sanitize_path(item, filename)
                            if target.exists() and target.is_file():
                                target.unlink()
                        except HTTPException:
                            continue
        else:
            sanitized_set = sanitize_document_set(document_set)
            base_path = self.monitored_dir / sanitized_set
            file_path = self.sanitize_path(base_path, filename)
            if file_path.exists():
                file_path.unlink()
        return True


file_service = FileManagementService(config.MONITORED_DIR)
