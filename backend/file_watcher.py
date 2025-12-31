import os
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import threading
import logging
from async_tasks import qdrant_client
from config import config


logger = logging.getLogger(__name__)

class DocumentHandler(FileSystemEventHandler):
    def __init__(self, callback):
        self.callback = callback

    def on_created(self, event):
        if event.is_directory:
            return
        
        filepath = event.src_path
        # Use full path as filename as requested
        filename = filepath
        
        # Simple debounce / wait for write to finish could be handled here 
        # but for simplicity we assume file is ready or handle retries in ingest
        logger.info(f"New file detected: {filename}")
        
        if os.path.exists(filepath) and os.path.getsize(filepath) == 0:
            logger.info(f"Skipping 0-byte file: {filename}")
            return
        
        try:
            with open(filepath, "rb") as f:
                content = f.read()
                
            self.callback([{"filename": filename, "filepath": filepath, "content": content}])
        except Exception as e:
            logger.error(f"Error reading {filename}: {e}")

def get_indexed_filenames():
    """
    Retrieves a set of all filenames currently indexed in Qdrant.
    """
    indexed_files = set()
    offset = None
    try:
        # Check if collection exists first
        qdrant_client.get_collection(config.QDRANT_COLLECTION_NAME)
        
        while True:
            # Scroll through all points, fetching only the 'filename' from payload
            records, next_offset = qdrant_client.scroll(
                collection_name=config.QDRANT_COLLECTION_NAME,
                scroll_filter=None,
                limit=100,
                with_payload=["filename"],
                with_vectors=False,
                offset=offset
            )
            
            for record in records:
                if record.payload and "filename" in record.payload:
                    indexed_files.add(record.payload["filename"])
            
            offset = next_offset
            if offset is None:
                break
    except Exception as e:
        logger.warning(f"Could not fetch indexed files (collection might not exist yet): {e}")
        
    return indexed_files

def check_unindexed_files_loop(path, callback, interval=600):
    """
    Periodically checks for files that are not indexed and queues them.
    """
    logger.info(f"Starting periodic unindexed file check monitor (interval={interval}s)")
    while True:
        try:
            time.sleep(interval)
            logger.info("Running periodic unindexed file check...")
            
            indexed_files = get_indexed_filenames()
            logger.info(f"Found {len(indexed_files)} unique files already indexed.")
            
            files_to_index = []
            
            for root, dirs, files in os.walk(path):
                for filename in files:
                    if filename.startswith('.'):
                        continue
                        
                    filepath = os.path.join(root, filename)
                    
                    # If this file path is NOT in the indexed set, we assume it needs indexing
                    # Note: This simple check assumes the 'filename' stored in Qdrant is the absolute path
                    # which matches our logic in on_created.
                    if filepath not in indexed_files:
                        if os.path.getsize(filepath) == 0:
                             logger.info(f"Skipping 0-byte unindexed file: {filepath}")
                             continue

                        logger.info(f"Found unindexed file: {filepath}")
                        try:
                            with open(filepath, "rb") as f:
                                content = f.read()
                            files_to_index.append({"filename": filepath, "filepath": filepath, "content": content})
                        except Exception as e:
                            logger.error(f"Error reading unindexed file {filepath}: {e}")

            if files_to_index:
                logger.info(f"Found {len(files_to_index)} unindexed files. Queuing files individually...")
                for file_item in files_to_index:
                    logger.info(f"Queuing file: {file_item['filename']}")
                    callback([file_item])
            else:
                logger.debug("No unindexed files found.")
                
        except Exception as e:
            logger.error(f"Error in periodic check loop: {e}")

def process_existing_files(path, callback):
    """
    Scans for existing files (recursively) and triggers callback.
    This is run once on startup.
    """
    logger.info(f"Scanning for existing files in {path}...")
    
    indexed_files = get_indexed_filenames()
    logger.info(f"Found {len(indexed_files)} unique files already indexed.")

    try:
        for root, dirs, files in os.walk(path):
            for filename in files:
                # Skip hidden files
                if filename.startswith('.'):
                    continue
                    
                filepath = os.path.join(root, filename)
                
                if filepath in indexed_files:
                    continue

                try:
                    if os.path.getsize(filepath) == 0:
                        logger.info(f"Skipping 0-byte existing file: {filepath}")
                        continue
                        
                    logger.info(f"Processing existing file: {filepath}")
                    with open(filepath, "rb") as f:
                        content = f.read()
                    # Pass full path as filename
                    callback([{"filename": filepath, "filepath": filepath, "content": content}])
                    time.sleep(0.5) # Throttle slightly less
                except Exception as e:
                    logger.error(f"Error reading existing file {filepath}: {e}")
    except Exception as e:
        logger.error(f"Error scanning directory {path}: {e}")

def start_watching(path, callback, process_existing=True):
    """
    Starts watching a directory in a background thread.
    Optionally processes existing files and starts periodic checks.
    """
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)
        
    if process_existing:
        # Run initial scan in a separate thread
        threading.Thread(target=process_existing_files, args=(path, callback), daemon=True).start()

    # Start the periodic check loop thread
    threading.Thread(target=check_unindexed_files_loop, args=(path, callback), daemon=True).start()
        
    event_handler = DocumentHandler(callback)
    observer = Observer()
    observer.schedule(event_handler, path, recursive=True)
    observer.start()
    
    logger.info(f"Started monitoring {path}")
    return observer
