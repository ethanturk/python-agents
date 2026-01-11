"""
Vercel serverless function handler for Summaries API.

This module wraps the summaries_app FastAPI app with Mangum to make it compatible
with Vercel's serverless function runtime.
"""

import sys
from pathlib import Path

# Add parent directory to path to import backend_app
backend_dir = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(backend_dir))

from mangum import Mangum
from summaries_app import app

# Vercel serverless handler
handler = Mangum(app, lifespan="off")
