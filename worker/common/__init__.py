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
    """
    Lazy import of get_current_user from auth module.
    Returns None gracefully if firebase_admin is not available.
    """
    try:
        from .auth import get_current_user as _get_current_user

        return _get_current_user
    except ImportError:
        # Return a dummy dependency that always returns None
        from fastapi import Security
        from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

        security = HTTPBearer()

        def no_auth(credentials: HTTPAuthorizationCredentials = Security(security)):
            # For development/testing when firebase is not installed
            return {"uid": "dev_user"}

        return no_auth


def get_current_user_from_query():
    """
    Lazy import of get_current_user_from_query from auth module.
    Returns None gracefully if firebase_admin is not available.
    """
    try:
        from .auth import (
            get_current_user_from_query as _get_current_user_from_query,
        )

        return _get_current_user_from_query
    except ImportError:
        # Return a dummy dependency that always returns None
        from fastapi import Query

        def no_auth_query(token: str = Query(None)):
            # For development/testing when firebase is not installed
            return {"uid": "dev_user"}

        return no_auth_query
