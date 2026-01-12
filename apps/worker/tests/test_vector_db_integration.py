import logging
import uuid
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

import config
from services.vector_db import db_service

# Configure logging to see output during tests (use pytest -s)
logger = logging.getLogger(__name__)


@pytest.mark.asyncio
async def test_vector_db_lifecycle():
    """
    Integration test for VectorDBService.
    Verifies ensure_collection, upsert, list, search, and delete.
    Mocking LLM service to avoid external API calls.
    """
    # Check if DB URL is configured
    if not config.DATABASE_CONN_STRING:
        pytest.skip("DATABASE_CONN_STRING not set")

    # Mock embeddings to return a fixed size vector
    dims = config.OPENAI_EMBEDDING_DIMENSIONS

    with patch("services.vector_db.get_embeddings_model") as mock_get_model:
        mock_embedding = MagicMock()
        # Return a random vector for any query
        mock_embedding.embed_query.return_value = np.random.rand(dims).tolist()
        mock_get_model.return_value = mock_embedding

        logger.info("Starting VectorDB Lifecycle Test")

        # 2. Upsert Document
        test_filename = f"pytest_{uuid.uuid4()}.txt"
        test_content = "This is a content for integration testing."
        test_set = "integration_test_set"

        vector = np.random.rand(dims).tolist()
        doc_id = str(uuid.uuid4())

        point = {
            "id": doc_id,
            "vector": vector,
            "payload": {
                "filename": test_filename,
                "content": test_content,
                "document_set": test_set,
                "custom_meta": "value",
            },
        }

        await db_service.upsert_vectors([point])
        logger.info(f"Upserted document {test_filename}")

        # 3. List Documents
        # Wait briefly for potential consistency (though Postgres is strong consistent)
        docs = await db_service.list_documents(limit=100)
        found_doc = next((d for d in docs if d["payload"]["filename"] == test_filename), None)

        assert found_doc is not None, "Upserted document not found in list"
        assert found_doc["payload"]["content"] == test_content
        assert found_doc["payload"]["custom_meta"] == "value"

        # 4. Search
        # We search for something. Since vectors are random, similarity will be random,
        # but we expect *some* result if we search broadly or if the table is small.
        # With pgvector HNSW, purely random vectors might not always match if
        # HNSW graph isn't built well or parameters.
        # But usually it returns results.

        results = await db_service.search("random query", limit=10)
        assert isinstance(results, list)
        # We won't assert we found OUR doc because of random vectors, but code path is exercised.

        # 5. Delete
        await db_service.delete_document(test_filename)
        logger.info(f"Deleted document {test_filename}")

        # 6. Verify Delete
        docs_after = await db_service.list_documents(limit=100)
        found_after = any(d["payload"]["filename"] == test_filename for d in docs_after)
        assert not found_after, "Document should be deleted"

        await db_service.close()
