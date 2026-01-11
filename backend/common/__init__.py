"""Common utilities for serverless backend functions."""

# Configuration and models can be imported directly
from .config import (
    API_URL,
    AZURE_STORAGE_ACCOUNT_NAME,
    AZURE_STORAGE_CONNECTION_STRING,
    AZURE_STORAGE_CONTAINER_NAME,
    BASE_URL,
    CELERY_BROKER_URL,
    CELERY_QUEUE_NAME,
    CELERY_RESULT_BACKEND,
    DATABASE_CONN_STRING,
    OPENAI_API_BASE,
    OPENAI_API_KEY,
    OPENAI_EMBEDDING_DIMENSIONS,
    OPENAI_EMBEDDING_MODEL,
    OPENAI_MODEL,
    RUN_WORKER_EMBEDDED,
    SUPABASE_KEY,
    SUPABASE_URL,
    VECTOR_TABLE_NAME,
)
from .models import (
    AgentRequest,
    IngestRequest,
    NotificationRequest,
    SearchQARequest,
    SearchRequest,
    SummarizeRequest,
    SummaryQARequest,
    TaskResponse,
)

__all__ = [
    "API_URL",
    "AZURE_STORAGE_ACCOUNT_NAME",
    "AZURE_STORAGE_CONNECTION_STRING",
    "AZURE_STORAGE_CONTAINER_NAME",
    "BASE_URL",
    "CELERY_BROKER_URL",
    "CELERY_QUEUE_NAME",
    "CELERY_RESULT_BACKEND",
    "DATABASE_CONN_STRING",
    "OPENAI_API_BASE",
    "OPENAI_API_KEY",
    "OPENAI_EMBEDDING_DIMENSIONS",
    "OPENAI_EMBEDDING_MODEL",
    "OPENAI_MODEL",
    "RUN_WORKER_EMBEDDED",
    "SUPABASE_KEY",
    "SUPABASE_URL",
    "VECTOR_TABLE_NAME",
    "AgentRequest",
    "IngestRequest",
    "NotificationRequest",
    "SearchQARequest",
    "SearchRequest",
    "SummarizeRequest",
    "SummaryQARequest",
    "TaskResponse",
]


def get_current_user():
    """Placeholder for get_current_user - requires firebase_admin."""
    try:
        from .auth import get_current_user as _get_current_user

        return _get_current_user
    except ImportError:
        raise ImportError(
            "get_current_user requires firebase_admin. Install firebase-admin "
            "and set GOOGLE_APPLICATION_CREDENTIALS environment variable."
        )


def get_current_user_from_query():
    """Placeholder for get_current_user_from_query - requires firebase_admin."""
    try:
        from .auth import (
            get_current_user_from_query as _get_current_user_from_query,
        )

        return _get_current_user_from_query
    except ImportError:
        raise ImportError(
            "get_current_user_from_query requires firebase_admin. Install firebase-admin "
            "and set GOOGLE_APPLICATION_CREDENTIALS environment variable."
        )
