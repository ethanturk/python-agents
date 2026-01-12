import re


def sanitize_document_set(document_set: str) -> str:
    """
    Sanitize document set name for safe use in file paths and database.

    Args:
        document_set: Raw document set name from user input

    Returns:
        Sanitized document set name containing only lowercase alphanumeric chars and underscores
    """
    if not document_set:
        return "all"
    return re.sub(r"[^a-z0-9_]", "_", document_set.lower().strip()).strip("_")
