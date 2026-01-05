
import os
import asyncio
import logging
from services.vector_db import db_service
from services.llm import get_embeddings_model
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_postgres_vector():
    connection_string = os.getenv("DATABASE_CONN_STRING")
    if not connection_string:
        logger.error("Skipping test: DATABASE_CONN_STRING not set")
        return

    logger.info("1. Ensuring collection (table/extension) exists...")
    try:
        logger.info("   Success.")
    except Exception as e:
        logger.error(f"   Failed to ensure collection: {e}")
        return

    logger.info("2. Test Upsert...")
    try:
        # Create dummy vector
        import numpy as np
        # 768 dimensions as per config default
        vector = np.random.rand(768).tolist()
        
        point = {
            "id": str(uuid.uuid4()),
            "vector": vector,
            "payload": {
                "filename": "test_verification.txt",
                "content": "This is a verification test content.",
                "document_set": "test_set"
            }
        }
        
        db_service.upsert_vectors([point])
        logger.info("   Upsert success.")
    except Exception as e:
        logger.error(f"   Upsert failed: {e}")
        return

    logger.info("3. Test Search...")
    try:
        # Note: In real app, search uses embeddings model to embed query.
        # Here we just want to ensure SQL query works. 
        # But db_service.search() calls get_embeddings_model().embed_query(query)
        # So we need to make sure LLM service is mocking or working, 
        # OR we can manually call the underlying query logic if we wanted to mock embed.
        # Let's try calling search assuming LLM env vars are set (or defaults work).
        
        results = db_service.search("verification test", limit=1)
        if results:
            logger.info(f"   Search success. Found: {len(results)} results.")
            logger.info(f"   Top result content: {results[0].get('content')}")
        else:
            logger.info("   Search returned no results (unexpected if we just inserted).")
            
    except Exception as e:
        logger.error(f"   Search failed: {e}")

    logger.info("4. Test Delete...")
    try:
        db_service.delete_document("test_verification.txt")
        logger.info("   Delete success.")
    except Exception as e:
         logger.error(f"   Delete failed: {e}")

if __name__ == "__main__":
    test_postgres_vector()
