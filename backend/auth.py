import logging
import os

import firebase_admin
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth, credentials

logger = logging.getLogger(__name__)

security = HTTPBearer()


def init_firebase():
    """
    Initializes Firebase Admin SDK.

    Raises:
        RuntimeError: If Firebase initialization fails and FIREBASE_REQUIRED=true
    """
    try:
        # Check if already initialized
        if not firebase_admin._apps:
            # Use default credentials (GOOGLE_APPLICATION_CREDENTIALS) or no-arg for ADC
            # In production/docker, we expect credentials to be mounted or ADC to work.
            # If developing locally without ADC, user might need to point to a service account key.
            # For now, we'll assume ADC or a service account path in env var.
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


def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    """Verifies the Firebase ID token."""
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
