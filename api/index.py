from mangum import Mangum
import sys
import os

# Add backend directory to Python path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from backend_app import app

# Wrap FastAPI app with Mangum for Vercel
handler = Mangum(app, lifespan="off")
