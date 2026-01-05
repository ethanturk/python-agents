import logging
import uuid
import re
from typing import List, Dict, Any, Optional

import config
from services.llm import get_embeddings_model
from services.supabase_service import supabase_service

logger = logging.getLogger(__name__)

class DocumentPoint:
    """Compatibility wrapper for document results (mimics Qdrant point)."""
    def __init__(self, id, payload):
        self.id = id
        self.payload = payload

class VectorDBService:
    def __init__(self):
        self.supabase = supabase_service
        self.table_name = config.VECTOR_TABLE_NAME or 'documents'
        self._validate_table_name()

    def _validate_table_name(self):
        """Ensure table name is safe."""
        if not re.match(r'^[a-zA-Z0-9_]+$', self.table_name):
            raise ValueError(f"Invalid table name: {self.table_name}")

    async def search(self, query: str, limit: int = 10, document_set: str = None) -> List[Dict[str, Any]]:
        if not self.supabase.is_available():
            return []

        embeddings = get_embeddings_model()
        try:
            query_vector = embeddings.embed_query(query)
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            return []

        try:
            params = {
                "query_embedding": query_vector,
                "match_threshold": 0,
                "match_count": limit,
                "filter_document_set": document_set if document_set != "all" else None
            }
            
            response = self.supabase.rpc("match_documents", params)
            rows = response.data
            
            results = []
            for row in rows:
                results.append({
                    "content": row.get('content'),
                    "metadata": {
                        "filename": row.get('filename'),
                        "document_set": row.get('document_set'),
                        **(row.get('metadata') or {})
                    },
                    "score": float(row.get('similarity', 0))
                })
            return results
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []

    async def upsert_vectors(self, points: List[Dict[str, Any]]):
        if not self.supabase.is_available() or not points:
            return

        try:
            records = []
            for point in points:
                p_id = point.get('id') or str(uuid.uuid4())
                vector = point.get('vector')
                payload = point.get('payload', {})
                filename = payload.get('filename')
                content = payload.get('content')
                doc_set = payload.get('document_set')
                metadata = {k: v for k, v in payload.items() if k not in ['filename', 'content', 'document_set']}
                
                records.append({
                    "id": p_id,
                    "vector": vector,
                    "filename": filename,
                    "document_set": doc_set,
                    "content": content,
                    "metadata": metadata
                })

            self.supabase.upsert(self.table_name, records)
        except Exception as e:
            logger.error(f"Upsert failed: {e}")
            raise e

    async def delete_document(self, filename: str, document_set: str = None):
        if not self.supabase.is_available():
            return

        try:
            filters = {"filename": filename}
            if document_set and document_set != "all":
                filters["document_set"] = document_set
                
            # Note: generic delete takes simple filters. 
            # If we need complex queries (like 'eq' chaining), we might need to expose builder in service
            # For now, let's assume 'delete' in service handles dict as 'AND' eq filters
            self.supabase.delete(self.table_name, filters)
            logger.info(f"Deleted documents for filename: {filename}")
        except Exception as e:
            logger.error(f"Delete failed: {e}")
            raise e

    async def list_documents(self, limit=100, offset=0):
        if not self.supabase.is_available():
             return []

        try:
            response = self.supabase.select(
                self.table_name, 
                columns="id, content, filename, document_set, metadata",
                range_start=offset,
                range_end=offset + limit - 1
            )
            
            rows = response.data
            results = []
            for row in rows:
                 payload = {
                     "content": row.get('content'),
                     "filename": row.get('filename'),
                     "document_set": row.get('document_set'),
                     **(row.get('metadata') or {})
                 }
                 results.append(DocumentPoint(id=str(row.get('id')), payload=payload))
            return results
        except Exception as e:
            logger.error(f"List documents failed: {e}")
            return []

    async def close(self):
        """Close the underlying Supabase client and cleanup resources."""
        try:
            self.supabase.close()
            logger.info("VectorDBService closed successfully.")
        except Exception as e:
            logger.warning(f"Error closing VectorDBService: {e}")

# Global Instance
db_service = VectorDBService()
