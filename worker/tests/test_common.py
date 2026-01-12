"""Tests for common utilities."""

import pytest
from fastapi import HTTPException
from pathlib import Path
from backend.common.deps import safe_path_join, ALLOWED_EXTENSIONS, MAX_FILE_SIZE


def test_safe_path_join_valid():
    """Test that safe_path_join joins paths correctly."""
    base = "/tmp/test"
    user_path = "safe.txt"
    result = safe_path_join(base, user_path)
    assert result == Path(base) / "safe.txt"


def test_safe_path_join_traversal_prevented():
    """Test that path traversal attacks are prevented."""
    base = "/tmp/test"
    user_path = "../../etc/passwd"
    with pytest.raises(HTTPException) as exc_info:
        safe_path_join(base, user_path)
    assert "path traversal detected" in str(exc_info.value.detail)


def test_allowed_extensions():
    """Test that common file extensions are allowed."""
    assert ".pdf" in ALLOWED_EXTENSIONS
    assert ".txt" in ALLOWED_EXTENSIONS
    assert ".docx" in ALLOWED_EXTENSIONS


def test_max_file_size():
    """Test that MAX_FILE_SIZE is set."""
    assert isinstance(MAX_FILE_SIZE, int)
    assert MAX_FILE_SIZE > 0
