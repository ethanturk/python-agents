import os
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import threading
import logging

logger = logging.getLogger(__name__)

class DocumentHandler(FileSystemEventHandler):
    def __init__(self, callback):
        self.callback = callback

    def on_created(self, event):
        if event.is_directory:
            return
        
        filepath = event.src_path
        filename = os.path.basename(filepath)
        
        # Simple debounce / wait for write to finish could be handled here 
        # but for simplicity we assume file is ready or handle retries in ingest
        logger.info(f"New file detected: {filename}")
        
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
                
            self.callback([{"filename": filename, "filepath": filepath, "content": content}])
        except Exception as e:
            logger.error(f"Error reading {filename}: {e}")

def start_watching(path, callback):
    """
    Starts watching a directory in a background thread.
    """
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)
        
    event_handler = DocumentHandler(callback)
    observer = Observer()
    observer.schedule(event_handler, path, recursive=False)
    observer.start()
    
    logger.info(f"Started monitoring {path}")
    return observer
