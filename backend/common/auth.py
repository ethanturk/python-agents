import logging
import os
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Try to import firebase_admin - will be None if not available
firebase_admin = None
auth = None
credentials = None
security = None
HTTPBearer = None
HTTPException = None

try:
    import firebase_admin
    from firebase_admin import auth, credentials

    # Try to import FastAPI security components
    try:
        from fastapi.security import HTTPBearer

        security = HTTPBearer()
    except ImportError:
        logger.warning("fastapi not available for security")

    try:
        from fastapi import HTTPException as _HTTPException

        HTTPException = _HTTPException
    except ImportError:
        logger.warning("fastapi HTTPException not available")

    logger.info("firebase_admin imported successfully")
except ImportError:
    logger.warning(
        "firebase_admin not available. Authentication will be disabled. "
        "Install firebase-admin for production deployments."
    )


def init_firebase():
    """
    Initializes Firebase Admin SDK.

    Raises:
        RuntimeError: If Firebase initialization fails and FIREBASE_REQUIRED=true
    """
    if firebase_admin is None:
        logger.warning("firebase_admin not available, skipping initialization")
        return

    try:
        # Check if already initialized
        if not firebase_admin._apps:
            # Use default credentials (GOOGLE_APPLICATION_CREDENTIALS) or no-arg for ADC
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin initialized successfully.")
    except Exception as e:
        # Check if Firebase is required for this deployment
        firebase_required = os.getenv("FIREBASE_REQUIRED", "false").lower() == "true"

        if firebase_required:
            logger.error(f"Firebase Admin initialization failed: {e}")
            raise RuntimeError(
                "Firebase authentication is required but initialization failed. "
                "Set GOOGLE_APPLICATION_CREDENTIALS or disable FIREBASE_REQUIRED."
            ) from e
        else:
            logger.warning(
                f"Firebase Admin initialization failed: {e}. "
                "Auth verification will fail. Set FIREBASE_REQUIRED=true to make this fatal."
            )


def get_current_user(credentials) -> Optional[Dict[str, Any]]:
    """Verifies Firebase ID token."""
    if firebase_admin is None or auth is None or HTTPException is None or credentials is None:
        # Return None if firebase is not available
        return None

    token = credentials.credentials
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_from_query(
    token: Optional[str] = None, credentials=None
) -> Optional[Dict[str, Any]]:
    """
    Verifies Firebase ID token from either:
    1. Authorization header (Bearer token) - for API calls
    2. Query parameter ?token=xxx - for EventSource (SSE)

    EventSource API cannot set custom headers, so we must support query params.
    """
    if firebase_admin is None or auth is None or HTTPException is None:
        # Return None if firebase is not available
        return None

    # Try header first, then query param
    id_token = None
    if credentials and hasattr(credentials, "credentials"):
        id_token = credentials.credentials
    elif token:
        id_token = token
    else:
        raise HTTPException(
            status_code=401,
            detail="No authentication token provided (header or query param)",
        )

    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise HTTPException(status_code=401, detail=f"Invalid authentication token: {str(e)}")
