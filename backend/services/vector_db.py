
import os
import json
import logging
import uuid
import re
from typing import List, Dict, Any, Optional

from supabase import create_client, Client
import config
from services.llm import get_embeddings_model

logger = logging.getLogger(__name__)

class VectorDBService:
    def __init__(self):
        self.supabase_url = config.SUPABASE_URL
        self.supabase_key = config.SUPABASE_KEY
        self.table_name = config.VECTOR_TABLE_NAME or 'documents'
        self.client: Optional[Client] = None
        
        self._validate_table_name()
        self._init_client()

    def _validate_table_name(self):
        """Ensure table name is safe."""
        if not re.match(r'^[a-zA-Z0-9_]+$', self.table_name):
            raise ValueError(f"Invalid table name: {self.table_name}")
            
    def _init_client(self):
        if self.supabase_url and self.supabase_key:
            try:
                self.client = create_client(self.supabase_url, self.supabase_key)
                logger.info("Initialized Supabase REST client.")
            except Exception as e:
                logger.error(f"Failed to initialize Supabase client: {e}")
        else:
            logger.warning("SUPABASE_URL or SUPABASE_KEY not set.")

    async def search(self, query: str, limit: int = 10, document_set: str = None) -> List[Dict[str, Any]]:
        if not self.client:
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
            
            response = self.client.rpc("match_documents", params).execute()
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
        if not self.client or not points:
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

            self.client.table(self.table_name).upsert(records).execute()
        except Exception as e:
            logger.error(f"Upsert failed: {e}")
            raise e

    async def delete_document(self, filename: str, document_set: str = None):
        if not self.client:
            return

        try:
            query = self.client.table(self.table_name).delete().eq("filename", filename)
            if document_set and document_set != "all":
                query = query.eq("document_set", document_set)
            
            query.execute()
            logger.info(f"Deleted documents for filename: {filename}")
        except Exception as e:
            logger.error(f"Delete failed: {e}")
            raise e

    async def list_documents(self, limit=100, offset=0):
        if not self.client:
             return []

        try:
            response = self.client.table(self.table_name)\
                .select("id, content, filename, document_set, metadata")\
                .range(offset, offset + limit - 1)\
                .execute()
                
            rows = response.data
            results = []
            for row in rows:
                 results.append({
                     "id": str(row.get('id')),
                     "payload": {
                         "content": row.get('content'),
                         "filename": row.get('filename'),
                         "document_set": row.get('document_set'),
                         **(row.get('metadata') or {})
                     }
                 })
            return results
        except Exception as e:
            logger.error(f"List documents failed: {e}")
            return []

    async def close(self):
        self.client = None

# Global Instance
db_service = VectorDBService()
