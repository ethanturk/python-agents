import os
import time
import logging
import threading
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from services.vector_db import db_service
import config

logger = logging.getLogger(__name__)

def get_document_set(filepath):
    try:
        monitored_path = Path(config.MONITORED_DIR).resolve()
        file_path_obj = Path(filepath).resolve()
        if monitored_path in file_path_obj.parents:
            rel_path = file_path_obj.relative_to(monitored_path)
            if len(rel_path.parts) > 1:
                return rel_path.parts[0]
    except Exception:
        pass
    return "all"

class DocumentHandler(FileSystemEventHandler):
    def __init__(self, callback):
        self.callback = callback

    def on_created(self, event):
        if event.is_directory: return
        
        filepath = event.src_path
        if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
            logger.info(f"New file detected: {filepath}")
            try:
                with open(filepath, "rb") as f:
                    content = f.read()
                self.callback([{
                    "filename": filepath, 
                    "filepath": filepath, 
                    "content": content, 
                    "document_set": get_document_set(filepath)
                }])
            except Exception as e:
                logger.error(f"Error reading {filepath}: {e}")

def get_indexed_filenames():
    import asyncio
    from services.vector_db import VectorDBService
    
    async def fetch_ids():
        # Use the global service instance (singleton pattern)
        # DO NOT close it - it's shared across the application
        temp_service = VectorDBService()
        docs = await temp_service.list_documents(limit=10000)
        return {d.payload.get("filename") for d in docs if d.payload}
        # Note: No close() call - the singleton is managed by the app lifecycle

    try:
        return asyncio.run(fetch_ids())
    except Exception as e:
        logger.warning(f"Could not fetch indexed files: {e}")
        return set()

def start_watching(path, callback):
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)

    # Simple background scanner (simplified from original)
    def scan_existing():
        indexed = get_indexed_filenames()
        for root, _, files in os.walk(path):
            for filename in files:
                if filename.startswith('.'): continue
                filepath = os.path.join(root, filename)
                if filepath not in indexed and os.path.getsize(filepath) > 0:
                    logger.info(f"Processing existing unindexed: {filepath}")
                    try:
                        with open(filepath, "rb") as f:
                             content = f.read()
                        callback([{
                            "filename": filepath, 
                            "filepath": filepath, 
                            "content": content, 
                            "document_set": get_document_set(filepath)
                        }])
                        time.sleep(0.5)
                    except Exception as e:
                        logger.error(e)

    threading.Thread(target=scan_existing, daemon=True).start()

    event_handler = DocumentHandler(callback)
    observer = Observer()
    observer.schedule(event_handler, path, recursive=True)
    observer.start()
    return observer
