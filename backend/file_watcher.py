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
            with open(filepath, "rb") as f:
                content = f.read()
                
            self.callback([{"filename": filename, "filepath": filepath, "content": content}])
        except Exception as e:
            logger.error(f"Error reading {filename}: {e}")

def process_existing_files(path, callback):
    """
    Scans for existing files and triggers callback.
    """
    logger.info(f"Scanning for existing files in {path}...")
    try:
        for filename in os.listdir(path):
            filepath = os.path.join(path, filename)
            # Skip hidden files and directories
            if os.path.isfile(filepath) and not filename.startswith('.'):
                try:
                    logger.info(f"Processing existing file: {filename}")
                    with open(filepath, "rb") as f:
                        content = f.read()
                    callback([{"filename": filename, "filepath": filepath, "content": content}])
                except Exception as e:
                    logger.error(f"Error reading existing file {filename}: {e}")
    except Exception as e:
        logger.error(f"Error scanning directory {path}: {e}")

def start_watching(path, callback, process_existing=True):
    """
    Starts watching a directory in a background thread.
    Optionally processes existing files.
    """
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)
        
    if process_existing:
        # Run in a separate thread to distinguish from realtime events and not block
        threading.Thread(target=process_existing_files, args=(path, callback), daemon=True).start()
        
    event_handler = DocumentHandler(callback)
    observer = Observer()
    observer.schedule(event_handler, path, recursive=False)
    observer.start()
    
    logger.info(f"Started monitoring {path}")
    return observer
