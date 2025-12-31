import os
import firebase_admin
from firebase_admin import auth, credentials
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import logging

logger = logging.getLogger(__name__)

security = HTTPBearer()

def init_firebase():
    """Initializes Firebase Admin SDK."""
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
        logger.warning(f"Firebase Admin initialization failed: {e}. Auth verification might fail if key not present.")

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
