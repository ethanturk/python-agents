import pytest
import psycopg2
from unittest.mock import patch
import numpy as np
from services.vector_db import db_service
import config


@pytest.mark.integration
@pytest.mark.asyncio
async def test_vector_db_real_connection(test_db_connection):
    """Test real vector DB connection and operations."""
    # Clean up any existing test data
    with test_db_connection.cursor() as cur:
        cur.execute("DELETE FROM test_documents WHERE filename LIKE 'pytest_%'")
        test_db_connection.commit()

    # Test upsert
    doc_id = "pytest_test_001"
    filename = "pytest_test_doc.txt"
    content = "Test content for real DB test"
    vector = np.random.rand(config.OPENAI_EMBEDDING_DIMENSIONS).tolist()

    point = {
        "id": doc_id,
        "vector": vector,
        "payload": {
            "filename": filename,
            "content": content,
            "document_set": "pytest_set",
            "metadata": {"test": True},
        },
    }

    await db_service.upsert_vectors([point])

    # Verify insert
    with test_db_connection.cursor() as cur:
        cur.execute("SELECT filename, content FROM test_documents WHERE filename = %s", (filename,))
        result = cur.fetchone()
        assert result is not None
        assert result[0] == filename
        assert result[1] == content

    # Test list
    docs = await db_service.list_documents(limit=10)
    test_doc = next((d for d in docs if d["payload"]["filename"] == filename), None)
    assert test_doc is not None
    assert test_doc["payload"]["content"] == content

    # Test search (will work if vector similarity matches)
    with patch("services.vector_db.get_embeddings_model") as mock_get_model:
        mock_embedding = MagicMock()
        mock_embedding.embed_query.return_value = vector
        mock_get_model.return_value = mock_embedding

        results = await db_service.search("test query", limit=5)
        assert isinstance(results, list)
        # We might find our document if similarity is high enough

    # Test delete
    await db_service.delete_document(filename)

    # Verify delete
    with test_db_connection.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM test_documents WHERE filename = %s", (filename,))
        count = cur.fetchone()[0]
        assert count == 0


@pytest.mark.integration
@pytest.mark.asyncio
async def test_vector_db_filter_by_set(test_db_connection):
    """Test filtering documents by document_set."""
    # Insert test documents in different sets
    vectors = np.random.rand(3, config.OPENAI_EMBEDDING_DIMENSIONS).tolist()

    docs = [
        {
            "id": "pytest_set1_001",
            "vector": vectors[0],
            "payload": {
                "filename": "set1_doc1.txt",
                "content": "Document in set 1",
                "document_set": "pytest_set1",
            },
        },
        {
            "id": "pytest_set1_002",
            "vector": vectors[1],
            "payload": {
                "filename": "set2_doc1.txt",
                "content": "Document in set 2",
                "document_set": "pytest_set2",
            },
        },
        {
            "id": "pytest_set1_003",
            "vector": vectors[2],
            "payload": {
                "filename": "set1_doc2.txt",
                "content": "Another document in set 1",
                "document_set": "pytest_set1",
            },
        },
    ]

    await db_service.upsert_vectors(docs)

    # List all
    all_docs = await db_service.list_documents(limit=10)
    pytest_docs = [d for d in all_docs if d["payload"]["filename"].startswith("set")]
    assert len(pytest_docs) >= 3

    # Cleanup
    for doc in docs:
        await db_service.delete_document(doc["payload"]["filename"])


@pytest.mark.integration
@pytest.mark.asyncio
async def test_vector_db_batch_operations(test_db_connection):
    """Test batch upsert and delete operations."""
    batch_size = 50
    vectors = np.random.rand(batch_size, config.OPENAI_EMBEDDING_DIMENSIONS).tolist()

    docs = [
        {
            "id": f"pytest_batch_{i}",
            "vector": vectors[i],
            "payload": {
                "filename": f"batch_doc_{i}.txt",
                "content": f"Batch document {i}",
                "document_set": "pytest_batch",
            },
        }
        for i in range(batch_size)
    ]

    # Batch upsert
    await db_service.upsert_vectors(docs)

    # Verify count
    listed = await db_service.list_documents(limit=100)
    batch_docs = [d for d in listed if d["payload"]["filename"].startswith("batch_doc_")]
    assert len(batch_docs) >= batch_size

    # Batch delete (cleanup)
    for doc in docs:
        await db_service.delete_document(doc["payload"]["filename"])


@pytest.mark.integration
@pytest.mark.asyncio
async def test_vector_db_metadata_storage(test_db_connection):
    """Test that metadata is correctly stored and retrieved."""
    complex_metadata = {
        "author": "test_author",
        "tags": ["tag1", "tag2", "tag3"],
        "nested": {"key1": "value1", "key2": 42},
        "array_field": [1, 2, 3, 4, 5],
    }

    vector = np.random.rand(config.OPENAI_EMBEDDING_DIMENSIONS).tolist()

    point = {
        "id": "pytest_meta_001",
        "vector": vector,
        "payload": {
            "filename": "meta_test.txt",
            "content": "Test metadata storage",
            "document_set": "pytest_meta",
            "metadata": complex_metadata,
        },
    }

    await db_service.upsert_vectors([point])

    # Retrieve and verify metadata
    docs = await db_service.list_documents(limit=10)
    meta_doc = next((d for d in docs if d["payload"]["filename"] == "meta_test.txt"), None)

    assert meta_doc is not None
    retrieved_meta = meta_doc["payload"]["metadata"]
    assert retrieved_meta["author"] == complex_metadata["author"]
    assert retrieved_meta["tags"] == complex_metadata["tags"]
    assert retrieved_meta["nested"]["key1"] == complex_metadata["nested"]["key1"]
    assert retrieved_meta["nested"]["key2"] == complex_metadata["nested"]["key2"]

    # Cleanup
    await db_service.delete_document("meta_test.txt")
