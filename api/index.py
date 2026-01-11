"""
Vercel serverless function handler for FastAPI application.

This module wraps the FastAPI app with Mangum to make it compatible
with Vercel's serverless function runtime.
"""

import sys
from pathlib import Path

# Add backend directory to path to import backend_app
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
sys.path.insert(0, str(backend_dir))

from mangum import Mangum
from backend_app import app

# Vercel serverless handler
handler = Mangum(app, lifespan="off")
